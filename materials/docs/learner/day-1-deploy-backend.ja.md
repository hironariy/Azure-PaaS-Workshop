---
title: "Day 1: バックエンドをデプロイ"
---

# Day 1: バックエンドをデプロイ

このページでは、`materials/backend` の Node.js / TypeScript アプリを Cloud Shell 上で build し、Azure App Service に ZIP deploy します。

## 1. 変数を復元する

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1

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

Node.js 24 LTS を推奨します。`zip` が見つからない場合は講師に相談してください。

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
| 引数と対象確認 | JSON state の RG・App Service と引数を比較し、subscription/tenant を検証する | 誤った対象への build/deploy を停止する |
| アプリ build | `npm ci --include=dev --registry=https://registry.npmjs.org` と `npm run build -- --outDir <専用一時ディレクトリ>/package/dist` を実行する | 公開 lockfile の build 用依存関係を復元し、既存 `dist` や他実行の ZIP を消さず build する |
| ZIP package 作成 | 実行ごとの `.deploy-XXXXXX/package/` に `package.json` / lockfile をコピーし、`npm ci --omit=dev --registry=https://registry.npmjs.org` で production 依存関係を入れて ZIP 化する | App Service 上で追加 build せず、必要なファイルだけを配置する |
| ZIP の検査 | `unzip -t` とパス区切りの確認を行う | 壊れた ZIP や Windows 形式の区切り文字による起動失敗を防ぐ |
| App Service 設定 | `SCM_DO_BUILD_DURING_DEPLOYMENT=false` と startup command `node dist/src/app.js` を設定する | App Service 側の remote build を避け、ZIP 内の build 済みアプリを起動する |
| ZIP deploy | `az webapp deploy --type zip --clean true --restart true --async true` を実行する | 既存ファイルを整理し、アップロード後に App Service を再起動する |
| 起動待ち | 20 秒後から最大 30 回、接続 5 秒・各要求 10 秒の上限付きで確認し、失敗間隔は 15 秒とする | HTTP 200 だけでなく JSON の `status: healthy` を要求し、通信失敗を区別する |
| 後片付け | 成功/失敗時にこの実行が作った一時ディレクトリだけを削除する | 既存 `deploy.zip`・`deploy-package`・リポジトリは消さない |

重要なポイントは、ZIP のルートに `dist/src/app.js` と `node_modules/` を含めることです。これにより、Dockerfile、`package.json`、startup command の `node dist/src/app.js` と App Service 上のファイル配置が一致します。

期待値:

```text
Readiness passed after ...s (HTTP 200, status=healthy).
Upload and readiness checks passed: https://<actual-hostname>
```

アップロード受付や既存インスタンスの health は、新しい release の完了証拠ではありません。Deployment Center の該当 deployment の完了と変更したアプリ内容を別途確認します。失敗時は非ゼロ終了し、成功メッセージを表示しません。

## 5. App Service 直接ヘルスチェックを確認する

```bash
APP_HOSTNAME="$(az webapp show --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" --query defaultHostName -o tsv)" || exit 1
curl --connect-timeout 5 --max-time 10 -fsS "https://${APP_HOSTNAME}/health" | jq .
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
