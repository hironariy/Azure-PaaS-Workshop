---
title: 講師向けガイド
---

# 講師向けガイド

このページは、ワークショップを運営する講師・ファシリテーター向けの案内です。詳細な進行メモについては、リポジトリ内の `docs/instructor-guide.ja.md` もあわせて参照してください。

## 受講者ポータルの構成（標準進行順）

1. [ワークショップの流れ](../learner/cloud-shell-quickstart.ja.html)
2. [Day 0: 事前準備 2（サブスクリプションとリソースグループ）](../learner/day-0-prerequisites.ja.html)
3. [Day 0: Entra ID と認証設定](../learner/day-0-entra-id.ja.html)
4. [Day 1: インフラのデプロイ](../learner/day-1-deploy-infrastructure.ja.html)
5. [Day 1: バックエンドのデプロイ](../learner/day-1-deploy-backend.ja.html)
6. [Day 1: フロントエンドのデプロイ](../learner/day-1-deploy-frontend.ja.html)
7. [Day 1: アプリケーションの動作確認](../learner/day-1-validation.ja.html)
8. [Day 2: 監視と運用](../learner/day-2-operations.ja.html)
9. [Day 2: 信頼性と復旧](../learner/day-2-reliability.ja.html)
10. [クリーンアップ（リソース削除）](../learner/cleanup.ja.html)

## 開催前の確認事項

- **Azure サブスクリプション権限**: 各受講者に対象サブスクリプションの **Owner（所有者）** ロールが割り当てられていることを確認してください（Day 1 の Bicep デプロイで Key Vault の RBAC ロール割り当てを行うため必須です）。
- **Microsoft Entra ID 権限**: 各受講者に **Application Developer（アプリケーション開発者）** ロールが割り当てられていることを確認してください（Day 0 でアプリ登録と本人同意を行うために使用します）。
- **グループ識別子 (`GROUP_ID`)**: 同一サブスクリプション・テナントで複数名が受講する場合は、リソース名の重複を避けるため受講者ごとに異なる `GROUP_ID`（`01`, `02` または `A`, `B` など）を割り当ててください。
