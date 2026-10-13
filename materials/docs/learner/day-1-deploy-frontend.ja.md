---
title: "Day 1: フロントエンドをデプロイ"
---

# Day 1: フロントエンドをデプロイ

Cloud Shell で React を build し、[公式 ARM ZIP API](https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/create-zip-deployment-for-static-site?view=rest-appservice-2025-05-01) へ送る経路です。SWA CLI の導入・deployment token の取得は不要です。Runtime config、SWA Standard、Linked Backend `/api`、MSAL は維持します。

**現在の境界:** ZIP の保管先と実 Azure upload は別途確認が必要です。この実装の local/CI fixture 成功は、workshop-ready や #15 完了の証拠ではありません。Contributor のみ・管理者支援なしという条件も変更せず、fresh Key Vault RBAC の prerequisite を満たせない場合は Day 0 で止めます。SWA CLI の既知の audit failure は解消したと扱いません。

## 1. 変数とツールを確認する

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1
node --version
npm --version
az version
command -v zip
command -v unzip
printf 'SWA: %s\nHost: %s\n' "$SWA_NAME" "$SWA_HOSTNAME"
printf 'Tenant: %s\nFrontend: %s\nBackend: %s\n' "$TENANT_ID" "$FRONTEND_CLIENT_ID" "$BACKEND_CLIENT_ID"
```

Node.js 24 と Cloud Shell Bash を使います。State は version 付き JSON で、旧 `deploy-frontend.local.env` は実行しません。Client IDs は公開設定ですが、token・接続文字列は表示しません。

## 2. 新しい frontend ZIP と receipt を作る

ZIP 名は毎回 UUID で変えます。ZIP と隣の `.json` receipt を保存して、再接続や再試行でも同じ artifact を使ってください。既存 ZIP / receipt は上書きしません。

```bash
FRONTEND_ZIP="$WORKSHOP_STATE_DIR/frontend-$(node -p 'require("node:crypto").randomUUID()').zip"
bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend-arm.sh" \
  "$RESOURCE_GROUP" prepare "$FRONTEND_ZIP" || exit 1
printf 'ZIP: %s\nReceipt: %s.json\n' "$FRONTEND_ZIP" "$FRONTEND_ZIP"
```

期待値は JSON の **`status: "prepared_not_deployed"`**、source revision、SHA-256、bytes です。これはデプロイ成功ではありません。`sourceDirty: true` の場合、未コミットの変更を含む可能性があるため、known-good release の証拠には使わず、変更をレビュー・commit してから新しい ZIP を準備します。他人の変更を reset / stash で消しません。

スクリプトは public registry の `npm ci --include=dev` → production build → routing copy → shared runtime config writer の順に実行します。ZIP の root に `index.html`、`staticwebapp.config.json`、`assets/` を配置し、3 IDs と `API_BASE_URL: "/api"`、routing、一意の config を検証します。Hidden/symlink files は拒否し、50 MiB を上限とします。

## 3. 許可済みの保管先へ ZIP だけを置く

ARM API は local file の直接送信ではなく、**Azure service が読み取れる HTTPS ZIP URL** を要求します。

先に、所有・利用が許可された保管先、費用、upload/read 権限、URL の有効期限、削除方法を確認してください。保管先がなければここで止めます。このスクリプトは Storage を作成せず、共有 Cloud Shell storage や GitHub を勝手に公開しません。新規 Storage、追加ロール、費用は別承認です。

許可済み保管先の upload 機能で、**手順 2 の ZIP だけ**を新しい一意の object 名へ upload します。Receipt は手元に保持し、archive/object は deployment 完了まで変更・上書きしません。組織の仕組みで短期・read-only の URL を取得し、upload・ARM の最大 15 分・readiness の最大 3 分に余裕を加えた有効期限を確保します。有効期限を無期限にしません。

URL は secret を含み得ます。Issue、チャット、shell history、command argument に貼らず、次の非表示入力だけに渡します。Bearer token は保管先へ送信しません。Redirect 先の URL や ZIP を自動で信頼しません。

## 4. ARM で送信し、今回の release を確認する

```bash
bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend-arm.sh" \
  "$RESOURCE_GROUP" deploy "$FRONTEND_ZIP" || exit 1
