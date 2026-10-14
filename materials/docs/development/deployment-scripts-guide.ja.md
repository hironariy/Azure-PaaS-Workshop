---
title: デプロイスクリプト仕様（開発者向け）
---

# デプロイスクリプト仕様（開発者向け）

このページは、Cloud Shell から実行する `scripts/deploy-backend.sh` や `scripts/deploy-frontend.sh` などの内部処理を把握したい開発者・講師向けの解説です。

受講者向けの実行手順は以下のページを参照してください。

- [Day 1: インフラのデプロイ](../learner/day-1-deploy-infrastructure.ja.html)
- [Day 1: バックエンドのデプロイ](../learner/day-1-deploy-backend.ja.html)
- [Day 1: フロントエンドのデプロイ](../learner/day-1-deploy-frontend.ja.html)

## 主なスクリプトの仕組み

1. **状態管理 (`scripts/workshop-state.sh`)**
   - `~/clouddrive/paas-workshop/paas-workshop.json` に保存されたサブスクリプション・テナント・リソースグループ・アプリ登録 ID を検証し、現在の Azure CLI コンテキストと一致していることを確認してから環境変数へ展開します。
2. **バックエンドのデプロイ (`scripts/deploy-backend.sh`)**
   - 一時ディレクトリで `npm ci` と `npm run build` を実行し、本番依存関係と `dist/` を ZIP パッケージ化して App Service へデプロイします。デプロイ後は `/health` が HTTP 200 と正常な JSON を返すまで確認します。
3. **フロントエンドのデプロイ (`scripts/deploy-frontend.sh` / `scripts/deploy-frontend-arm.sh`)**
   - `materials/frontend` を本番モードでビルドし、`runtime-config.js` と `index.html` の `window.__APP_CONFIG__` に Entra ID の設定値を注入します。
   - メイン手順の `scripts/deploy-frontend.sh` は Static Web Apps のデプロイトークンを環境変数経由で SWA CLI に渡してデプロイします（トークンは画面やログに出力しません）。
   - 代替手順の `scripts/deploy-frontend-arm.sh` は、ARM の `createZipDeploymentForStaticSiteBuild` API を使って ZIP パッケージをデプロイします。

## テストの実行方法

スクリプトの構文チェックと単体テスト（Azure CLI / npm のモックを使用）は、次のコマンドで実行できます。

```bash
node --test scripts/test/*.test.cjs
```

さらに詳しい背景については、リポジトリ内の `docs/deployment-scripts-guide.ja.md` を参照してください。
