# ローカル開発セットアップガイド

Azure PaaS Workshop の Blog アプリケーションをローカルで動かすための完全ガイドです。

## 前提条件

| ソフトウェア | バージョン | インストール |
|----------|---------|--------------|
| Node.js | 22.x LTS | [nodejs.org](https://nodejs.org/) |
| Docker Desktop | 最新 | [docker.com](https://www.docker.com/products/docker-desktop/) |
| npm | 10.x+ | Node.js に同梱 |
| Git | 最新 | [git-scm.com](https://git-scm.com/) |
| SWA CLI | 最新 | `npm install -g @azure/static-web-apps-cli` |

**インストール確認:**
```bash
node --version    # v22.x.x が表示される
npm --version     # 10.x.x が表示される
docker --version  # Docker version 24.x 以降が目安
swa --version     # SWA CLI のバージョンが表示される
```

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Local Development                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Browser ──► SWA CLI (:4280) ──┬──► Frontend (Vite :5173)              │
│                                 │                                        │
│                                 └──► Backend (Express :8080)             │
│                                             │                            │
│              Auth Emulator ◄────────────────┤                            │
│              (Fake Identity)                │                            │
│                                             ▼                            │
│                               MongoDB (Docker :27017)                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 開発用ツール

| ツール | 目的 | メリット |
|------|---------|---------|
| **SWA CLI** | Azure Static Web Apps をローカルでエミュレート | ルーティング、API プロキシ、認証をローカルで検証 |
| **SWA Auth Emulator** | 疑似認証（フェイク） | 開発中は Entra ID 設定が不要 |
| **MongoDB** | ローカル DB | Cosmos DB for MongoDB vCore と互換 |

> **Cosmos DB Emulator について:** Azure Cosmos DB Emulator（MongoDB API）は x64 アーキテクチャのみ対応です。
> Apple Silicon（M1/M2/M3）や Windows ARM では、標準の MongoDB を使用します。
> Mongoose ODM の利用体験は MongoDB と Cosmos DB for MongoDB vCore でほぼ同じです。

---

## 手順 1: SWA CLI をインストール（グローバル）

```bash
npm install -g @azure/static-web-apps-cli

# インストール確認
swa --version
```

---

## 手順 2: MongoDB を起動（Docker）

```bash
# dev-environment フォルダへ移動
cd dev-environment

# MongoDB コンテナ起動
docker-compose up -d

# 起動確認
docker-compose ps
```

**期待される出力例:**
```
NAME                         STATUS          PORTS
paas-blogapp-mongo           running         0.0.0.0:27017->27017/tcp
paas-blogapp-mongo-express   running         0.0.0.0:8081->8081/tcp
```

### Mongo Express（任意）

http://localhost:8081 をブラウザで開くと、Web UI から DB を確認できます。
- Username: `admin`
- Password: `admin`

---

## 手順 3: バックエンド設定

### 3.1 環境ファイルを作成

```bash
cd materials/backend

# 設定例をコピー
cp .env.example .env
```

### 3.2 MongoDB 用に `.env` を編集

```bash
# materials/backend/.env

NODE_ENV=development
PORT=8080

# Local MongoDB (Docker)
MONGODB_URI=mongodb://localhost:27017/blogapp

# When using SWA Auth Emulator - these are not used
# The auth emulator provides fake identity via x-ms-client-principal header
ENTRA_TENANT_ID=not-used-with-auth-emulator
ENTRA_CLIENT_ID=not-used-with-auth-emulator

# Logging
LOG_LEVEL=debug

# CORS (SWA CLI handles routing, but keep for direct API access)
CORS_ORIGINS=http://localhost:4280,http://localhost:5173,http://localhost:8080
```

### 3.3 依存関係のインストールと起動

```bash
# パッケージのインストール
npm install

# 開発サーバ起動（ホットリロード）
npm run dev
```

**期待される出力例:**
```
[INFO] Server running on port 8080
[INFO] MongoDB connected successfully
[INFO] Environment: development
```

### 3.4 ヘルスチェック

```bash
curl http://localhost:8080/health
```

**期待されるレスポンス:**
```json
{"status":"healthy","timestamp":"...","environment":"development"}
```

---

## 手順 4: フロントエンド設定

### 4.1 環境ファイルを作成

```bash
cd materials/frontend

# 設定例をコピー
cp .env.example .env.local
```

### 4.2 SWA CLI モード用に `.env.local` を編集

```bash
# materials/frontend/.env.local

# When using SWA Auth Emulator - these can be placeholder values
# Real authentication is handled by SWA CLI's auth emulator
VITE_ENTRA_CLIENT_ID=placeholder-for-dev
VITE_ENTRA_TENANT_ID=placeholder-for-dev
VITE_ENTRA_REDIRECT_URI=http://localhost:4280

# API is proxied through SWA CLI
VITE_API_CLIENT_ID=placeholder-for-dev
```

### 4.3 依存関係のインストールと起動

```bash
# パッケージのインストール
npm install

# 開発サーバ起動
npm run dev
```

**期待される出力例:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 手順 5: SWA CLI を起動（エントリーポイント）

**別のターミナル**を開いて実行します。

```bash
cd materials/frontend

# フロントとバックを束ねて起動
swa start http://localhost:5173 --api-location http://localhost:8080
```

**期待される出力例:**
```
Azure Static Web Apps emulator started.

   Serving static content from: http://localhost:5173
   API available at: http://localhost:8080

   Visit http://localhost:4280 to open the app
```

**⚠️ 重要:** アプリは必ず **http://localhost:4280**（SWA CLI）からアクセスしてください（:5173 や :8080 へ直接アクセスしない）。

---

## 手順 6: アプリをテスト

### 6.1 ブラウザで開く

**http://localhost:4280** にアクセスします。

### 6.2 公開機能（ログイン不要）の確認

- ✅ ホームが表示できる（初期状態は "No posts yet" の想定）
- ✅ コンソールエラーなくロードできる

### 6.3 Auth Emulator で疑似ログイン

SWA CLI は **疑似認証**（Fake auth）を提供します。

1. http://localhost:4280/.auth/login/aad にアクセス
2. モックのログイン画面が表示される
3. ダミーのユーザ情報を入力:
   - **User ID**: `test-user-001`
   - **Username**: `testuser@example.com`
   - **Claims**: `name` = `Test User` を追加
4. **Login** をクリック
5. 認証済みユーザーとしてアプリに戻る

### 6.4 認証後機能の確認

疑似ログイン後:
- ✅ **"Write Post"** → 新規投稿
- ✅ **"My Posts"** → 自分の投稿（下書き含む）表示
- ✅ 編集
- ✅ 削除
