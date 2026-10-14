# BCDR ガイド（Azure PaaS ワークショップ ブログアプリケーション）

このガイドでは、本ワークショップの PaaS アーキテクチャに対する、実践的な **事業継続（Business Continuity）/ 災害復旧（Disaster Recovery）= BCDR** の進め方を説明します。

> **受講者本線:** Cloud Shell 専用の Day 2 手順は [Day 2: 信頼性と復旧](learner/day-2-reliability.ja.html) を参照してください。このガイドは BCDR の参照用です。

- **Frontend**: Azure Static Web Apps（SWA）
- **Backend**: Azure App Service（Linux, Node.js）
- **Database**: Azure Cosmos DB for MongoDB vCore
- **Secrets**: Azure Key Vault
- **Observability**: Application Insights + Log Analytics

> 対象範囲: 現行 Bicep テンプレートは **単一リージョンのプライマリ環境** をデプロイします。本ガイドでは、この前提に対してワークショップで実施しやすい継続性・DR ランブックを示します。

**実施境界:** 本線 B1 / M25 / HA=false は slots / zone redundancy / DB HA / secondary region を提供しません。必須演習は [restart / redeploy / known-revision rebuild rollback / content integrity](learner/day-2-reliability.ja.html) です。以下の secondary region / backup restore は **optional 設計案・未実証** で、追加承認・supported SKU / region / quota / restore point / 費用 / cleanup を確認するまで実行しません。RBAC / consent / 公開依存の block を管理者・主催者準備や public DB で回避しません。

---

## 1. 継続性目標（RPO / RTO）を定義する

まず次を明確化します。

- **RPO（Recovery Point Objective）**: 許容できるデータ損失幅
- **RTO（Recovery Time Objective）**: 許容できるサービス停止時間

RPO/RTO は workload の要求から決め、restore point / content 比較 / operation time / traffic cutover を実測します。旧 RPO 1〜24 時間 / RTO 1〜4 時間を本線の達成値・保証として使いません。health sample の復旧時間は真の停止時間や DB failover RTO ではなく、停止未観測は null です。429 は throttling として区別します。

---

## 2. このアーキテクチャで想定する障害シナリオ

### 2.1 コンポーネント単位の障害（最も一般的）

- App Service インスタンスの異常
- Cosmos DB 接続の一時的障害
- Key Vault アクセス権（RBAC）設定ミス
- デプロイ後のアプリケーション不具合

主な対策:

- App Service ヘルスチェック（`/health`, `/api/health`）
- バックエンド/フロントエンドの迅速な再デプロイ
- 既知の正常ビルドへのロールバック

### 2.2 リージョン障害（低頻度・高影響）

- プライマリリージョンの停止または深刻な劣化

主な対策:

- セカンダリリージョン用リソースグループを事前定義
- Bicep による環境再構築
- DNS/トラフィック切替ランブック

---

## 3. サービス別 BCDR 方針

## 3.1 Static Web Apps（フロントエンド）

復旧原則:

- フロントエンドはステートレスで、ソースから再構築可能

BCDR 対応:

1. ソースコードと CI ワークフローを GitHub（等）で管理する。
2. 環境変数/アプリ設定をコード化または手順書化する。
3. optional DR の承認後だけ、別 state / RG に SWA Standard を展開する。new origin、Frontend MSAL redirect、API IDs/consent、Linked Backend と runtime config を検証してから traffic を切り替える。

## 3.2 App Service（バックエンド）

復旧原則:

- バックエンド実行環境は、ソース/成果物 + 設定で再現できる

BCDR 対応:

1. バックエンド成果物を再生成可能に保つ（`npm ci`、build、deploy パッケージ/コンテナ）。
2. シークレットは Key Vault に格納する（現行実装どおり Key Vault reference を利用）。
3. 切替前に `/health` と `/api/health` で準備完了を確認する。

## 3.3 Cosmos DB for MongoDB vCore（データ）

復旧原則:

- データ層が RPO を左右するため、最優先の復旧依存として扱う

