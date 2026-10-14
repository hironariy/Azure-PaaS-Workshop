# IaaS と PaaS の比較（アプリケーションコード解説）

このドキュメントでは、同じブログアプリケーションを **IaaS（VM ベース）から Azure PaaS へ移行する際、アプリケーションコードのどこを変更し、どこをそのまま維持できるか** を解説します。

> **受講手順について:** ワークショップの構築・運用手順は [ワークショップの流れ](learner/cloud-shell-quickstart.ja.html) から進めてください。このページはアーキテクチャとコード差分の理解を深めるための補足資料です。

---

## 1. 結論サマリ

IaaS から PaaS へ移行しても、**アプリケーションのビジネスロジック（記事の作成・編集・閲覧・認証チェック）はそのまま維持**できます。コード変更が必要になるのは、主に以下の 4 点です。

1. **実行環境への適応**（App Service の標準ポート `8080`、`/health` と `/api/health` の両方でのヘルスチェック応答）
2. **データベース接続の適応**（自前 MongoDB レプリカセットから Cosmos DB for MongoDB vCore への接続オプション対応）
3. **フロントエンド設定注入の適応**（VM 上の設定ファイル配置から、Static Web Apps 配信時の `window.__APP_CONFIG__` / `runtime-config.js` 注入への切り替え）
4. **監視とセキュリティの向上**（Key Vault 参照による環境変数注入、接続文字列のログマスク処理）

---

## 2. 主な変更ファイル一覧

### 2.1 バックエンド (`materials/backend/`)
- `src/config/environment.ts`: デフォルトポートを `3000` から App Service 標準の `8080` に変更し、Key Vault 参照で注入される `COSMOS_CONNECTION_STRING` に対応。
- `src/config/database.ts`: Cosmos DB 接続時に `tls=true` などを適用し、ログ出力時に接続文字列内の認証情報をマスク。
- `src/routes/index.ts` / `src/routes/health.routes.ts`: App Service 直接の `/health` に加え、Static Web Apps の Linked Backend（`/api/*`）経由で疎通確認できる `/api/health` を追加。

### 2.2 フロントエンド (`materials/frontend/`)
- `index.html` / `src/config/appConfig.ts`: デプロイ時に注入される `window.__APP_CONFIG__` から Entra ID の Client ID / Tenant ID と API ベース URL（`/api`）を読み取る仕組みを追加。
- `src/config/msalInstance.ts`: MSAL の初期化とリダイレクト後のトークン取得処理を整理。
- `staticwebapp.config.json`: Static Web Apps での SPA ルーティング（`navigationFallback`）と `/api/*` ルート、セキュリティヘッダーを定義。

---

## 3. バックエンドの変更ポイント詳細

### 3.1 `src/config/environment.ts`
- **変更内容**: デフォルトポートを `8080` に変更し、DB 接続文字列として `COSMOS_CONNECTION_STRING` と `MONGODB_URI` の両方を受け付けるようにしました。
- **理由**: App Service (Linux) の標準ポートに合わせつつ、Key Vault 参照から渡される `COSMOS_CONNECTION_STRING` をコード修正なしで読み取れるようにするためです。

### 3.2 `src/config/database.ts`
- **変更内容**: 接続先が Cosmos DB かローカルの MongoDB かを判定し、Cosmos DB 接続時には TLS 設定などを自動適用します。また、ログ出力時にはパスワード部分をマスクします。
- **理由**: ローカル開発（Docker 上の MongoDB）と Azure 上の Cosmos DB for MongoDB vCore を同じコードベースで扱えるようにするためです。

### 3.3 `src/routes/index.ts`
- **変更内容**: `/health` だけでなく `/api/health` でもヘルスチェックルートが応答するように構成しました。
- **理由**: Static Web Apps の Linked Backend は `/api/*` パスを App Service へ転送するため、フロントエンド経由の疎通（`/api/health`）とバックエンド直接の疎通（`/health`）を切り分けられるようにするためです。

---

## 4. フロントエンドの変更ポイント詳細

### 4.1 `index.html` と `src/config/appConfig.ts`
- **変更内容**: `window.__APP_CONFIG__` から設定値（Entra ID の Client ID や API URL）を優先的に読み取り、未設定時は `/config.json` やビルド時環境変数へフォールバックする構成にしました。
- **理由**: Static Web Apps へのデプロイ時に各受講者の Entra アプリ登録情報を安全に注入できるようにするためです。

### 4.2 `staticwebapp.config.json`
- **変更内容**: SPA のクライアントサイドルーティング用フォールバック（`navigationFallback`）とセキュリティヘッダーを定義しました。
- **理由**: Static Web Apps 上で React Router の画面遷移と `/api/*` のバックエンド連携を正しく動作させるためです。

---

## 5. 移行レビュー用のチェックリスト

IaaS から PaaS へ Web アプリケーションを移行する際は、次の観点を確認するとスムーズです。

- [ ] バックエンドが PaaS 標準ポート（`PORT=8080` など）で待ち受けているか
- [ ] DB 接続文字列や API キーをソースコードやリポジトリ内ファイルから排除し、Key Vault 参照 + マネージド ID で注入しているか
- [ ] バックエンド直接（`/health`）とフロントエンド経由（`/api/health`）の両方でヘルスチェックが通るか
- [ ] SPA のリダイレクトルーティング（`staticwebapp.config.json`）が設定されているか
