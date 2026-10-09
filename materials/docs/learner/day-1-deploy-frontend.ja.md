---
title: "Day 1: フロントエンドをデプロイ"
---

# Day 1: フロントエンドをデプロイ

Cloud Shell 上で React フロントエンドを build し、Static Web Apps にデプロイします。設定値は `index.html` に `window.__APP_CONFIG__` として注入します。

## 1. 変数を復元する

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1

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

Node.js 24 LTS を推奨します。古い場合は講師に相談してください。

## 3. フロントエンド runtime config の値を確認する

`scripts/deploy-frontend.sh` は version 付き JSON state から Entra ID と対象 SWA を読み込み、引数の RG・現在の subscription/tenant と一致することを確認します。旧 `deploy-frontend.local.env` は実行・自動移行しません。Client ID は公開設定値でシークレットではありません。

```bash
printf 'Tenant: %s\nFrontend: %s\nBackend: %s\n' "$TENANT_ID" "$FRONTEND_CLIENT_ID" "$BACKEND_CLIENT_ID"
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
Deployment Complete!
Frontend URL: https://<swa-hostname>
```

runtime config が Static Web Apps に反映されたことを確認します。`ENTRA_FRONTEND_CLIENT_ID` が空、`null`、または `window.__APP_CONFIG__=null;` のままだと、ログイン時に `AADSTS900144` が発生します。

```bash
curl -fsS "https://${SWA_HOSTNAME}" \
  | grep -o 'window.__APP_CONFIG__=[^<]*' \
  | grep 'ENTRA_FRONTEND_CLIENT_ID'
```

表示されない場合は、JSON state の ID と Day 0 の登録を確認し、このページの手順 1 から再実行します。

値が表示されるのにログインで `AADSTS900144` が続く場合は、`git pull` 後にこのページの手順 4 を再実行してください。古い手順では Cloud Shell の `NODE_ENV=development` が Vite build に引き継がれると、`window.__APP_CONFIG__` が無視される development bundle がデプロイされることがありました。このアプリは MSAL でログインするため、`/.auth/login/aad` には直接アクセスしません。

## 5. スクリプトの中身を確認する

`scripts/deploy-frontend.sh` は、React build、Static Web Apps 設定、runtime config 注入、SWA CLI deploy を順番に実行します。

| 処理 | スクリプトが行うこと | 意図 |
|---|---|---|
| 設定読み込み | `paas-workshop.json` をデータとして検証・復元する | 保存値をシェルコードとして実行せず、対象を再利用する |
| 必須値検証 | `ENTRA_TENANT_ID`、`ENTRA_FRONTEND_CLIENT_ID`、`ENTRA_BACKEND_CLIENT_ID` が空でないことを確認する | 未設定のまま build/deploy して認証エラーになることを防ぐ |
| Static Web Apps 情報取得 | 保存した SWA 名を明示的な subscription/RG で取得し hostname を比較する | `[0]` で別アプリを選ばず、CLI の失敗を「未作成」と扱わない |
| フロントエンド build | `materials/frontend` に移動し、`npm ci` と `NODE_ENV=production npm run build -- --mode production` を実行する | lockfile と本番設定から再現可能に build する |
| SWA routing 設定 | `staticwebapp.config.json` を `dist/` にコピーする | SPA fallback と `/api/*` の Linked Backend routing を Static Web Apps に反映する |
| runtime config 注入 | `dist/index.html` の `window.__APP_CONFIG__` 代入を Entra ID 設定と `API_BASE_URL: "/api"` を含む JSON に置換し、`ENTRA_FRONTEND_CLIENT_ID` が入ったことと development bundle でないことを検査する | build 後の静的ファイルに環境ごとの公開設定を埋め込み、`client_id` 欠落をデプロイ前に防ぐ |
| Static Web Apps deploy | token を直前に取得し、`SWA_CLI_DEPLOYMENT_TOKEN` をそのプロセスだけに渡して `swa deploy ./dist --env production` を実行する | token をコマンド引数やログに出さず production 環境へアップロードする |

`SWA_TOKEN` はデプロイ権限を持つシークレットです。末尾を含め一切表示しません。CLI の既知の依存脆弱性と公開 npm package の供給元問題は未解決です（#15）。ローカルの stub テストは実際の SWA deploy 成功を証明しません。

## 6. SWA URL を確認する

```bash
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
```

## GitHub Actions を使う場合

Cloud Shell で手動デプロイせず GitHub Actions で backend/frontend をデプロイしたい場合は、任意の代替手順として [GitHub Actions でデプロイ（代替）](day-1-github-actions-alternative.ja.html) を参照してください。

## 次に進む

- [Day 1: アプリを検証](day-1-validation.ja.html)
