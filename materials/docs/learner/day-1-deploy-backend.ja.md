---
title: "Day 1: バックエンドをデプロイ"
---

# Day 1: バックエンドをデプロイ

このページでは、`materials/backend` の Node.js / TypeScript アプリを Cloud Shell 上で build し、Azure App Service に ZIP deploy します。

## 1. 変数を復元する

```bash
cd ~/Azure-PaaS-Workshop
source ~/paas-workshop.env

echo "$RESOURCE_GROUP"
echo "$APP_SERVICE_NAME"
```

## 2. build/deploy に必要なツールを確認する

```bash
node --version
npm --version
zip -v | head -1
az webapp deploy --help | head -20
```

Node.js 20 以上を推奨します。`zip` が見つからない場合は講師に相談してください。

## 3. バックエンドを build して App Service にデプロイする

既存の `scripts/deploy-backend.sh` は、依存関係のインストール、TypeScript build、production 依存関係のみの ZIP 作成、App Service 設定、ZIP deploy、`/health` のポーリングまで実行します。

```bash
chmod +x scripts/deploy-backend.sh
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

期待値:

```text
✅ App is healthy! (HTTP 200)
Deployment successful!
```

## 4. App Service 直接ヘルスチェックを確認する

```bash
curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
```

期待値:

```json
{
  "status": "healthy"
}
```

## 5. ログを確認する

起動に失敗した場合は App Service logs を確認します。

```bash
az webapp log tail \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

終了するときは `Ctrl+C` を押します。

## GitHub Actions を使う場合

Cloud Shell で手動デプロイせず GitHub Actions で backend/frontend をデプロイしたい場合は、任意の代替手順として [GitHub Actions でデプロイ（代替）](day-1-github-actions-alternative.ja.html) を参照してください。

## 次に進む

- [Day 1: フロントエンドをデプロイ](day-1-deploy-frontend.ja.html)
