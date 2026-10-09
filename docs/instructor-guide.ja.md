# Azure PaaS ワークショップ - インストラクターガイド

このガイドは、Azure PaaS Workshop を進行するインストラクター向けに、教えどころ、つまずきやすいポイント、ディスカッションの進め方のヒントをまとめたものです。

> **Cloud Shell 専用の受講者本線:** 受講者には [Azure PaaS Workshop 受講者ポータル](../materials/docs/index.md) を案内してください。ポータルは Cloud Shell (Bash) だけで Day 0 / Day 1 / Day 2 / Cleanup を進める構成です。
>
> ローカル開発、Windows/WSL、PowerShell は代替・発展・講師向け参照として扱います。GitHub Actions は手動 build/deploy の任意代替です。

> **📝 注意:** このドキュメントはインストラクター専用です。受講者はメインの [README.ja.md](../README.ja.md)（必要に応じて [README.md](../README.md)）に従ってください。

> **📘 アーキテクチャ/運用ガイド（講師参照用）:**
> - [BCDR ガイド](../materials/docs/disaster-recovery-guide.ja.md)
> - [監視ガイド](../materials/docs/monitoring-guide.ja.md)
> - [Bicep ガイド](../materials/docs/bicep-guide.ja.md)
> - [IaaS 版と PaaS 版のアプリケーションコード比較ガイド](../materials/docs/application-code-comparison-iaas-paas.ja.md)
> - [IaaS vs PaaS App Code Comparison Guide (EN)](../materials/docs/application-code-comparison-iaas-paas.md)

---

## 目次

- [アーキテクチャ/運用ガイド](../materials/docs/)
   - [BCDR ガイド](../materials/docs/disaster-recovery-guide.ja.md)
   - [監視ガイド](../materials/docs/monitoring-guide.ja.md)
   - [Bicep ガイド](../materials/docs/bicep-guide.ja.md)
   - [IaaS 版と PaaS 版のアプリケーションコード比較ガイド](../materials/docs/application-code-comparison-iaas-paas.ja.md)
   - [IaaS vs PaaS App Code Comparison Guide (EN)](../materials/docs/application-code-comparison-iaas-paas.md)
