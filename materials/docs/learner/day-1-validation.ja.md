---
title: "Day 1: アプリを検証"
---

# Day 1: アプリを検証

デプロイした PaaS アプリケーションが、App Service 直接経路と Static Web Apps 経由の両方で動作することを確認します。

## 1. 変数を復元する

```bash
cd ~/Azure-PaaS-Workshop
source ~/paas-workshop.env
```

## 2. App Service 直接ヘルスチェック

```bash
curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
```

期待値:

```json
{
  "status": "healthy"
}
```

## 3. Static Web Apps 経由ヘルスチェック

```bash
curl -fsS "https://${SWA_HOSTNAME}/api/health" | jq .
```

期待値:

```json
{
  "status": "healthy"
}
```

`404` の場合は、Static Web Apps へのフロントエンドデプロイが完了しているか、SWA Linked Backend が Standard SKU で作成されているかを確認します。

## 4. ブラウザで表示する

Cloud Shell で URL を表示します。

```bash
echo "https://$SWA_HOSTNAME"
```

ブラウザで開き、トップページが表示されることを確認します。

## 5. サインインを確認する

1. 画面のサインインボタンを選択します。
2. Microsoft Entra ID のログイン画面に遷移することを確認します。
3. ログイン後にアプリへ戻ることを確認します。

失敗する場合は、Frontend SPA app registration に `https://<swa-hostname>` が redirect URI として登録されているか確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

## 6. CRUD を確認する

ログイン後、次の操作を確認します。

1. 投稿を作成する。
2. 投稿一覧で作成した投稿を開く。
3. 投稿を編集する。
4. 投稿を削除する。

## 7. テレメトリの初期流入を確認する

Application Insights 名を取得します。

```bash
export APPINSIGHTS_NAME="$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appInsightsName.value" -o tsv)"

echo "$APPINSIGHTS_NAME"
```

ポータルで Application Insights を開き、Live Metrics または Logs に移動します。テレメトリの反映には数分かかることがあります。

## 次に進む

- [Day 2: 監視と運用](day-2-operations.ja.html)
