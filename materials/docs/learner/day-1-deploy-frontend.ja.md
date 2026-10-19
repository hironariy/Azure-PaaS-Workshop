---
title: "Day 1: フロントエンドのデプロイ"
---

# Day 1: フロントエンドのデプロイ

Cloud Shell 上で React フロントエンド（`materials/frontend`）をビルドし、Azure Static Web Apps へデプロイします。

## 1. 変数とツールを確認する

> 💡 Cloud Shell が再接続されて変数が消えた場合のみ、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load deployed` を先に実行してください。

```bash
node --version
npm --version
az version
command -v zip
command -v unzip
printf 'SWA: %s\nHost: %s\n' "$SWA_NAME" "$SWA_HOSTNAME"
printf 'Tenant: %s\nFrontend: %s\nBackend: %s\n' "$TENANT_ID" "$FRONTEND_CLIENT_ID" "$BACKEND_CLIENT_ID"
```

Static Web Apps 名、ホスト名、Entra ID の各 ID が表示されることを確認します。

### SWA CLI をユーザー領域にインストールする

Cloud Shell の既定のグローバルインストール先（`/usr/lib/node_modules` など）は一般ユーザーでは書き込めないため、インストール先をユーザー領域の `$HOME/.local` に指定します。実行ファイルの保存先（`$HOME/.local/bin`）を `PATH` に追加してから、SWA CLI が見つからない場合だけインストールします。

```bash
export PATH="$HOME/.local/bin:$PATH"
(command -v swa || npm install --global --prefix "$HOME/.local" @azure/static-web-apps-cli@2.0.10) &&
  swa --version
```

SWA CLI のバージョンが表示されることを確認してから、手順 2 へ進んでください。新規インストールした場合は `2.0.10` が表示されます。インストールが失敗した場合は次へ進まず、表示された npm のエラーを確認してください。

> **Cloud Shell に再接続した場合も、このコマンドブロックを再実行してください。** `PATH` は現在のシェルと、そこから実行するデプロイスクリプトに引き継がれますが、`workshop_state_load deployed` では復元されません。インストール済みなら再インストールは不要です。`sudo npm install` や `/usr` 配下の権限変更は行いません。

## 2. フロントエンドをビルドして Static Web Apps へデプロイする

リポジトリに含まれる `scripts/deploy-frontend.sh` を実行します。

```bash
cd "$WORKSHOP_REPO_DIR"
./scripts/deploy-frontend.sh "$RESOURCE_GROUP"
```

このスクリプトは内部で次の処理を順番に実行します。

1. 保存済みの設定値（`paas-workshop.json`）から Static Web Apps 名と Entra ID の設定値を読み取り、SPA リダイレクト URI や `access_as_user` スコープ設定を確認します。
2. `materials/frontend` で `npm ci` と `npm run build`（本番モード）を実行します。
3. ビルド成果物（`dist/`）に、実行時設定ファイル（`runtime-config.js`）と `index.html` の `window.__APP_CONFIG__` を注入します。
4. Azure Static Web Apps のデプロイトークンを一時取得し、Static Web Apps CLI（`@azure/static-web-apps-cli`）を使って本番環境（`production`）へデプロイします。

完了すると、`Deployment Complete!` と公開 URL（`Frontend URL: https://<SWA_HOSTNAME>`）が表示されます。

## 3. デプロイ結果を確認する

公開 URL に対して、HTML とランタイム設定、および Linked Backend 経由の API 応答を確認します。

```bash
curl -fsS "https://${SWA_HOSTNAME}" | grep -o 'window.__APP_CONFIG__=[^<]*'
curl -fsS "https://${SWA_HOSTNAME}/api/health"
echo ""
```

- `window.__APP_CONFIG__` に `ENTRA_FRONTEND_CLIENT_ID`、`ENTRA_TENANT_ID`、`ENTRA_BACKEND_CLIENT_ID`、`"API_BASE_URL":"/api"` が含まれていること。
- `/api/health` から `"status":"healthy"` を含む JSON が返ること。

---

## 補足: ARM ZIP API を使ったデプロイ手順（代替方式）

社内ネットワークやセキュリティポリシーの都合で Static Web Apps CLI（`@azure/static-web-apps-cli`）を利用しない場合は、[Azure Resource Manager の Static Sites ZIP デプロイ API](https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/create-zip-deployment-for-static-site?view=rest-appservice-2025-05-01) を使う `scripts/deploy-frontend-arm.sh` でもデプロイできます。

以下では、演習用リソースグループに一時的な Blob Storage を作成し、ZIP をアップロードして、**読み取り専用・有効期限 1 時間のユーザー委任 SAS** でデプロイします。SWA CLI と Storage Account キーは使用しません。各コマンドブロックが正常終了したことを確認してから次へ進んでください。

