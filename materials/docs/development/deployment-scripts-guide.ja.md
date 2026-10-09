---
title: デプロイスクリプトガイド（任意）
---

# デプロイスクリプトガイド（任意）

このページは Cloud Shell 受講者本線で使用する `scripts/deploy-backend.sh` と `scripts/deploy-frontend.sh` の内部処理を理解したい場合の参照です。

Cloud Shell 本線では、バックエンドはリポジトリ内ソースから build して App Service に ZIP deploy し、フロントエンドは Cloud Shell 上で build して Static Web Apps に deploy します。講師提供の既成コンテナイメージには依存しません。

- [Day 1: PaaS インフラをデプロイ](../learner/day-1-deploy-infrastructure.ja.html)
- [Day 1: バックエンドをデプロイ](../learner/day-1-deploy-backend.ja.html)
- [Day 1: フロントエンドをデプロイ](../learner/day-1-deploy-frontend.ja.html)

現行スクリプトは JSON state と現在の subscription/tenant/対象を照合し、`npm ci` で build します。backend は実行ごとの一時ディレクトリを使い、HTTP 200 と healthy JSON の両方を上限付きで検査します。Frontend token は環境で渡し、引数・ログ・末尾表示には使いません。CLI の失敗を未作成・削除済み・成功へ読み替えません。

旧実装の詳細を残した `docs/deployment-scripts-guide.ja.md` は履歴の参照用です。実行には上記の Day 1 ページを使います。ローカル回帰テストは `node --test scripts/test/*.test.cjs` で実行でき、Azure CLI・npm・SWA の stub を使用するため実クラウドへ書き込みません。これは実際の Azure deployment の証拠ではありません。
