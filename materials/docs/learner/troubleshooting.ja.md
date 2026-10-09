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

`az ad app permission add` は API permission の**要求**であり、実際の同意ではありません。Portal の **App registrations > Frontend > API permissions** は要求を表示します。実際の同意は本線では MSAL のブラウザーサインインで行い、CLI grant は実行しません。Day 0 時点で grant がないこと自体は失敗ではありません。

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
- サインイン後の grant の `resourceId` が Backend **service principal object ID**、`scope` に `access_as_user`、自己同意の場合は `consentType: Principal` と対象ユーザーの `principalId`。詳細は [Day 0 の同意検証](day-0-entra-id.ja.html#day-1-のサインイン後に自己同意を検証する) を参照します。

CLI では見えるのに Portal で見えない場合は、ブラウザー更新、Portal 再ログイン、正しい tenant と Frontend app registration を開いているかを確認します。

## 「管理者の承認が必要」または同意操作で権限不足になる

Azure Contributor/Owner、アプリ所有者、Application Developer は、テナント全体への同意権限と同義ではありません。Backend scope が `type: User` でもユーザー同意ポリシーによって拒否されます。

tenant、Frontend/Backend client ID、scope、CLI バージョン、エラーコードと correlation ID、PIM ロールの有効化状態を確認します。トークンやシークレットは共有しません。Graph の読み取り権限不足は「grant が存在しない」と区別します。

`az ad app permission grant` の consent type 省略は `AllPrincipals` です。`Principal` へ変えて再実行するだけの回避も既存 grant の置換につながるため行いません。本線がポリシーでブロックされた場合は記録して停止し、テナントポリシーを勝手に変更しません。別途承認した管理者例外の依頼内容・確認手順は [インストラクターガイド（GitHub 上の補足資料）](https://github.com/hironariy/Azure-PaaS-Workshop/blob/main/docs/instructor-guide.ja.md) を参照します。

## ログイン時に `AADSTS900144` が出る

症状:

```text
AADSTS900144: The request body must contain the following parameter: 'client_id'.
```

原因:

- Static Web Apps にデプロイされた `index.html` の `window.__APP_CONFIG__` に `ENTRA_FRONTEND_CLIENT_ID` が入っていない。
- `$WORKSHOP_STATE_DIR/deploy-frontend.local.env` の値が空、または古い frontend 成果物を再デプロイしている。

確認:

```bash
curl -fsS "https://${SWA_HOSTNAME}" \
  | grep -o 'window.__APP_CONFIG__=[^<]*'

cat "$WORKSHOP_STATE_DIR/deploy-frontend.local.env"
```

期待値は `window.__APP_CONFIG__` に `ENTRA_FRONTEND_CLIENT_ID`、`ENTRA_TENANT_ID`、`ENTRA_BACKEND_CLIENT_ID` が含まれることです。

`window.__APP_CONFIG__` が正しいのに同じエラーが続く場合は、古いデプロイスクリプトで Vite の development bundle をデプロイしている可能性があります。`git pull` 後に `./scripts/deploy-frontend.sh "$RESOURCE_GROUP"` を再実行してください。スクリプトは `NODE_ENV=production` を強制し、development bundle が混入した場合はデプロイ前に停止します。また、このワークショップ本線では Static Web Apps 組み込み認証の `/.auth/login/aad` ではなく、アプリ画面の **Sign in with Microsoft** ボタンから MSAL でログインします。

対処:

```bash
cat > "$WORKSHOP_STATE_DIR/deploy-frontend.local.env" <<EOF
ENTRA_TENANT_ID="$TENANT_ID"
ENTRA_FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
ENTRA_BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
EOF

./scripts/deploy-frontend.sh "$RESOURCE_GROUP"
```

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
