---
title: "クリーンアップ（リソース削除）"
---

# クリーンアップ（リソース削除）

ワークショップ終了後は、不要な課金が発生しないよう、作成した Azure リソースグループと Microsoft Entra ID のアプリ登録を削除し、削除が完了したことまで確認します。

## 1. 保存済みの設定値を確認する

削除対象のサブスクリプション、テナント、リソースグループ名を確認します。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load base || exit 1
printf 'Subscription: %s / Tenant: %s / RG: %s\n' "$SUBSCRIPTION_ID" "$TENANT_ID" "$RESOURCE_GROUP"
```

## 2. Azure リソースと Entra アプリ登録を削除する

クリーンアップスクリプト（`scripts/cleanup-workshop.sh`）を実行します。

```bash
bash scripts/cleanup-workshop.sh
```

スクリプトは次の順序で安全に削除を行います。

1. リソースグループに付与された `Workshop=Azure-PaaS-Workshop` タグと `GroupId` タグ、リソース一覧、および保存されている Entra アプリ登録の所有者を確認します。
2. 確認プロンプトが表示されたら、表示されたすべてのリソースが自分の演習用であることを確認したうえで `<SUBSCRIPTION_ID>/<RESOURCE_GROUP>` を入力します。
3. リソースグループの削除を開始し、削除が完了してリソースグループが存在しないこと（`az group exists` が `false` になること）を確認します。
4. 自分が所有する演習用の Backend / Frontend アプリ登録を Entra ID から削除し、削除されたことを確認します。

完了すると、次のメッセージが表示されます。

```text
Saved Azure targets are confirmed absent. Local checkout, state and parameter file were retained.
```

※ 万が一途中でタイムアウトやエラーが発生した場合は、ローカルの設定ファイル（`$ENV_FILE`）がそのまま残るため、再度 `bash scripts/cleanup-workshop.sh` を実行して再試行できます。

## 3. ローカルの設定ファイルを削除する

Azure 側のリソース削除が完了したことを確認できたら、Cloud Shell 上の設定ファイル（`$PARAM_FILE` と `$ENV_FILE`）を必要に応じて削除します。

```bash
printf '削除候補: %s\n削除候補: %s\n' "$PARAM_FILE" "$ENV_FILE"
read -r -p "Azure 側の削除を確認済みで、この 2 ファイルが不要なら DELETE と入力: " CONFIRM_LOCAL
if [ "$CONFIRM_LOCAL" = DELETE ]; then
  rm -f -- "$PARAM_FILE" "$ENV_FILE"
else
  echo "ローカルファイルを保持しました。"
fi
```

## 4. 課金状況を確認する

Azure Portal の **コストの管理と請求（Cost Management + Billing）** で、対象サブスクリプションとリソースグループのコストを確認します（リソース削除後もコスト画面への反映には少し時間差があります）。
