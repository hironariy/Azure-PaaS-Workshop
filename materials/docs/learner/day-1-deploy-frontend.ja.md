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

npm install -g @azure/static-web-apps-cli@2.0.10
swa --version
```

Node.js 24 LTS を推奨します。古い場合は講師に相談してください。

**依存関係の未解決事項（#15）:** SWA CLI 2.0.10 の実際の依存ツリーには、アプリ本体とは別に npm audit の指摘が残っています。アプリの audit が 0 件でもデプロイツールまで解決したことにはなりません。強制 downgrade や非互換 override は行わず、利用前に組織のポリシーを確認してください。全依存関係で 0 件を要求する環境では、この CLI によるデプロイは修正版または検証済みの代替手段が用意されるまでブロックされます。

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
| フロントエンド build | `materials/frontend` に移動し、`npm ci --include=dev --registry=https://registry.npmjs.org` と `NODE_ENV=production npm run build -- --mode production` を実行する | 公開 lockfile の build 用依存関係を復元し、Cloud Shell の環境変数に左右されず本番成果物を作成する |
| SWA routing 設定 | `staticwebapp.config.json` を `dist/` にコピーする | SPA fallback と `/api/*` の Linked Backend routing を Static Web Apps に反映する |
| runtime config 注入 | Actions と共通の `configure-frontend.cjs` が 3 UUID と 1 個だけの placeholder を検証し、Entra 設定と `API_BASE_URL: "/api"` を注入する | 同じ artifact contract を使い、ID 欠落・曖昧な代入をデプロイ前に停止する |
| Static Web Apps deploy | token を直前に取得し、`SWA_CLI_DEPLOYMENT_TOKEN` をそのプロセスだけに渡し、debug と `--verbose` を `log` に固定する | 環境で `silly` が設定されていても token を verbose log に出さず、production 環境へアップロードする |

`SWA_TOKEN` はデプロイ権限を持つシークレットです。末尾を含め一切表示しません。#41 を含む検証済み stack ではアプリの公開 npm source と audit=0 を確認していますが、CLI の既知の依存脆弱性は別の未解決事項です（#15）。ローカルの stub テストは実際の SWA deploy 成功を証明しません。

CLI を使わない Microsoft の公式 deployment action は [GitHub Actions の任意経路](day-1-github-actions-alternative.ja.html) で説明します。Frontend だけの切替に追加の Entra identity / role assignment は不要ですが、既存 baseline の権限制約・CLI audit の zero 条件・実 cloud acceptance を解消したという意味ではありません。

## 6. SWA URL を確認する

```bash
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
```

ブラウザーの開発者ツールで Network を開き、投稿一覧を再読み込みします。
投稿一覧のリクエストが **表示中の SWA host の `/api/posts`** に送られることを確認してください。
`API_BASE_URL: "/api"` の実行時設定を使い、古い `.env.local` の API host に送信したり、
`/api/api/posts` のように prefix を二重に付けたりしません。

| 症状 | 確認と対処 |
|---|---|
| 古い host に送信される | 配信中の `index.html` の公開 runtime config とデプロイ対象を確認し、正しい保存済み state で再デプロイして再読み込みする |
| 必須 Entra 設定のエラー | `paas-workshop.json` の Day 0 identity と対象 context を確認し、`scripts/deploy-frontend.sh` を再実行する。不正な設定を保持したまま通信を続行しない |
| 正しい host の `/api/health` が失敗する | Backend 自体の health と Linked Backend の接続を [アプリを検証](day-1-validation.ja.html) で分けて確認する |

Authorization header、access token、秘密を含む URL をログや Issue に貼らないでください。

## GitHub Actions を使う場合

Cloud Shell で手動デプロイせず GitHub Actions で backend/frontend をデプロイしたい場合は、任意の代替手順として [GitHub Actions でデプロイ（代替）](day-1-github-actions-alternative.ja.html) を参照してください。

## 次に進む

- [Day 1: アプリを検証](day-1-validation.ja.html)
