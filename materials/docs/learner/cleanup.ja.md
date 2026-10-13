---
title: Cleanup
---

# Cleanup

課金停止は削除要求の受付ではなく、対象リソースが存在しないことまで確認します。共有 RG・共有 Entra アプリは削除しません。タグは専用対象の確認材料であり、それだけで所有権を証明するものではありません。

## 1. 保存した対象を復元する

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load base || exit 1
printf 'Subscription: %s / Tenant: %s / RG: %s\n' "$SUBSCRIPTION_ID" "$TENANT_ID" "$RESOURCE_GROUP"
```

別 subscription/tenant のまま進めることはできません。JSON が壊れている場合も、空の変数や別 RG で続行しません。

## 2. 専用対象を確認して Azure 側を削除する

```bash
bash scripts/cleanup-workshop.sh
```

スクリプトは、Day 0 の `Workshop` / `GroupId` タグ、RG 内リソース一覧、保存した app ID と現在の所有者を確認した後、`<SUBSCRIPTION_ID>/<RESOURCE_GROUP>` 全体の入力を求めます。表示した **すべてのリソースとアプリが自分のグループ専用** であることを確認して入力してください。未確認・共有対象なら中止します。

RG 削除は非同期で要求し、最大 900 秒待機した後 `az group exists` の `false` を確認します。途中の timeout・権限不足・通信エラーは成功扱いにせず、Entra アプリとローカル state を保持します。後で同じ state から再試行できます。

アプリは現在のユーザーが所有するものだけを削除し、正常に取得した app 一覧が空であることを確認します。`az ad app show` の失敗だけで「削除済み」と判断しません。Graph の読み取りが拒否された場合は検証不能です。旧手順のタグ無し RG や共有 app は、自動でタグを付け直して削除せず、管理責任者と対象を確認します。

期待値:

```text
Saved Azure targets are confirmed absent. Local checkout, state and parameter file were retained.
```

任意の GitHub Actions 用アプリ・他 RG のリソースはこのスクリプトの対象外です。削除記録には subscription、RG、app ID、時刻、確認結果だけを残し、パスワードやトークンを含めません。

## 3. 秘密値を含むローカルファイルを整理する

Azure 側の削除確認が済んだ後だけ、不要になった以下の 2 ファイルを削除できます。次のコマンドはリポジトリや state ディレクトリ全体を再帰削除しません。

```bash
printf '削除候補: %s\n削除候補: %s\n' "$PARAM_FILE" "$ENV_FILE"
read -r -p "Azure 側の削除を確認済みで、この 2 ファイルが不要なら DELETE と入力: " CONFIRM_LOCAL
if [ "$CONFIRM_LOCAL" = DELETE ]; then
  rm -f -- "$PARAM_FILE" "$ENV_FILE"
else
  echo "ローカルファイルを保持しました。"
fi
```

リポジトリは学習記録として保持します。state ディレクトリに他ファイルが残っていても、自動では削除しません。`PARAM_FILE` は秘密値を含むため、保持する場合も Git に追加・共有しないでください。

## 4. 費用の反映を確認する

Azure Portal の Cost Management で、同じ subscription と RG の費用を確認します。削除後も反映に時間差があり、累計費用は消えません。RG 以外に作成したリソースも別途確認してください。