> **前提と注意:**
> - Day 1 のインフラデプロイと状態ファイル（`paas-workshop.json`）の保存が完了していること。再接続した場合は、このページの手順 1 にある `workshop_state_load deployed` で変数を復元してください。
> - 演習の前提であるサブスクリプションの **Owner** として、一時 Storage Account の作成と、自分への `Storage Blob Data Contributor` の割り当てを行います。Owner だけでは Blob データへのアクセス権限は付与されません。
> - ARM 側から ZIP を取得するため、Blob の公開ネットワークエンドポイントを有効にしますが、**匿名アクセスと共有キー認証は禁止**します。ARM には SAS で対象 ZIP の読み取りだけを許可します。組織ポリシーで公開エンドポイントが禁止されている場合は、ポリシーを変更せず、講師に承認済みの配置先を確認してください。
> - 一時 Storage Account は `Standard_LRS` を使用し、少額のストレージ・転送料金が発生します。デプロイ完了後に削除してください。スクリプトが Storage を自動作成するわけではなく、以下の手順で受講者が作成します。

### 1. デプロイ用 ZIP パッケージを作成する (`prepare`)

```bash
FRONTEND_ZIP="$WORKSHOP_STATE_DIR/frontend-$(node -p 'require("node:crypto").randomUUID()').zip"
bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend-arm.sh" "$RESOURCE_GROUP" prepare "$FRONTEND_ZIP"
```

ZIP と、同じ場所の検証用ファイル（`$FRONTEND_ZIP.json`）が作成されます。両方をデプロイ完了まで保持してください。Blob Storage にアップロードするのは ZIP のみです。

### 2. 一時 Storage Account を作成し、自分にデータアクセス権限を付与する

Storage Account 名はグローバルで一意である必要があるため、小文字と乱数で生成します。リージョン、リソースグループ、サブスクリプションは演習の既存変数を使用します。

```bash
TEMP_STORAGE_ACCOUNT="stpaaszip$(node -p 'require("node:crypto").randomBytes(6).toString("hex")')"
TEMP_CONTAINER="frontend-artifacts"

(
  set -euo pipefail
  az provider register --subscription "$SUBSCRIPTION_ID" --namespace Microsoft.Storage --wait
  az storage account create --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$TEMP_STORAGE_ACCOUNT" --location "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 \
    --allow-blob-public-access false --allow-shared-key-access false \
    --public-network-access Enabled --default-action Allow \
    --tags Workshop=Azure-PaaS-Workshop Purpose=frontend-zip --output none

  TEMP_STORAGE_ID="$(az storage account show --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$TEMP_STORAGE_ACCOUNT" --query id -o tsv)"
  SIGNED_IN_USER_ID="$(az ad signed-in-user show --query id -o tsv)"
  if [ -z "$TEMP_STORAGE_ID" ] || [ -z "$SIGNED_IN_USER_ID" ]; then
    echo "Storage Account ID または本人の Object ID を取得できませんでした。権限付与を中止します。" >&2
    exit 1
  fi
  az role assignment create --subscription "$SUBSCRIPTION_ID" \
    --assignee-object-id "$SIGNED_IN_USER_ID" --assignee-principal-type User \
    --role "Storage Blob Data Contributor" --scope "$TEMP_STORAGE_ID" --output none

  az storage account show --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$TEMP_STORAGE_ACCOUNT" \
    --query '{name:name,sku:sku.name,anonymousAccess:allowBlobPublicAccess,sharedKeyAccess:allowSharedKeyAccess,httpsOnly:enableHttpsTrafficOnly}' \
    -o jsonc
)
```

`sku` が `Standard_LRS`、`anonymousAccess` と `sharedKeyAccess` が `false`、`httpsOnly` が `true` であることを確認します。ロールは一時 Storage Account のスコープだけに割り当てます。

> ロールの反映には数分かかることがあります。次の手順で `AuthorizationPermissionMismatch` や `AuthorizationFailure` が出た場合は、数分待って同じコマンドブロックを再実行してください。Storage Account を作り直したり、共有キー認証を有効にしたりする必要はありません。

### 3. 非公開コンテナーに ZIP をアップロードする

Blob 名は手順 1 で作成した ZIP のファイル名を使用します。コンテナー作成・アップロードともに `--auth-mode login` を指定し、Cloud Shell にサインインしている本人の Entra ID で認証します。

```bash
TEMP_BLOB="$(basename "$FRONTEND_ZIP")"
(
  set -euo pipefail
  az storage container create --subscription "$SUBSCRIPTION_ID" \
    --account-name "$TEMP_STORAGE_ACCOUNT" --name "$TEMP_CONTAINER" \
    --auth-mode login --public-access off --output none
  az storage blob upload --subscription "$SUBSCRIPTION_ID" \
    --account-name "$TEMP_STORAGE_ACCOUNT" --container-name "$TEMP_CONTAINER" \
    --name "$TEMP_BLOB" --file "$FRONTEND_ZIP" --content-type application/zip \
    --auth-mode login --overwrite true --output none
  az storage blob show --subscription "$SUBSCRIPTION_ID" \
    --account-name "$TEMP_STORAGE_ACCOUNT" --container-name "$TEMP_CONTAINER" \
    --name "$TEMP_BLOB" --auth-mode login \
    --query '{name:name,bytes:properties.contentLength}' -o jsonc
)
```

