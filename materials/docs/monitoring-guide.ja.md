# 監視ガイド（Azure Monitor + Application Insights + Log Analytics）

このガイドでは、Azure PaaS ワークショップのブログアプリケーションを監視・トラブルシュートする方法を説明します。

- **Frontend**: Azure Static Web Apps
- **Backend**: Azure App Service（`/health`, `/api/health`）
- **Database**: Azure Cosmos DB for MongoDB vCore
- **Telemetry**: Application Insights（workspace-based）+ Log Analytics

---

## 1. 監視の目的

ワークショップ運用では、次の 3 点に迅速に答えられる状態を目指します。

1. **利用可能か？**（稼働状況、ヘルスチェック、エラー率）
2. **健全か？**（依存先状態、DB 接続、認証フロー）
3. **性能は維持できているか？**（API レイテンシ、失敗率、リソース飽和）

---

## 2. Bicep で既に構成されている監視基盤

`materials/bicep/modules/monitoring.bicep` で次が作成されます。

- Log Analytics ワークスペース（`PerGB2018`）
- ワークスペース連携 Application Insights
- コスト抑制のための日次上限設定

`materials/bicep/modules/appservice.bicep` では、バックエンドに次が設定されます。

- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- Node.js 向け Application Insights 拡張設定
- App Service のヘルスチェックパス `/health`

---

## 3. 推奨シグナル設計

## 3.1 可用性シグナル

- App Service ヘルスエンドポイント（`/health`）
- SWA 経由 API ヘルス（`/api/health`）
- HTTP ステータス分布（2xx/4xx/5xx）

## 3.2 信頼性シグナル

- Application Insights の failed requests / exceptions
- Key Vault reference 解決失敗
- バックエンドログ上の Cosmos DB 接続障害

## 3.3 性能シグナル

- リクエスト時間の分位点（P50/P95/P99）
- 依存呼び出しの遅延・失敗
- App Service の CPU/メモリ推移

---

## 4. 実践セットアップ手順

### 4.1 App Service ヘルスチェックを検証する

1. 通常時に `/health` が HTTP 200 を返すことを確認する。
2. フロントエンド経由で `/api/health` に到達できることを確認する。
3. EasyAuth 設定でヘルス系パスが除外されていることを確認する。

### 4.2 診断設定を有効化する（未設定の場合）

本番相当の可観測性のため、次のリソースのプラットフォームログ/メトリックを Log Analytics に送ります。

- App Service
- Static Web Apps（利用可能な診断カテゴリがある場合）
- Key Vault
- Cosmos DB クラスター関連リソース

> ワークショップの Bicep ベースラインは監視リソース作成までを担い、全リソースの診断設定を強制はしていません。

### 4.3 アプリケーションログを標準化する

- 構造化ログ（JSON フレンドリー）を維持する
- 可能なら相関キー（request id、user id、operation）を含める
- シークレット/トークン/個人情報はログ出力しない

---

## 5. KQL クエリ例（スターター）

> テーブル名は、診断カテゴリやエージェント有効化状況で変わる場合があります。

### 5.1 直近テレメトリの簡易確認

```kusto
search *
| where TimeGenerated > ago(15m)
| take 100
```

### 5.2 App Service の HTTP 失敗（Application Insights）

```kusto
requests
| where timestamp > ago(1h)
| where success == false or resultCode startswith "5"
| project timestamp, name, resultCode, duration, operation_Id
| order by timestamp desc
```

### 5.3 API 遅延（P95）

```kusto
requests
| where timestamp > ago(24h)
| summarize p95_duration=percentile(duration, 95) by name
| order by p95_duration desc
```

### 5.4 例外の種類別集計

```kusto
exceptions
| where timestamp > ago(24h)
| summarize count() by type
| order by count_ desc
```

### 5.5 Heartbeat / エージェント稼働確認

```kusto
Heartbeat
| summarize LastSeen=max(TimeGenerated) by Computer
| order by LastSeen desc
```

---

## 6. 最小アラート設計

次のアラートルールを作成します。

- HTTP 5xx 比率が閾値超過（例: 5 分間で 5% 超）
- `/health` の連続失敗
- レイテンシ異常（P95 上昇）
- 例外発生の急増

通知先:

- メール / Teams / PagerDuty（チーム運用に合わせる）

---

## 7. ワークショップ向け障害切り分けフロー

次の順で確認すると切り分けが早くなります。

1. **フロントエンド到達性**（SWA が静的コンテンツを配信できるか）
2. **SWA 経由 API ヘルス**（`/api/health`）
3. **バックエンド直接ヘルス**（`/health`）
4. **Application Insights の失敗/例外**
5. **DB 依存状態**（接続失敗、タイムアウト傾向）

---

## 8. 運用上のベストプラクティス

- 環境ごとに Log Analytics ワークスペースを分離する
- アラート閾値をユーザー体感 SLO と整合させる
- 実障害を待たずに月次でアラート訓練を実施する
- MTTA/MTTR を記録し、事後レビューで改善する

---

## 9. 今後の拡張（任意）

- 講師/運用者向け Dashboard / Workbook 追加
- 診断設定とアラートを Bicep モジュール化
- ログイン〜投稿作成までの合成監視（Synthetic Probe）追加