BCDR 対応（optional 設計の確認項目）:

1. 対応 tier の managed restore / retention を確認する。logical export を採用するなら private network 内の承認済み経路・tool compatibility・安全な認証/暗号化保管・restore destination を定義する。Cloud Shell が private DB に直接届くとは仮定しない。
2. バックアップ保持期間を RPO に合わせる。
3. 本番要件に応じて、HA やジオ戦略など上位の可用性機能を検討する。

> 利用ティアで使用可能な機能と復元オプションは、Cosmos DB for MongoDB vCore の最新 Microsoft ドキュメントで必ず確認してください。

M25 は HA 不可、M30+ から M25 へは戻せません。tier upgrade を可逆的な演習 toggle としません。export / restore は本線で実行検証しておらず、copyable destructive commands をここから省略しているのは権限・経路・保管・宛先が未確定のためです。元 DB の削除・overwrite / VM replica-set / ASR を本線へ追加しません。

## 3.4 Key Vault（シークレット）

復旧原則:

- シークレット/設定は再現可能かつ復旧可能であること

BCDR 対応:

1. シークレット登録/更新手順をスクリプトまたはランブック化する。
2. 重要な初期シークレットの安全なエスカレーション/保管手順を定義する。
3. optional secondary の secret/MI/RBAC を安全に復元し、reference の status を検証する。primary の secret を terminal / JSON state / Git / raw logs に出さず、再実行時の password rotation を避ける。

---

## 4. Optional DR ランブック設計（追加承認後のみ）

### フェーズ A: 事前準備（通常時）

1. primary / secondary は別専用 RG / JSON state / private parameter にする。immutable target を上書きして切り替えない。
2. バックエンド/フロントエンドのデプロイパイプラインを定期検証する。
3. データバックアップと復元演習を定期実施する。
4. 運用チェックリスト（担当者、コマンド、検証手順）を維持する。

### フェーズ B: インシデント宣言

1. 影響範囲を確認する（コンポーネント障害かリージョン障害か）。
2. 不要なデプロイを停止する。
3. DR モードを宣言し、インシデント指揮者と連絡責任者を明確化する。

### フェーズ C: 復旧実行

1. セカンダリリージョンのリソースを Bicep で展開/確認する。
2. 最新の有効バックアップから DB を復元する（または待機系を活用）。
3. バックエンドをデプロイし、ヘルスエンドポイントを確認する。
4. フロントエンドをデプロイし、ログインと API 通信を確認する。
5. DNS/エントリポイントをセカンダリ環境へ切り替える。

### フェーズ D: フェールオーバー後検証

1. 主要ユーザーフローを確認:
   - 投稿一覧の閲覧
   - サインイン
   - 投稿作成/編集
2. Application Insights / Log Analytics のテレメトリを確認する。
3. 実測 RTO/RPO を記録し、改善項目を洗い出す。

---

## 5. 復旧検証チェックリスト

- セカンダリリージョンで Bicep デプロイが成功する
- バックエンドのヘルスエンドポイントが期待どおり応答する
- DB 接続と CRUD 操作が成功する
- Entra ID 認証フローが切替後も機能する
- 監視とアラートが DR 環境でも継続する
- 目標 RTO 以内でランブックを完了できる

---

## 6. 本番向け optional DR 演習の頻度

以下は対応環境で追加承認後に計画する例であり、現在の learner baseline の必須作業・検証済み内容ではありません。頻度は要件と費用に応じて決めます。

1. プライマリ停止を想定したシミュレーション
2. Bicep からセカンダリ環境を展開
3. 最新バックアップからデータ復元
4. トラフィック切替とスモークテスト
5. 学びを記録し、ランブックを更新

---

## 7. 今後の拡張（任意）

- Azure DevOps / GitHub Actions によるフェールオーバー手順自動化
- マルチリージョン active-passive 構成への拡張
- バックアップ自動化と整合性検証の強化
- RTO/RPO SLO に連動したサービスアラートの実装
