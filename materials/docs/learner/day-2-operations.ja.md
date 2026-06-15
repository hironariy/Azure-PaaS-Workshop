---
title: "Day 2: 監視と運用"
---

# Day 2: 監視と運用

Day 2 では、PaaS アプリケーションの状態を Azure の標準機能で確認します。OS へ SSH するのではなく、App Service、Application Insights、Log Analytics、Key Vault、Managed Identity を使って切り分けます。

## 1. 変数を復元する

```bash
cd ~/Azure-PaaS-Workshop
source ~/paas-workshop.env
```

## 2. App Service の設定を確認する

```bash
az webapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{name:name,state:state,hostNames:hostNames,httpsOnly:httpsOnly}" \
  -o jsonc
```

ヘルスチェックパスを確認します。

```bash
az webapp config show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{linuxFxVersion:linuxFxVersion,healthCheckPath:healthCheckPath,alwaysOn:alwaysOn}" \
  -o jsonc
```

## 3. アプリケーションログを確認する

```bash
az webapp log tail \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

終了するときは `Ctrl+C` を押します。

ログを ZIP で取得する場合:

```bash
az webapp log download \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --log-file ~/app-logs.zip
```

## 4. Key Vault reference を確認する

App Service の Managed Identity が Key Vault の secret を参照します。Cosmos DB 接続文字列が Key Vault reference になっていることを確認します。Application Insights 接続文字列は通常のアプリ設定として入ります。

```bash
az webapp config appsettings list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='COSMOS_CONNECTION_STRING' || name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].{name:name,value:value}" \
  -o table
```

Managed Identity の principalId を確認します。

```bash
export APP_PRINCIPAL_ID="$(az webapp identity show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query principalId -o tsv)"

echo "$APP_PRINCIPAL_ID"
```

## 5. Application Insights / Log Analytics を開く

```bash
export APPINSIGHTS_NAME="$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appInsightsName.value" -o tsv)"

export WORKSPACE_ID="$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.logAnalyticsWorkspaceId.value" -o tsv)"

echo "Application Insights: $APPINSIGHTS_NAME"
echo "Workspace ID: $WORKSPACE_ID"
```

KQL 例:

```kusto
requests
| where timestamp > ago(1h)
| summarize count(), failures=countif(success == false) by bin(timestamp, 5m)
| order by timestamp desc
```

```kusto
exceptions
| where timestamp > ago(1h)
| order by timestamp desc
```

詳細は [監視ガイド](../monitoring-guide.ja.html) を参照してください。

## 6. PaaS らしい切り分け順

1. Static Web Apps の URL が開けるか。
2. `https://<swa>/api/health` が成功するか。
3. `https://<app-service>/health` が成功するか。
4. App Service logs に起動エラーがないか。
5. Key Vault reference が解決できているか。
6. Application Insights に failed requests / exceptions が出ていないか。

## 次に進む

- [Day 2: 信頼性と復旧](day-2-reliability.ja.html)