- [ワークショップ概要](#ワークショップ概要)
- [セクション 1: イントロダクション](#セクション-1-イントロダクション)
- [セクション 2: 前提条件とデプロイ](#セクション-2-前提条件とデプロイ)
- [セクション 3: テスト](#セクション-3-テスト)
- [セクション 4: IaaS vs PaaS 比較](#セクション-4-iaas-vs-paas-比較)
- [受講者がつまずきやすいポイント](#受講者がつまずきやすいポイント)
- [時間配分のコツ](#時間配分のコツ)

---

## ワークショップ概要

### 本線の成功条件を確認する

本線は **Cloud Shell standard / ZIP、SWA Standard、App Service B1、DocumentDB M25 / HA=false** です。B1 の slots / zone redundancy、M25 の HA を有効と説明しません。Entra 認証は WAF 代替ではなく、published read / health と認証付き write の責任分界を説明します。IaaS 比較は [現行 revision](../design/IaaS-PaaS-ComparisonMatrix.md) の 3 data-bearing members / no arbiter を基準にし、PaaS baseline が同等の可用性を保証すると教えません。

開始前に RBAC・tenant registration/自己同意・公開依存/CLI・provider/region/SKU/quota と費用を確認します。**Contributor-only / 主催者準備なし** で必要な role assignment を完了できない現状を、講師が事前に補って成功扱いにしません。文書 / mock / catalog / template build の成功は live readiness ではありません。

各グループの到達点は [Day 1 の公開契約・browser CRUD・telemetry](../materials/docs/learner/day-1-validation.ja.md)、[Day 2 の時刻・復旧・data integrity](../materials/docs/learner/day-2-reliability.ja.md)、[owned cleanup](../materials/docs/learner/cleanup.ja.md) の証拠で判断します。復旧未観測は 0 秒成功でなく null、429 は DB failover でなく throttling、記事 viewCount は content integrity と別です。秘密値・token・本文・未加工 logs を収集しません。

### 任意例外: 管理者が組織全体同意を行う

本線は各グループの所有アプリと、ポリシーで許可されたブラウザー自己同意です。登録・同意が禁止されている環境では自己完結を保証しません。**以下は別途承認した管理者支援の例外**で、Contributor のみ・主催者の事前準備なしという条件を満たす手順ではありません。

依頼者は対象 tenant、Frontend/Backend client ID、scope `access_as_user`、CLI バージョン、エラーコード・correlation ID、PIM の状態を提示します。トークンや秘密情報は渡しません。今回の独自 API delegated permission の組織全体同意は Cloud Application Administrator / Application Administrator 等の適切な権限で実行します。Azure Owner/Contributor やアプリ所有者だけでは不足します。PIM は付与済みの適切なロールのみ有効化し、受講者全員への管理者ロール付与は行いません。

管理者は、依頼値を設定したうえで tenant と両アプリを確認します。共有アプリにはこの新規検証用コマンドを使用しません。

```bash
if [ -z "${TENANT_ID:-}" ] || [ -z "${FRONTEND_CLIENT_ID:-}" ] || [ -z "${BACKEND_CLIENT_ID:-}" ]; then
  echo "依頼者の tenant と両 client ID を設定してから実行してください。"
  exit 1
fi
current_tenant="$(az account show --query tenantId -o tsv)" || exit 1
if [ "$current_tenant" != "$TENANT_ID" ]; then
  echo "依頼された tenant と一致しません。停止します。"
  exit 1
fi
az ad app show --id "$FRONTEND_CLIENT_ID" --query "{id:id,appId:appId,displayName:displayName}" -o jsonc || exit 1
az ad app show --id "$BACKEND_CLIENT_ID" --query "{id:id,appId:appId,displayName:displayName}" -o jsonc || exit 1

# 検索失敗と未作成を区別するため、一覧取得後に件数を判断する
for client in "$BACKEND_CLIENT_ID" "$FRONTEND_CLIENT_ID"; do
  principals="$(az ad sp list --filter "appId eq '$client'" -o json)" || exit 1
  count="$(printf '%s' "$principals" | jq -r 'length')" || exit 1
  if [ "$count" -eq 0 ]; then
    az ad sp create --id "$client" --output none || exit 1
  elif [ "$count" -ne 1 ]; then
    echo "service principal が一意ではありません。停止します。"
    exit 1
  fi
done

existing="$(az ad app permission list-grants --id "$FRONTEND_CLIENT_ID" -o json)" || exit 1
existing_count="$(printf '%s' "$existing" | jq -er 'if type == "array" then length else error("grant 一覧が配列ではありません") end')" || exit 1
if [ "$existing_count" -ne 0 ]; then
  echo "既存 grant があります。CLI による置換は行わず、個別にレビューしてください。"
  exit 1
fi

az ad app permission grant \
  --id "$FRONTEND_CLIENT_ID" --api "$BACKEND_CLIENT_ID" \
  --scope access_as_user --consent-type AllPrincipals
```

実行後は [Day 0 の検証](../materials/docs/learner/day-0-entra-id.ja.md#day-1-のサインイン後に自己同意を検証する) と同じ client/resource object ID を確認し、この例外では `consentType: AllPrincipals`、`principalId: null`、`scope` に `access_as_user` があることを確認します。続けて Frontend サインインと認証付き記事作成を確認します。同時変更があり得る共有アプリには、上の確認だけでは置換リスクを排除できません。

参考: [テナント全体への管理者同意](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent)、[Azure CLI grant](https://learn.microsoft.com/en-us/cli/azure/ad/app/permission#az-ad-app-permission-grant)。

### 進行形式の例

| 形式 | 時間 | グループ規模 | メモ |
|------|------|--------------|------|
| 対面（講師主導） | 4時間 | 20-45名（10-15グループ） | 推奨 |
| オンライン（講師主導） | 4時間 | 20-45名 | ブレイクアウトルーム推奨 |
| 自習 | 可変 | 個人 | README に沿って進行 |

### 推奨タイムライン（4時間想定）

以下は進行案で、fresh Cloud Shell rehearsal の実測ではありません。起点は各グループの Day 0 context / permissions / consent / catalog 確認完了とし、待ち時間・telemetry delay・復旧・cleanup を含む実測で更新します。ブロックを時間内成功へ置き換えず、費用も 4 時間固定額として保証しません。

| 時刻 | 目安 | 内容 |
|------|------|------|
| 0:00 | 20分 | イントロ + 全体像 |
| 0:20 | 60分 | ハンズオン: インフラデプロイ（Steps 1-4） |
| 1:20 | 15分 | 休憩 |
| 1:35 | 60分 | 講師解説: アーキテクチャ / Bicep / 認証 / 監視 |
| 2:35 | 85分 | ハンズオン: アプリデプロイ + 動作確認 |

### IaaS ワークショップ（Day 1）との関係

このワークショップは 2日シリーズの Day 2 として設計されています。

- **Day 1:** [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop)（VM、LB、手動構成）
- **Day 2:** Azure PaaS Workshop（本ワークショップ。マネージドサービス中心、運用負荷を削減）

Day 1 を終えている参加者が多い場合は、比較ポイント（責任分界、デプロイ手順、ネットワーク、セキュリティ、運用）を随所で意識してもらうと効果的です。

---

## セクション 1: イントロダクション

### 教えどころ

導入では次の点を強調します。

1. **IaaS と PaaS のトレードオフ**
   - IaaS: 自由度が高い一方、運用責任が大きい
   - PaaS: 自由度は一部制約されるが、運用が Microsoft 側でマネージされる

2. **運用負荷の削減**
   - OS パッチ適用が不要
   - 高可用性は採用 SKU / region / 明示設定に依存し、本線 M25 は HA=false
   - オートスケールは対応 tier の任意設計であり、B1 本線で有効ではない

3. **PaaS / IaaS の使い分け**
   - PaaS: ステートレスな Web アプリ / API、モダンアプリ
   - IaaS: カスタム OS 要件、レガシー、状態管理が強いアプリ

### よくある質問

| 質問 | 例としての回答 |
|------|----------------|
| 「App Service と VM はいつ使い分ける？」 | ステートレス/ステートフルの観点で説明。App Service はカスタム OS 構成不要な Web/API に向く。 |
| 「PaaS の方が高い？」 | リソース単価だけでなく、運用コスト（人件費/工数/リスク）も含めた TCO で比較する。 |
| 「IaaS から PaaS へ移行できる？」 | 可能。本シリーズは同一アプリを両方式で体験する。論点は DB 移行、接続文字列、デプロイ方法、運用。 |

### ディスカッションの進め方

**テーマ:** 「IaaS と PaaS で何が変わりそう？」

参加者の経験を引き出します。
- これまで使った PaaS（Azure/AWS/その他）
- ベンダーロックインへの懸念
- マネージドサービスの制約や運用に関する疑問

---

## セクション 2: 前提条件とデプロイ

### Entra ID セットアップのつまずきポイント

このパートは最も詰まりやすい箇所です。特に以下を注意して見てください。

1. **Redirect URI の種類が誤り**
   - 「Web」を選んでしまい、SPA にしていない
   - 症状: ログイン時に `AADSTS9002326`
   - 対処: いったん削除して「Single-page application (SPA)」として追加し直す

2. **API 権限の不足**
   - フロントエンドがバックエンド API を呼ぶ権限がない
   - 症状: 403 や “insufficient privileges”
   - 対処: フロントエンド側の「API permissions」で API スコープを付与

3. **スコープ未作成**
   - バックエンド API 側で `access_as_user` スコープが未作成
   - 症状: “Invalid scope”
   - 対処: Backend API → “Expose an API” でスコープ作成

**権限境界:** 登録・自己同意が policy で禁止されている場合は本線の block と記録します。主催者が事前にアプリを作って配布した場合は別の管理者支援方式であり、Contributor-only / 事前準備なしの成功と数えません。

### Bicep デプロイ

**時間の記録:** catalog / permissions / consent 完了後の create 開始から、今回の Succeeded と outputs 確認までを測定します。DB / endpoint / RBAC の provisioning と app readiness は別です。旧 10-15 分 / 3-5 分という目安を、新しい baseline の実測や保証として使いません。

**待ち時間に説明するとよい内容:**
1. VNet とサブネット（appservice / privateendpoint）
2. DB と Private Endpoint / DNS（effective public firewall / private route は実環境で別途確認）
3. Key Vault と Private Endpoint（シークレット保管）
4. App Service + VNet Integration（プライベートリソースへ接続）
5. Static Web Apps Standard（空で作成され、後でフロントをデプロイ）

**よくあるエラー:**

| エラー | 原因 | 対処 |
|------|------|------|
| “Missing parameter” | Entra ID の値が不足 | `dev.local.bicepparam` を確認 |
| “Invalid password format” | パスワード要件不足 | 英数字+記号で生成 |
| “Name already exists” | 名前衝突 | チームごとに RG 名を分ける / groupId を使う |

### アプリデプロイ

**バックエンド:**
- build / upload acceptance / 今回の release 完了 / readiness を別時刻で確認する
- bounded probe 後も失敗なら startup → MI / Key Vault → private DB を診断する
- 旧 instance の health や固定 60-90 秒待機を新 release 成功の証拠としない

**フロントエンド:**
- デプロイ時に runtime config を `index.html` へ注入（セキュリティ上の設計）
- SWA CLI がビルド済み成果物をアップロード
- Linked Backend が `/api/*` を App Service へプロキシ

---

## セクション 3: テスト

### つまずきポイント

| 事象 | 原因 | 対処 |
|------|------|------|
| API が 401 | Linked Backend 未設定 | Azure Portal で SWA 設定を確認 |
| CORS エラー | 本来は起きにくい（Linked Backend 前提） | SWA と App Service のリンク設定確認 |
| ログイン後のリダイレクト失敗 | Redirect URI 不足 | Entra ID のフロントアプリに SWA URL を追加 |
| ログイン後に “No account” | MSAL キャッシュ問題 | キャッシュ削除 / シークレットウィンドウで再試行 |

### 確認チェックリスト

- [ ] 直接ヘルスチェック: `https://<app-service>.azurewebsites.net/health` が 200
- [ ] SWA 経由: `https://<swa>.azurestaticapps.net/api/health` が 200
- [ ] フロントがコンソールエラーなしで表示
- [ ] Microsoft アカウントでサインインできる
- [ ] 投稿の作成/編集/削除ができる

---

## セクション 4: IaaS vs PaaS 比較

### 教えどころ（アーキテクチャ）

1. **Static Web Apps + Linked Backend**
   - `/api/*` を App Service へプロキシ
   - API 保護のために Application Gateway が不要
   - SSL 証明書が自動管理

2. **Private Endpoints**
   - DB/Key Vault はインターネットへ公開されない
   - App Service はプライベート IP 経由でアクセス
   - IaaS では VM が VNet 内のプライベート IP を直接利用していた点と比較

3. **VNet Integration**
   - App Service がプライベートリソースへアクセス可能
   - Outbound が NAT Gateway を経由
   - IaaS の VM と責任分界を比較

4. **Managed Identity**
   - コードに資格情報を埋め込まない
   - App Service が Key Vault に自動で認証
   - IaaS ではスクリプトが Key Vault から取得する運用と対比

### コード差分のディスカッション

1. **DB 接続**
   - IaaS: MongoDB レプリカセット（IP を明示）
   - PaaS: `mongodb+srv://` + TLS 必須

2. **設定の読み込み**
   - IaaS: Nginx が `/config.json` を配信（Bicep 生成）
   - PaaS: デプロイ時に `index.html` へ注入（より安全）

3. **API ルーティング**
   - IaaS: Application Gateway が VM へルーティング
   - PaaS: SWA Linked Backend が App Service へプロキシ

### ディスカッションの進め方

**テーマ 1:** 「どんな時に IaaS を選ぶ？」

期待される回答例:
- カスタム OS 要件（特定カーネル等）
- ローカルディスク前提のステートフル
- レガシー依存
- 特定ハードウェア（GPU、大容量メモリ等）
- 専用基盤が求められる規制要件

**テーマ 2:** 「マネージドサービスのトレードオフは？」

- 自由度低下 vs 運用負荷削減
- ロックイン懸念 vs 立ち上げ速度
- 予算/コストの見え方
- カスタマイズ制約 vs ベストプラクティス既定

**テーマ 3:** 「IaaS → PaaS の移行はどう進める？」

- ステートレス/ステートフルの切り分け
- DB 移行の検討
- 接続文字列/設定の変更計画
- 段階移行（ハイブリッド）

---

## 受講者がつまずきやすいポイント

- Entra ID の Redirect URI 種別（SPA）
- API 権限付与とスコープ作成
- 初回起動の遅さ（VNet/Key Vault の影響）
- SWA の Linked Backend 設定ミス

---

## 時間配分のコツ

- Entra ID は最初に時間を確保（詰まりやすい）
- Bicep デプロイ中は講師解説を入れて待ち時間を活用
- 初回のバックエンド起動遅延は「正常範囲」と事前に共有
