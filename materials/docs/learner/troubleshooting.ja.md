---
title: トラブルシューティング
---

# トラブルシューティング

Cloud Shell 専用手順で詰まりやすい問題を、症状別に確認します。

## Cloud Shell の変数が空になる

症状:

```bash
echo "$RESOURCE_GROUP"
```

が空になる。

対処:

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cat "$WORKSHOP_STATE_DIR/paas-workshop.env"
```

ファイルが無い場合は [受講者クイックスタート](cloud-shell-quickstart.ja.html) から変数を再設定します。

## Provider 登録で失敗する

症状:

```text
AuthorizationFailed
```

可能性:

- サブスクリプションに対する権限が不足している。
- 講師指定のサブスクリプションを選択していない。

確認:

```bash
az account show --output table
az role assignment list --assignee "$(az ad signed-in-user show --query id -o tsv)" --all -o table
```

## Entra ID app registration を作成できない

症状:

```text
Insufficient privileges
```

対処:

- 講師から `TENANT_ID`、`BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` を受け取ります。
- 受け取った値を Azure Files 側の state ファイルに保存します。

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
mkdir -p "$WORKSHOP_STATE_DIR"

cat >> "$WORKSHOP_STATE_DIR/paas-workshop.env" <<EOF
export TENANT_ID="<tenant-id>"
export BACKEND_CLIENT_ID="<backend-client-id>"
export FRONTEND_CLIENT_ID="<frontend-client-id>"
EOF
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
```

## Bicep デプロイが失敗する

まず詳細を確認します。

```bash
az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.error" -o jsonc
```

よくある原因:

| 症状 | 確認 |
|---|---|
| SKU quota | App Service Plan / Cosmos DB tier の quota |
| region unavailable | `LOCATION` と `SWA_LOCATION` |
| invalid password | `COSMOS_PASSWORD` が空でないか |
| app registration mismatch | `BACKEND_CLIENT_ID` / `FRONTEND_CLIENT_ID` |

## App Service `/health` が失敗する

```bash
az webapp log tail \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

確認ポイント:

- backend ZIP deploy が完了しているか。
- App Service の startup command が `node dist/src/app.js` になっているか。
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` が設定されているか。
- Key Vault reference が解決できているか。
- Cosmos DB 接続で失敗していないか。

```bash
az webapp config show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{startupFile:appCommandLine,linuxFxVersion:linuxFxVersion}" \
  -o jsonc

az webapp config appsettings list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='SCM_DO_BUILD_DURING_DEPLOYMENT' || name=='COSMOS_CONNECTION_STRING'].{name:name,value:value}" \
  -o table
```

### `Cannot find module '/home/site/wwwroot/src/app.js'`

原因:

- 古い手順または古いスクリプトで App Service の startup command が `node src/app.js` のままになっている。
- ZIP deploy が完了する前に App Service が再起動し、まだ起動ファイルが配置されていない。

対処:

```bash
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --startup-file "node dist/src/app.js"

./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

`az webapp deploy` の出力が `Warmed up Kudu instance successfully.` でしばらく止まって見える場合があります。Cloud Shell から ZIP をアップロードしている間は追加ログが出ないことがあるため、数分待ってから App Service logs と `/health` を確認します。

## SWA `/api/health` が 404

可能性:

- フロントエンド成果物が Static Web Apps にまだデプロイされていない。
- Static Web Apps が Standard SKU ではない。
- Linked Backend が作成されていない。

確認:

```bash
az staticwebapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query "{name:name,sku:sku,defaultHostname:defaultHostname}" -o jsonc

az resource list \
  --resource-group "$RESOURCE_GROUP" \
  --resource-type "Microsoft.Web/staticSites/linkedBackends" \
  -o table
```

## サインイン後に戻れない

Frontend SPA app registration の redirect URI を確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

`https://<swa-hostname>` が無い場合は追加します。

```bash
REDIRECT_URIS="$(jq -nc --arg swa "https://$SWA_HOSTNAME" '["http://localhost:4280", $swa, ($swa + "/")]')"

FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)"

if [ -z "$FRONTEND_OBJECT_ID" ]; then
  echo "FRONTEND_OBJECT_ID を取得できませんでした。FRONTEND_CLIENT_ID=$FRONTEND_CLIENT_ID を確認してください。"
  exit 1
fi

SPA_PATCH="$(jq -nc --argjson redirectUris "$REDIRECT_URIS" '{
  spa: {
    redirectUris: $redirectUris
  }
}')"

az rest \
  --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$FRONTEND_OBJECT_ID" \
  --body "$SPA_PATCH"
```

## Frontend の API permissions が Portal に表示されない

`az ad app permission add` は Frontend app registration の API permission 要求を追加し、`az ad app permission grant` は Frontend service principal に delegated permission grant を作成します。Portal の **App registrations > Frontend > API permissions** は前者を表示しますが、反映に時間がかかることがあります。

CLI で状態を確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "requiredResourceAccess[?resourceAppId=='$BACKEND_CLIENT_ID']" \
  -o jsonc

az ad app permission list-grants \
  --id "$FRONTEND_CLIENT_ID" \
  -o jsonc
```

期待値:

- `requiredResourceAccess[].resourceAppId` が `$BACKEND_CLIENT_ID`
- `requiredResourceAccess[].resourceAccess[].id` が `$ACCESS_SCOPE_ID`
- `list-grants` の `scope` に `access_as_user`

CLI では見えるのに Portal で見えない場合は、ブラウザー更新、Portal 再ログイン、正しい tenant と Frontend app registration を開いているかを確認します。

## フロントエンド build が失敗する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR/materials/frontend"
node --version
npm --version
npm ci
npm run build
```

Node.js が古い場合、Cloud Shell 環境差異の可能性があります。講師に相談してください。

## バックエンド build / ZIP deploy が失敗する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
node --version
npm --version
zip -v | head -1
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

確認ポイント:

- `materials/backend/package-lock.json` が存在する。
- `npm run build` が成功している。
- `deploy.zip` の中身に `dist/src/app.js` があり、パスが `/` 区切りになっている。
- App Service logs に `Cannot find module` や Key Vault reference のエラーが出ていない。
