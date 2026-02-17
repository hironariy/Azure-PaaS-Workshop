# IaaS 版と PaaS 版のアプリケーションコード比較ガイド

このドキュメントは、同じブログアプリケーションに対して **IaaS 実装から PaaS 実装へ移行する際に、アプリケーションコードのどこを変更したか** を整理した解説書です。

- 対象: `iaas/materials/backend` vs `materials/backend`、`iaas/materials/frontend` vs `materials/frontend`
- 主眼: **差分（What）**、**背景（Context）**、**理由（Why）**
- 非対象: Bicep インフラ定義の詳細（別ガイド参照）

---

## 1. 結論サマリ

アプリケーションのビジネスロジック（投稿作成・編集・閲覧、認証済みユーザー操作）は基本的に維持し、主に次の観点で変更しています。

1. **実行環境差分への適応**（ポート、プロキシ経路、ヘルスチェック）
2. **データ接続先差分への適応**（MongoDB レプリカセット → Cosmos DB for MongoDB vCore）
3. **配布/設定注入方式の差分への適応**（IaaS VM 配置 → PaaS 配置）
4. **運用性向上**（ログ整形、初期化順序、フェールセーフ）

---

## 2. 変更分類（全体像）

## 2.1 バックエンド

主な実質変更ファイル:

- `materials/backend/src/config/environment.ts`
- `materials/backend/src/config/database.ts`
- `materials/backend/src/routes/index.ts`
- `materials/backend/src/routes/health.routes.ts`（軽微）
- `materials/backend/.env.example`

補足:

- `auth.middleware.ts` や主要な API ルート/サービス層は、実装ロジックとしてはほぼ同等
- モデル層は大部分が互換（Mongoose 継続利用）

## 2.2 フロントエンド

主な実質変更ファイル:

- `materials/frontend/index.html`
- `materials/frontend/src/config/appConfig.ts`
- `materials/frontend/src/config/msalInstance.ts`
- `materials/frontend/vite.config.ts`
- `materials/frontend/staticwebapp.config.json`（PaaS 側で追加）
- `materials/frontend/.env.example`

補足:

- `services/api.ts`、主要ページコンポーネントは機能面ではほぼ同等

---

## 3. バックエンド変更の詳細

## 3.1 `src/config/environment.ts`

### 何を変えたか

- デフォルトポートを `3000` → `8080` に変更
- 接続文字列キーを `MONGODB_URI` だけでなく `COSMOS_CONNECTION_STRING` も受け付ける形に変更

### 背景・理由

- App Service の標準実行ポートに合わせる必要があるため
- PaaS では Key Vault 経由で `COSMOS_CONNECTION_STRING` を注入する運用を採るため
- ローカル（IaaS 互換）でも動くよう後方互換を持たせるため

## 3.2 `src/config/database.ts`

### 何を変えたか

- 接続先 URI の判定ロジックを追加（Cosmos かローカル MongoDB か）
- Cosmos 接続時のみ `retryWrites=false`、`tls=true` を設定
- 接続文字列ログ出力をサニタイズ関数経由に統一

### 背景・理由

- Cosmos DB for MongoDB vCore の接続要件に適合させるため
- ローカル開発（Docker MongoDB）と Azure 本番相当を同一コードで切り替えるため
- 認証情報をログに出さないため（運用セキュリティ）

## 3.3 `src/routes/index.ts`

### 何を変えたか

- `router.use('/api', healthRoutes)` を追加

### 背景・理由

- SWA 連携時に `/api/*` 経路でバックエンドへ到達するため、`/api/health` での疎通確認を可能にする必要があるため
- 直接到達の `/health` と併用することで、経路別に診断しやすくするため

## 3.4 `src/routes/health.routes.ts`

### 何を変えたか

- 文言の調整（IaaS の LB 表現から App Service ヘルスチェック表現へ）
- `live` のレスポンスキーを `alive` → `live` に統一

### 背景・理由

- 実際の運用文脈（App Service）に合わせて意図を明確化するため
- 監視系レスポンスの意味を分かりやすく揃えるため

## 3.5 `.env.example`

### 何を変えたか

- ローカル開発デフォルトポートを 8080 基準に更新
- Cosmos 接続例、Entra ID 前提、CORS 例を PaaS 実態に合わせて更新

