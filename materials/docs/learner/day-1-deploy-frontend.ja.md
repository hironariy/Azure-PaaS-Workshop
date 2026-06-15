---
title: "Day 1: フロントエンドをデプロイ"
---

# Day 1: フロントエンドをデプロイ

Cloud Shell 上で React フロントエンドを build し、Static Web Apps にデプロイします。設定値は `index.html` に `window.__APP_CONFIG__` として注入します。

## 1. 変数を復元する

```bash
cd ~/Azure-PaaS-Workshop
source ~/paas-workshop.env

echo "$SWA_NAME"
echo "$SWA_HOSTNAME"
```

## 2. Node.js と npm を確認する

```bash
node --version
npm --version
```

Node.js 20 以上を推奨します。古い場合は講師に相談してください。

## 3. SWA CLI を Cloud Shell にインストールする

Cloud Shell のホームディレクトリ配下に npm global package を置きます。

```bash
az extension add --name staticwebapp --upgrade

npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
grep -q ".npm-global/bin" ~/.bashrc || echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc

npm install -g @azure/static-web-apps-cli
swa --version
```

## 4. フロントエンドを build する

```bash
cd ~/Azure-PaaS-Workshop/materials/frontend
npm ci
npm run build
```

期待値:

```text
dist/
```

## 5. Runtime config を注入する

```bash
export CONFIG_JSON="$(jq -nc \
  --arg tenant "$TENANT_ID" \
  --arg frontend "$FRONTEND_CLIENT_ID" \
  --arg backend "$BACKEND_CLIENT_ID" \
  '{ENTRA_TENANT_ID:$tenant,ENTRA_FRONTEND_CLIENT_ID:$frontend,ENTRA_BACKEND_CLIENT_ID:$backend,API_BASE_URL:"/api"}')"

node - <<'NODE'
const fs = require('fs');
const path = 'dist/index.html';
const config = process.env.CONFIG_JSON;
const html = fs.readFileSync(path, 'utf8');
if (!html.includes('window.__APP_CONFIG__=null;')) {
  throw new Error('window.__APP_CONFIG__ placeholder was not found.');
}
fs.writeFileSync(path, html.replace('window.__APP_CONFIG__=null;', `window.__APP_CONFIG__=${config};`));
NODE
```

注入結果を確認します。Client ID は公開設定値であり、シークレットではありません。

```bash
grep "window.__APP_CONFIG__" dist/index.html
```

## 6. Static Web Apps にデプロイする

```bash
export SWA_TOKEN="$(az staticwebapp secrets list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query "properties.apiKey" -o tsv)"

swa deploy ./dist \
  --deployment-token "$SWA_TOKEN" \
  --env production
```

## 7. SWA URL を確認する

```bash
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
```

## 次に進む

- [Day 1: アプリを検証](day-1-validation.ja.html)