`name` がアップロードした ZIP のファイル名、`bytes` が 0 より大きいことを確認します。

### 4. 読み取り専用 SAS を発行してデプロイする (`deploy`)

`--as-user --auth-mode login` でユーザー委任 SAS を発行します。権限は対象 Blob の読み取り（`r`）のみ、通信は HTTPS のみ、有効期限は現在から 1 時間です。SAS URL は秘密情報として扱い、表示・履歴への貼り付け・JSON への保存をせず、標準入力でデプロイスクリプトへ渡します。

```bash
(
  set +x
  set -euo pipefail
  SAS_EXPIRY="$(node -p 'new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z")')"
  ARTIFACT_URL="$(az storage blob generate-sas --subscription "$SUBSCRIPTION_ID" \
    --account-name "$TEMP_STORAGE_ACCOUNT" --container-name "$TEMP_CONTAINER" \
    --name "$TEMP_BLOB" --permissions r --expiry "$SAS_EXPIRY" \
    --auth-mode login --as-user --https-only --full-uri -o tsv)"
  if [ -z "$ARTIFACT_URL" ]; then
    echo "SAS URL を取得できませんでした。権限と有効期限を確認してください。" >&2
    exit 1
  fi
  printf 'SAS の有効期限 (UTC): %s（URL は非表示）\n' "$SAS_EXPIRY"
  printf '%s\n' "$ARTIFACT_URL" |
    bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend-arm.sh" "$RESOURCE_GROUP" deploy "$FRONTEND_ZIP"
)
```

SAS URL は丸括弧内の処理が終わると破棄されます。`set -x` や Azure CLI の `--debug` は使用しないでください。出力の `status` が `arm_release_public_checks_passed` になり、公開された HTML と API の確認が成功したことを確認します。このページの手順 3 でも配信結果を確認し、ブラウザーでのサインインと記事 CRUD は次ページのアプリ検証で別途確認してください。

### 5. SAS を失効させ、一時 Storage Account を削除する

**ARM デプロイと公開確認が終わってから**実行してください。使用中の SAS を失効させると ZIP の取得に失敗します。以下は、この手順で作成した一時 Storage Account だけを対象にし、演習のリソースグループ自体は削除しません。

```bash
(
  set -euo pipefail
  az storage account revoke-delegation-keys --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$TEMP_STORAGE_ACCOUNT" --output none
  az storage account delete --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --name "$TEMP_STORAGE_ACCOUNT" --yes
  REMAINING="$(az storage account list --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$RESOURCE_GROUP" --query "[?name=='$TEMP_STORAGE_ACCOUNT'].name" -o tsv)"
  if [ -n "$REMAINING" ]; then
    echo "一時 Storage Account が残っています。削除結果を確認してください。" >&2
    exit 1
  fi
  printf '一時 Storage Account を削除しました: %s\n' "$TEMP_STORAGE_ACCOUNT"
)
```

Storage Account の削除でコンテナーと ZIP も削除されます。`revoke-delegation-keys` はそのアカウントのすべてのユーザー委任キーを失効させるため、他の用途の既存 Storage Account には実行しないでください。途中で作業を中断した場合も、進行中のデプロイがないことを確認して一時 Storage Account を削除してください。

### 代替方式でエラーになった場合

| 症状 | 確認と対処 |
|---|---|
| Storage Account の作成やロール割り当てが拒否される | 対象サブスクリプションの Owner と PIM の有効化を確認します。`RequestDisallowedByPolicy` の場合は制約を回避せず、講師に承認済みの配置先を確認してください。 |
| コンテナー作成・アップロード・SAS 発行で `403` になる | `Storage Blob Data Contributor` が自分に一時 Storage Account のスコープで付与されているか確認し、数分待って再試行します。Owner と Blob データアクセス権限は別です。 |
| `Hosted ZIP HTTP 403` や ARM 側の ZIP 取得エラーになる | SAS の期限、アップロードした Blob 名、公開ネットワークの許可を確認します。Cloud Shell の IP だけに制限すると ARM 側から取得できません。ZIP を残したまま手順 4 で SAS を再発行して再実行してください。 |
| `Hosted ZIP checksum/size differs` が出る | 手順 1 と異なる ZIP をアップロードしていないか確認します。ローカルの ZIP と検証用 JSON を保持し、同じ ZIP を手順 3 で再アップロードしてください。 |
| Cloud Shell の再接続で一時変数が消えた | 状態ファイルを復元し、手順 2 のタグ `Purpose=frontend-zip` が付いた自分の一時アカウント名と、手順 1 の ZIP パスを確認して `TEMP_STORAGE_ACCOUNT`、`TEMP_CONTAINER`、`FRONTEND_ZIP`、`TEMP_BLOB` を再設定します。これらの一時変数と SAS は `paas-workshop.json` には保存しません。 |

参考: [Azure CLI でユーザー委任 SAS を作成する](https://learn.microsoft.com/azure/storage/blobs/storage-blob-user-delegation-sas-create-cli)

## 次に進む

- [Day 1: アプリケーションの動作確認](day-1-validation.ja.html)
