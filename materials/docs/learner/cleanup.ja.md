---
title: Cleanup
---

# Cleanup

ワークショップ後は、課金を止めるために作成した Azure リソースと Entra ID app registration を削除します。

## 1. 変数を復元する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
echo "$RESOURCE_GROUP"
```

## 2. Resource Group を削除する

```bash
az group delete \
  --name "$RESOURCE_GROUP" \
  --yes \
  --no-wait
```

削除状態を確認します。

```bash
az group exists --name "$RESOURCE_GROUP"
```

`false` になれば削除済みです。`--no-wait` を指定しているため、完了まで時間がかかることがあります。

## 3. Entra ID app registration を削除する

講師から共有された app registration を使った場合は削除しないでください。自分で作成した場合のみ削除します。

```bash
az ad app delete --id "$FRONTEND_CLIENT_ID"
az ad app delete --id "$BACKEND_CLIENT_ID"
```

確認します。

```bash
az ad app show --id "$FRONTEND_CLIENT_ID" 2>/dev/null || echo "Frontend app deleted"
az ad app show --id "$BACKEND_CLIENT_ID" 2>/dev/null || echo "Backend app deleted"
```

## 4. Cloud Shell の作業ファイルを削除する

```bash
rm -rf "$WORKSHOP_REPO_DIR"
rm -rf "$WORKSHOP_STATE_DIR"
```

`WORKSHOP_REPO_DIR` は build 高速化のため `~/Azure-PaaS-Workshop` に置いたリポジトリ、`WORKSHOP_STATE_DIR` は Azure Files (`~/clouddrive`) 側に置いた永続化 state です。

## 5. 費用確認

Azure Portal の Cost Management で、対象サブスクリプションとリソースグループ名を確認します。Resource Group 削除後も、課金データの反映には時間差があります。