### 背景・理由

- 受講者が「まず動く」状態に最短で到達できるようにするため
- App Service + Entra + Cosmos の組み合わせを標準パスとして示すため

---

## 4. フロントエンド変更の詳細

## 4.1 `index.html`

### 何を変えたか

- `window.__APP_CONFIG__` プレースホルダーを追加

### 背景・理由

- デプロイ時にランタイム設定をインライン注入できるようにするため
- 設定配布方式を VM ファイル配置依存から切り離し、PaaS 配布に適合させるため

## 4.2 `src/config/appConfig.ts`

### 何を変えたか

- 本番時の設定取得を `window.__APP_CONFIG__` 優先に変更
- 互換のため `/config.json` フォールバックを残し、最終的に build-time env まで降りる多段フォールバックを実装

### 背景・理由

- PaaS ではデプロイ時注入と静的配信の組み合わせが扱いやすいため
- 環境差異（SWA、本番、ローカル）で初期化失敗しにくい堅牢設計にするため

## 4.3 `src/config/msalInstance.ts`

### 何を変えたか

- イベントコールバック設定順序と初期化手順を明確化
- `handleRedirectPromise()` の完了をより明示的に待機する流れに整理

### 背景・理由

- 認証リダイレクト直後のアカウント復元を安定させるため
- 環境差や初回アクセス時の race condition を避けるため

## 4.4 `vite.config.ts`

### 何を変えたか

- 開発プロキシ先を `localhost:3000` → `localhost:8080` に変更

### 背景・理由

- バックエンドの PaaS 想定ポート（App Service 互換）に合わせるため

## 4.5 `staticwebapp.config.json`（追加）

### 何を追加したか

- SPA ルーティング用 `navigationFallback`
- `/api/*` のルート定義
- セキュリティ系ヘッダー定義

### 背景・理由

- SWA 上で SPA と API 連携を安定動作させるため
- 静的ホスティング層で最低限のセキュリティヘッダーを統一するため

## 4.6 `.env.example`

### 何を変えたか

- PaaS 前提の開発ガイダンス（5173/4280、8080）へ更新
- Entra ID 設定の説明を強化

### 背景・理由

- ローカル開発と SWA 近似検証の導線を明確化するため
- 認証設定ミスの初期学習コストを下げるため

---

## 5. ほぼ変えていない領域（重要）

移行後も、次の領域は原則維持しています。

- API の業務ロジック（投稿 CRUD の振る舞い）
- 認証認可の基本モデル（Entra JWT 検証の中核）
- フロントエンドの画面遷移/ユースケースの中心部分

これは、**「インフラ方式を変えても、アプリケーションのドメインロジックは保ちやすい」** という移行設計の意図によるものです。

---

## 6. なぜこの変更方針なのか（設計意図）

1. **変更を最小化して学習価値を高める**
   - IaaS/PaaS の違いを、主に運用境界・設定注入・接続要件に集中させる。

2. **ローカル開発と Azure 実行環境を両立させる**
   - 同一コードでローカル/本番系を切り替え可能にする。

3. **運用観点（監視/障害切り分け）を強化する**
   - `/health` と `/api/health` など、経路別診断をしやすくする。

4. **将来の再デプロイ/DR を容易にする**
   - ランタイム設定の外出しと環境変数整理により、再構築時の手戻りを減らす。

---

## 7. 実践チェックリスト（移行レビュー用）

- [ ] バックエンドが `PORT=8080` で起動する
- [ ] `COSMOS_CONNECTION_STRING` と `MONGODB_URI` の両系で接続確認済み
- [ ] `/health` と `/api/health` の両方で疎通確認済み
- [ ] フロントエンド設定が `window.__APP_CONFIG__` で読める
- [ ] `/config.json` フォールバック時も起動可能
- [ ] ローカル開発時の Vite proxy が `:8080` に向いている
- [ ] SWA 設定ファイルで SPA ルーティングと API ルートが機能する

---

## 8. 関連ドキュメント

- `design/IaaS-to-PaaS-Migration-Changes.md`（設計比較の詳細）
- `materials/docs/bicep-guide.ja.md`（IaC 観点）
- `materials/docs/monitoring-guide.ja.md`（監視観点）
- `materials/docs/disaster-recovery-guide.ja.md`（BCDR 観点）
