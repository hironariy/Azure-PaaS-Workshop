# デプロイスクリプト ガイド

このドキュメントは Azure PaaS Workshop で使用するデプロイスクリプトについて説明します。これらのスクリプトは、バックエンド API を Azure App Service へ、フロントエンドを Azure Static Web Apps へデプロイする作業を自動化します。

---

## 目次

- [バックエンドデプロイスクリプト](#backend-deployment-script)
- [フロントエンドデプロイスクリプト](#frontend-deployment-script)
- [トラブルシューティング](#トラブルシューティング)

---

## バックエンドデプロイスクリプト <a id="backend-deployment-script"></a>

**スクリプト:** `scripts/deploy-backend.sh`

### 目的

Node.js/Express のバックエンド API を Azure App Service にデプロイします。VNet 統合および Key Vault 参照の解決によって初回起動が遅くなりがちな点を考慮し、ヘルスチェックで起動完了まで待ちます。

### 使い方

```bash
./scripts/deploy-backend.sh <resource-group> <app-service-name>

# Example
./scripts/deploy-backend.sh rg-blogapp-paas app-blogapp-abc123
```

### スクリプトが行うこと

スクリプトは以下の手順で処理します。

#### 手順 1: アプリをビルド
```
📦 npm install
📦 npm run build
```
- 依存関係をすべてインストール（TypeScript コンパイルのため devDependencies を含む）
- TypeScript を `dist/` に JavaScript としてコンパイル

#### 手順 2: デプロイパッケージを作成
```
📁 Copy dist/ and package.json/package-lock.json to deploy-package/
📁 Run npm ci --omit=dev (production dependencies only)
📁 Create deploy.zip
```
- 本番に必要なファイルだけをまとめる
- 本番依存のみをインストール（devDependencies なし）
- ZIP パッケージ（deploy.zip）を作成

**Windows PowerShell で手動 ZIP 作成する場合の注意:**
- Linux App Service 向けの ZIP では `Compress-Archive` を避けてください。ZIP 内パスが `src\app.js` のようなバックスラッシュ区切りになる場合があります。
- `materials\backend\dist` で `tar.exe -a -c -f ..\deploy.zip *` を実行して ZIP を作成してください。
- 必要に応じて `tar.exe -tf ..\deploy.zip | Select-Object -First 20` で先頭を確認し、`/` 区切りになっていることを確認してください。

#### 手順 3: App Service を設定
```
⚙️ SCM_DO_BUILD_DURING_DEPLOYMENT=false
⚙️ Startup command: node dist/src/app.js
```
- **リモートビルドを無効化**: Azure 側で `npm install` / `tsc` を走らせない（TypeScript が devDependencies のため失敗しがち）
- **起動コマンドを設定**: 事前コンパイル済みアプリの起動方法を指定

#### 手順 4: App Service へデプロイ
```
🚀 az webapp deploy --async true
```
- ZIP を App Service にアップロード
- `--async true` でタイムアウトを避ける
- `--clean true` で旧ファイルを削除してから反映

#### 手順 5: ヘルスチェックで起動完了を確認
```
🏥 Wait 20 seconds (initial delay)
🏥 Poll /health endpoint every 15 seconds
🏥 Maximum 30 retries (~7.5 minutes total)
```
- 初回起動（VNet + Key Vault 参照）で 60-90 秒程度かかることがあるため待機
- `/health` が HTTP 200 を返すまでポーリング
- 成功/失敗を分かりやすく出力

### なぜこの手順が必要？

| 課題 | 対策 |
|-----------|----------|
| **TypeScript のコンパイル** | ローカルで事前ビルドし、リモートビルドを無効化 |
| **VNet 統合の起動遅延** | async デプロイ + ヘルスチェックのポーリング |
| **Key Vault 参照の解決** | 初期化時間（60-90秒）を許容 |
| **デプロイのタイムアウト** | `--async true` を使う |

### 出力例

```
==============================================
Backend Deployment Script
==============================================
Resource Group: rg-blogapp-paas
App Service: app-blogapp-abc123
==============================================

Step 1: Building application...
✅ Build complete

Step 2: Creating deployment package...
✅ Deployment package created (deploy.zip)

Step 3: Configuring App Service...
✅ App Service configured

Step 4: Deploying to App Service...
✅ Deployment package uploaded

Step 5: Waiting for app to start (this may take 60-90 seconds)...
Health endpoint: https://app-blogapp-abc123.azurewebsites.net/health
Initial wait: 20s
Attempt 1/30...
  Status: HTTP 503 (waiting 15s...)
Attempt 2/30...
  Status: HTTP 503 (waiting 15s...)
...
Attempt 5/30...

✅ App is healthy! (HTTP 200)

Health check response:
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:00:00.000Z"
}

==============================================
Deployment successful!
App URL: https://app-blogapp-abc123.azurewebsites.net
==============================================
```

---

## フロントエンドデプロイスクリプト <a id="frontend-deployment-script"></a>

**スクリプト:** `scripts/deploy-frontend.sh`

### 目的

React フロントエンドをビルドし、runtime 設定（Entra ID の値など）を注入してから、SWA CLI を使って Azure Static Web Apps にデプロイします。

### 前提（事前準備）

このスクリプトを実行する前に:

1. **Cloud Shell state 側に設定ファイルを作成:**
   ```bash
   export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
   mkdir -p "$WORKSHOP_STATE_DIR"
   cp scripts/deploy-frontend.template.env "$WORKSHOP_STATE_DIR/deploy-frontend.local.env"
   ```

2. **Entra ID の値を記入:**
   ```bash
   # $WORKSHOP_STATE_DIR/deploy-frontend.local.env
   ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ENTRA_FRONTEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ENTRA_BACKEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

   従来の `scripts/deploy-frontend.local.env` も読み込めますが、Cloud Shell 本線では Azure Files (`~/clouddrive`) 側の state ディレクトリに保存します。

### 使い方

```bash
./scripts/deploy-frontend.sh <resource-group>

# Example
./scripts/deploy-frontend.sh rg-blogapp-paas
```

### スクリプトが行うこと

#### 手順 0: Entra ID 設定を読み込む
```
📄 Source $WORKSHOP_STATE_DIR/deploy-frontend.local.env
✅ Validate required values are set
```
- Cloud Shell 本線では Azure Files 側の state ファイルから設定を読み込み
- 従来の `scripts/deploy-frontend.local.env` も fallback として読み込み可能
- 必須値が空でないか検証

#### 手順 1: Azure リソースを取得
```
🔍 Get SWA hostname
🔍 Get SWA deployment token
```
- リソースグループから Static Web App を特定
- デプロイトークンを取得

#### 手順 2: アプリをビルド
```
📦 npm install
📦 npm run build
```
- 依存関係をインストール
- `dist/` に本番ビルド

#### 手順 3: Static Web Apps 設定をコピー
```
📄 Copy staticwebapp.config.json to dist/
```
- SPA fallback と `/api/*` routing の設定を成果物に含める

#### 手順 4: 設定を注入
```
🔧 Create config JSON with Entra ID values
🔧 Replace placeholder in index.html
```
- 次の値を含む JSON 設定を生成:
  - Tenant ID
  - Frontend Client ID
  - Backend Client ID
  - API Base URL（`/api`。SWA Linked Backend 経由）
- `index.html` に直接注入

**なぜ inline injection？**
- `/config.json` を公開するより安全
- デプロイ時に HTML に焼き込み、追加の HTTP リクエストが不要

#### 手順 5: Static Web Apps にデプロイ
```
🚀 swa deploy ./dist --deployment-token $TOKEN
```
- SWA CLI を使って成果物をアップロード
- デプロイトークンで認証

### 設定注入の詳細

**注入前（source `index.html`）:**
```html
<script>window.__APP_CONFIG__=null;</script>
```

**注入後（build 後 `dist/index.html`）:**
```html
<script>window.__APP_CONFIG__={"ENTRA_TENANT_ID":"xxx","ENTRA_FRONTEND_CLIENT_ID":"xxx","ENTRA_BACKEND_CLIENT_ID":"xxx","API_BASE_URL":"/api"};</script>
```

React アプリは runtime でこの設定を参照します:
```typescript
const config = window.__APP_CONFIG__;
// Use config.ENTRA_TENANT_ID, etc.
```

---

## トラブルシューティング

- `tsc: not found` などのエラーが出る場合は、バックエンド側のリモートビルドが有効になっている可能性があります。`SCM_DO_BUILD_DURING_DEPLOYMENT=false` が設定されているか確認してください。
- フロントエンドで `AADSTS900144`（`client_id` 不足）が出る場合、`index.html` への注入が `null` や空になっていないかを確認してください。
- Windows PowerShell で作成した ZIP を使ってバックエンド起動に失敗する場合、`Compress-Archive` で作成した ZIP に `dist\src\app.js` のような Windows 区切りパスが含まれている可能性があります。`materials\backend` で `tar.exe -a -c -f deploy.zip dist package.json package-lock.json node_modules` のように `/` 区切りの ZIP を作成し、再デプロイしてください。
