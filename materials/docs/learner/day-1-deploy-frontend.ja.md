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

npm install -g @azure/static-web-apps-cli@2.0.10 --registry=https://registry.npmjs.org
swa --version
```

Node.js 24 LTS を推奨します。古い場合は講師に相談してください。

**SWA CLI の残存脆弱性:** 2026-10-13 の公開 npm 監査では、検証した CLI 2.0.10 の依存関係に High 5 件・Low 1 件が残っています。今回の方針は残存リスクを明記したうえでの CLI 機能検証であり、脆弱性ゼロや [Issue #15](https://github.com/hironariy/Azure-PaaS-Workshop/issues/15) の解決を意味しません。ローカル開発サーバーや任意の配布物の展開には使わず、自分のグループの配備先と build 済み成果物だけを扱います。新しい CLI へ変更する場合は監査と配備を再確認してください。

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

スクリプトは `materials/frontend` から `swa deploy ./dist` を実行します。`cd dist` してから実行しないでください。検証した配備クライアントは、作業ディレクトリが成果物ディレクトリと同一、またはその内側にあると `Current directory cannot be identical to or contained within artifact folders` で失敗します。また、`swa deploy --dry-run` の終了コードだけでは実配備やサーバー側の検証成功を確認できません。

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

値が表示されるのにログインで `AADSTS900144` が続く場合は、`git pull` 後にこのページの手順 4 を再実行してください。古い手順では Cloud Shell の `NODE_ENV=development` が Vite build に引き継がれると、`window.__APP_CONFIG__` が無視される development bundle がデプロイされることがありました。このアプリは MSAL でログインするため、`/.auth/login/aad` には直接アクセスしません。

## 5. スクリプトの中身を確認する

`scripts/deploy-frontend.sh` は、React build、Static Web Apps 設定、runtime config 注入、SWA CLI deploy を順番に実行します。

| 処理 | スクリプトが行うこと | 意図 |
|---|---|---|
| 設定ファイル読み込み | `$WORKSHOP_STATE_DIR/deploy-frontend.local.env` を読み込み、CRLF の場合は LF に直す | Azure Files 側に保存した Entra ID 設定を再利用する |
| 必須値検証 | `ENTRA_TENANT_ID`、`ENTRA_FRONTEND_CLIENT_ID`、`ENTRA_BACKEND_CLIENT_ID` が空でないことを確認する | 未設定のまま build/deploy して認証エラーになることを防ぐ |
| Static Web Apps 情報取得 | 保存した `SWA_NAME` で hostname と deployment token を取得する。名前が未設定なら、対象 RG に SWA が 1 件だけの場合に限る | 複数の SWA から先頭を選ばず、自分の配備先に限定する |
| フロントエンド build | `materials/frontend` に移動し、公開 npm から `npm ci --include=dev` と `NODE_ENV=production npm run build -- --mode production` を実行する | lockfile を維持し、Vite の本番成果物を `dist/` に作成する |
| SWA routing 設定 | `staticwebapp.config.json` を `dist/` にコピーする | SPA fallback と `/api/*` の Linked Backend routing を Static Web Apps に反映する |
| runtime config 注入 | `dist/index.html` の `window.__APP_CONFIG__` 代入を Entra ID 設定と `API_BASE_URL: "/api"` を含む JSON に置換し、`ENTRA_FRONTEND_CLIENT_ID` が入ったことと development bundle でないことを検査する | build 後の静的ファイルに環境ごとの公開設定を埋め込み、`client_id` 欠落をデプロイ前に防ぐ |
| Static Web Apps deploy | `SWA_CLI_DEPLOYMENT_TOKEN` をコマンドの環境変数として渡し、`swa deploy ./dist --env production --no-use-keychain --verbose log` を実行する | token を引数に渡さず、OS の資格情報ストアへ保存しない |
| 公開後の確認 | 公開 HTML が今回の `dist/index.html` と一致するまで最大 12 回確認し、`/api/health` の HTTP 成功と `status=healthy` を確認する | CLI の成功表示だけでなく、実際の配備と Linked Backend 接続を確認する。失敗したら手順を止める |

`deploy-frontend.local.env` の Client ID は公開設定値ですが、`SWA_TOKEN` はデプロイ権限を持つためシークレットとして扱います。スクリプトは token の一部も表示せず、引数や設定ファイルに保存しません。`--verbose silly` やシェルトレースで診断しないでください。

## 6. SWA URL を確認する

```bash
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
curl -fsS "https://$SWA_HOSTNAME/api/health"
```

期待値は HTTP 200 と `"status":"healthy"` です。表示ページだけでなく、SWA 経由で実バックエンドへ接続できることを確認します。

ログインの前に、[インフラ配備の手順 7](day-1-deploy-infrastructure.ja.html)で、同じ SWA URL を Frontend アプリの **SPA** リダイレクト URI に追加したことも確認します。フロントエンドのアップロードは Entra の URI 設定を更新しません。

## GitHub Actions を使う場合

Cloud Shell で手動デプロイせず GitHub Actions で backend/frontend をデプロイしたい場合は、任意の代替手順として [GitHub Actions でデプロイ（代替）](day-1-github-actions-alternative.ja.html) を参照してください。

## 次に進む

- [Day 1: アプリを検証](day-1-validation.ja.html)
