---
title: "Day 1: フロントエンドをデプロイ"
---

# Day 1: フロントエンドをデプロイ

Cloud Shell 上で React フロントエンドを build し、Static Web Apps にデプロイします。設定値は `index.html` に `window.__APP_CONFIG__` として注入します。

## 1. 変数を復元する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"

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

`scripts/deploy-frontend.sh` は `deploy-frontend.local.env` から Entra ID の値を読み込みます。このファイルは Azure Files 側の state ディレクトリに保存します。Client ID は公開設定値でシークレットではありません。

```bash
cat > "$WORKSHOP_STATE_DIR/deploy-frontend.local.env" <<EOF
ENTRA_TENANT_ID="$TENANT_ID"
ENTRA_FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
ENTRA_BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
EOF

cat "$WORKSHOP_STATE_DIR/deploy-frontend.local.env"
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

runtime config が Static Web Apps に反映されたことを確認します。`ENTRA_FRONTEND_CLIENT_ID` が空、`null`、または `window.__APP_CONFIG__=null;` のままだと、ログイン時に `AADSTS900144` が発生します。

```bash
curl -fsS "https://${SWA_HOSTNAME}" \
  | grep -o 'window.__APP_CONFIG__=[^<]*' \
  | grep 'ENTRA_FRONTEND_CLIENT_ID'
```

表示されない場合は、`$WORKSHOP_STATE_DIR/deploy-frontend.local.env` の値を確認し、このページの手順 3 から再実行します。

値が表示されるのにログインで `AADSTS900144` が続く場合は、ブラウザーに古い JavaScript bundle や `sessionStorage` が残っていないか確認し、サイトデータを削除して再読み込みします。このアプリは MSAL でログインするため、`/.auth/login/aad` には直接アクセスしません。

## 5. スクリプトの中身を確認する

`scripts/deploy-frontend.sh` は、React build、Static Web Apps 設定、runtime config 注入、SWA CLI deploy を順番に実行します。

| 処理 | スクリプトが行うこと | 意図 |
|---|---|---|
| 設定ファイル読み込み | `$WORKSHOP_STATE_DIR/deploy-frontend.local.env` を読み込み、CRLF の場合は LF に直す | Azure Files 側に保存した Entra ID 設定を再利用する |
| 必須値検証 | `ENTRA_TENANT_ID`、`ENTRA_FRONTEND_CLIENT_ID`、`ENTRA_BACKEND_CLIENT_ID` が空でないことを確認する | 未設定のまま build/deploy して認証エラーになることを防ぐ |
| Static Web Apps 情報取得 | リソースグループ内の Static Web App hostname と deployment token を Azure CLI で取得する | 手入力を減らし、SWA CLI deploy に必要な値を取得する |
| フロントエンド build | `materials/frontend` に移動し、`npm install` と `npm run build` を実行する | Vite の本番成果物を `dist/` に作成する |
| SWA routing 設定 | `staticwebapp.config.json` を `dist/` にコピーする | SPA fallback と `/api/*` の Linked Backend routing を Static Web Apps に反映する |
| runtime config 注入 | `dist/index.html` の `window.__APP_CONFIG__` 代入を Entra ID 設定と `API_BASE_URL: "/api"` を含む JSON に置換し、`ENTRA_FRONTEND_CLIENT_ID` が入ったことを検査する | build 後の静的ファイルに環境ごとの公開設定を埋め込み、`client_id` 欠落をデプロイ前に防ぐ |
| Static Web Apps deploy | `swa deploy ./dist --deployment-token "$SWA_TOKEN" --env production` を実行する | build 済み成果物を Static Web Apps の production 環境にアップロードする |

`deploy-frontend.local.env` の Client ID は公開設定値ですが、`SWA_TOKEN` はデプロイ権限を持つためシークレットとして扱います。スクリプトは token 全体を表示せず、末尾だけを確認用に出力します。

## 6. SWA URL を確認する

```bash
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
```

## GitHub Actions を使う場合

Cloud Shell で手動デプロイせず GitHub Actions で backend/frontend をデプロイしたい場合は、任意の代替手順として [GitHub Actions でデプロイ（代替）](day-1-github-actions-alternative.ja.html) を参照してください。

## 次に進む

- [Day 1: アプリを検証](day-1-validation.ja.html)
