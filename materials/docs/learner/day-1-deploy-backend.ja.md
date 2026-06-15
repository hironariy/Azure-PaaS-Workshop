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

## 4. スクリプトの中身を確認する

`scripts/deploy-backend.sh` は、手作業で行うと間違えやすい build、ZIP package 作成、App Service 設定、正常性確認を順番に実行します。

| 処理 | スクリプトが行うこと | 意図 |
|---|---|---|
| 引数と作業ディレクトリ確認 | `<resource-group>` と `<app-service-name>` を受け取り、`materials/backend` に移動する | 誤ったリソースやディレクトリにデプロイしない |
| アプリ build | `npm install` と `npm run build` を実行する | TypeScript を Cloud Shell 側で JavaScript に変換する |
| ZIP package 作成 | `dist/` に `package.json` / `package-lock.json` をコピーし、`npm ci --omit=dev` で production 依存関係だけを入れてから ZIP 化する | App Service 上で追加 build せず、実行に必要なファイルだけを配置する |
| ZIP の検査 | `unzip -t` とパス区切りの確認を行う | 壊れた ZIP や Windows 形式の区切り文字による起動失敗を防ぐ |
| App Service 設定 | `SCM_DO_BUILD_DURING_DEPLOYMENT=false` と startup command `node src/app.js` を設定する | App Service 側の remote build を避け、ZIP 内の build 済みアプリを起動する |
| ZIP deploy | `az webapp deploy --type zip --clean true --restart true --async true` を実行する | 既存ファイルを整理し、アップロード後に App Service を再起動する |
| 起動待ち | `/health` を 20 秒後から最大 30 回、15 秒間隔で確認する | VNet Integration、Key Vault reference、DB 接続の初期化待ちを吸収する |
| 後片付け | 成功/失敗時に `deploy.zip` を削除する | Cloud Shell 作業ディレクトリに不要な成果物を残さない |

重要なポイントは、ZIP のルートが `dist/` ディレクトリそのものではなく、`src/app.js` と `node_modules/` を含む実行ファイル群になることです。これにより、startup command の `node src/app.js` と App Service 上のファイル配置が一致します。

期待値:

```text
✅ App is healthy! (HTTP 200)
Deployment successful!
```

## 5. App Service 直接ヘルスチェックを確認する

```bash
curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
```

期待値:

```json
{
  "status": "healthy"
}
```

## 6. ログを確認する

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
