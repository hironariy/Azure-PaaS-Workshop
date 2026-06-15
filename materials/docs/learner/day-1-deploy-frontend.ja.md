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

## 2. Node.js、npm、SWA CLI を確認する

```bash
node --version
npm --version

az extension add --name staticwebapp --upgrade

npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
grep -q ".npm-global/bin" ~/.bashrc || echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc

npm install -g @azure/static-web-apps-cli
swa --version
```

Node.js 20 以上を推奨します。古い場合は講師に相談してください。

## 3. フロントエンド runtime config を作成する

`scripts/deploy-frontend.sh` は `scripts/deploy-frontend.local.env` から Entra ID の値を読み込みます。このファイルは gitignore されており、Client ID は公開設定値でシークレットではありません。

```bash
cat > scripts/deploy-frontend.local.env <<EOF
ENTRA_TENANT_ID="$TENANT_ID"
ENTRA_FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
ENTRA_BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
EOF

cat scripts/deploy-frontend.local.env
```

## 4. フロントエンドを build して Static Web Apps にデプロイする

既存の `scripts/deploy-frontend.sh` は、SWA 名と deployment token の取得、React build、runtime config 注入、Static Web Apps deploy まで実行します。

```bash
chmod +x scripts/deploy-frontend.sh
./scripts/deploy-frontend.sh "$RESOURCE_GROUP"
```

スクリプトは `staticwebapp.config.json` も `dist/` にコピーします。これにより SPA fallback と `/api/*` の Linked Backend routing 設定が Static Web Apps に反映されます。

期待値:

```text
✅ Deployment Complete!
Frontend URL: https://<swa-hostname>
```

## 5. SWA URL を確認する

```bash
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
```

## GitHub Actions を使う場合

Cloud Shell で手動デプロイせず GitHub Actions で backend/frontend をデプロイしたい場合は、任意の代替手順として [GitHub Actions でデプロイ（代替）](day-1-github-actions-alternative.ja.html) を参照してください。

## 次に進む

- [Day 1: アプリを検証](day-1-validation.ja.html)
