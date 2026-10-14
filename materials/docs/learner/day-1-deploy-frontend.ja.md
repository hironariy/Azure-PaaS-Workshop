---
title: "Day 1: フロントエンドのデプロイ"
---

# Day 1: フロントエンドのデプロイ

Cloud Shell 上で React フロントエンド（`materials/frontend`）をビルドし、Azure Static Web Apps へデプロイします。

## 1. 変数とツールを確認する

> 💡 Cloud Shell が再接続されて変数が消えた場合のみ、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load deployed` を先に実行してください。

```bash
node --version
npm --version
az version
command -v zip
command -v unzip
command -v swa || npm install -g @azure/static-web-apps-cli@2.0.10
printf 'SWA: %s\nHost: %s\n' "$SWA_NAME" "$SWA_HOSTNAME"
printf 'Tenant: %s\nFrontend: %s\nBackend: %s\n' "$TENANT_ID" "$FRONTEND_CLIENT_ID" "$BACKEND_CLIENT_ID"
```

Static Web Apps 名、ホスト名、Entra ID の各 ID が表示されることを確認します。

## 2. フロントエンドをビルドして Static Web Apps へデプロイする

リポジトリに含まれる `scripts/deploy-frontend.sh` を実行します。

```bash
cd "$WORKSHOP_REPO_DIR"
./scripts/deploy-frontend.sh "$RESOURCE_GROUP"
```

このスクリプトは内部で次の処理を順番に実行します。

1. 保存済みの設定値（`paas-workshop.json`）から Static Web Apps 名と Entra ID の設定値を読み取り、SPA リダイレクト URI や `access_as_user` スコープ設定を確認します。
2. `materials/frontend` で `npm ci` と `npm run build`（本番モード）を実行します。
3. ビルド成果物（`dist/`）に、実行時設定ファイル（`runtime-config.js`）と `index.html` の `window.__APP_CONFIG__` を注入します。
4. Azure Static Web Apps のデプロイトークンを一時取得し、Static Web Apps CLI（`@azure/static-web-apps-cli`）を使って本番環境（`production`）へデプロイします。

完了すると、`Frontend deployment complete!` と公開 URL（`https://<SWA_HOSTNAME>`）が表示されます。

## 3. デプロイ結果を確認する

公開 URL に対して、HTML とランタイム設定、および Linked Backend 経由の API 応答を確認します。

```bash
curl -fsS "https://${SWA_HOSTNAME}" | grep -o 'window.__APP_CONFIG__=[^<]*'
curl -fsS "https://${SWA_HOSTNAME}/api/health"
echo ""
```

- `window.__APP_CONFIG__` に `ENTRA_FRONTEND_CLIENT_ID`、`ENTRA_TENANT_ID`、`ENTRA_BACKEND_CLIENT_ID`、`"API_URL":"/api"` が含まれていること。
- `/api/health` から `"status":"healthy"` を含む JSON が返ること。

---

## 補足: ARM ZIP API を使ったデプロイ手順（代替方式）

社内ネットワークやセキュリティポリシーの都合で Static Web Apps CLI（`@azure/static-web-apps-cli`）を利用しない場合は、[Azure Resource Manager の Static Sites ZIP デプロイ API](https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/create-zip-deployment-for-static-site?view=rest-appservice-2025-05-01) を使う `scripts/deploy-frontend-arm.sh` でもデプロイできます。

1. **デプロイ用 ZIP パッケージの作成 (`prepare`)**

   ```bash
   FRONTEND_ZIP="$WORKSHOP_STATE_DIR/frontend-$(node -p 'require("node:crypto").randomUUID()').zip"
   bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend-arm.sh" "$RESOURCE_GROUP" prepare "$FRONTEND_ZIP"
   ```

2. **一時 HTTPS URL（Blob Storage の読み取り専用 SAS URL など）の準備とデプロイ (`deploy`)**

   生成された `$FRONTEND_ZIP` を Azure Blob Storage などの HTTPS ストレージへアップロードし、有効期限の短い読み取り専用 URL を発行したうえで次のコマンドを実行します（プロンプトに URL を貼り付けます）。

   ```bash
   bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend-arm.sh" "$RESOURCE_GROUP" deploy "$FRONTEND_ZIP"
   ```

   デプロイ完了後は、アップロードした一時ファイルと SAS URL を削除・失効させてください。

## 次に進む

- [Day 1: アプリケーションの動作確認](day-1-validation.ja.html)