```

表示された prompt に temporary HTTPS URL を入力します。入力は非表示です。再接続した場合、`FRONTEND_ZIP` に保存済み ZIP の exact path を設定してから実行します。URL を環境変数やコマンド引数へ保存しません。

スクリプトが確認する順序:

| 段階 | 確認すること |
|---|---|
| Local artifact / context | receipt・SHA-256・size・runtime IDs・routing、saved subscription/tenant と実 Azure target |
| Hosted artifact | URL を credential なしで取得し、local ZIP と bytes / SHA-256 が一致すること |
| ARM upload | Azure CLI で matching ARM token を取得し、`properties.appZipUrl` だけを ZIP URL として送る。Token/SAS/response body をログに出さない |
| Completion | 200 と 202 を区別し、202 は trusted operation の terminal success を待つ。最大 15 分 / 120 polls、各 request 最大 30 秒 |
| Release / public readiness | 最大 3 分 / 6 attempts で direct health、SWA `/api/health`、published list、runtime config を確認。配信 `index.html` が exact prepared ZIP と一致すること |

期待値は JSON の **`status: "arm_release_public_checks_passed"`** と **`workshopReady: false`** です。古い instance が healthy なだけ、202 だけ、違う HTML が配信された場合は成功にしません。POST の自動再送はしないため、timeout 後は Azure operation 状態を確認してから再試行します。

実ブラウザーで MSAL sign-in、Backend scope、Unicode draft/published CRUD、既存 URL、private DB/KV、telemetry は [Day 1 の検証](day-1-validation.ja.html) で別途確認します。

## 5. Artifact を削除・失効する

今回の release が確認できたら、手順 3 の保管先で **今回 upload した object だけ**を削除し、temporary URL を失効します。所有者の方法で不在/失効を確認し、URL をログへ出しません。スクリプトは generic HTTPS host の削除権限を持たないため、これを自動で完了扱いしません。

Known-good rollback 用の local ZIP / receipt は必要な期間だけ保持し、再 deploy 時は承認済みの保管先へ同じ bytes を upload して新しい短期 URL を作ります。ZIP の内容を変更した場合は新規 artifact として prepare し直します。

## 6. 症状別に切り分ける

| 症状 | 確認と対処 |
|---|---|
| 保管先がない／upload 権限がない | 未承認 Storage の作成・追加権限付与はしない。許可済み保管先・費用・cleanup を確定するまで止める |
| Hosted ZIP の checksum / HTTP エラー | exact ZIP、URL 有効期限、read 権限、redirect 不使用を確認。ARM POST 前の失敗なので token/target を変更して回避しない |
| ARM HTTP 401/403 | saved tenant/subscription、token context と exact SWA への deploy 権限を確認。Contributor を自動昇格しない |
| Unsupported polling / Retry-After | safe error と operation 状態を確認。別 host へ token を送らず、completion を未確認とする |
| ARM 完了後に readiness が失敗 | exact HTML の配信、direct backend と Linked Backend を分けて確認。ZIP を再送する前に current operation/release を確認する |
| 必須 Entra 設定が異なる | Day 0 identity/state を確認し、新しい ZIP を prepare・upload する。既存 receipt を書き換えない |
| 古い host や `/api/api/posts` に送信される | ブラウザー Network で **現在の SWA host の `/api/posts`** を確認。exact HTML・runtime `/api`・配信 revision を照合する |

Legacy `scripts/deploy-frontend.sh` は SWA CLI 経路として履歴・互換性のため保持しますが、この ARM 手順からは実行しません。CLI audit の未解消を無視して fallback しないでください。[公式 GitHub Actions](day-1-github-actions-alternative.ja.html) は別の任意経路で、native image inventory と実 deploy の検証は別です。

## 次に進む

- [Day 1: アプリを検証](day-1-validation.ja.html)
