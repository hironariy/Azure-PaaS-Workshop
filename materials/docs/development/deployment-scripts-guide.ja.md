---
title: デプロイスクリプトガイド（任意）
---

# デプロイスクリプトガイド（任意）

このページは Cloud Shell 受講者本線で使用する `scripts/deploy-backend.sh` と `scripts/deploy-frontend.sh` の内部処理を理解したい場合の参照です。

Cloud Shell 本線では、バックエンドはリポジトリ内ソースから build して App Service に ZIP deploy し、フロントエンドは Cloud Shell 上で build して Static Web Apps に deploy します。講師提供の既成コンテナイメージには依存しません。

- [Day 1: PaaS インフラをデプロイ](../learner/day-1-deploy-infrastructure.ja.html)
- [Day 1: バックエンドをデプロイ](../learner/day-1-deploy-backend.ja.html)
- [Day 1: フロントエンドをデプロイ](../learner/day-1-deploy-frontend.ja.html)

スクリプト詳細はリポジトリ内の `docs/deployment-scripts-guide.ja.md` を参照してください。
