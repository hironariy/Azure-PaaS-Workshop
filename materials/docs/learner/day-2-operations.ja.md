---
title: "Day 2: 監視と運用"
---

# Day 2: 監視と運用

Day 2 では、PaaS アプリケーションの状態を Azure の標準機能で確認します。OS へ SSH するのではなく、App Service、Application Insights、Log Analytics、Key Vault、Managed Identity を使って切り分けます。

## 1. 変数を復元する

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1
```

## 2. App Service の設定を確認する

```bash
az webapp show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{name:name,state:state,hostNames:hostNames,httpsOnly:httpsOnly}" \
  -o jsonc
```

ヘルスチェックパスを確認します。

```bash
az webapp config show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{linuxFxVersion:linuxFxVersion,healthCheckPath:healthCheckPath,alwaysOn:alwaysOn}" \
  -o jsonc
```

## 3. アプリケーションログを確認する

```bash
az webapp log tail \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

終了するときは `Ctrl+C` を押します。

必要な期間の startup / error code を確認し、connection string、password、token、request body、個人データを伏せます。未加工の logs ZIP / headers / app settings を Issue / PR に共有しません。復旧検証では操作の UTC 時刻と集計を対応付けます。

## 4. Key Vault reference を確認する

App Service の Managed Identity が Key Vault の secret を参照します。設定名だけを確認し、秘密値・接続文字列は表示しません。Portal の Key Vault reference **status** が解決済みかを確認します。reference の文字列が設定されているだけでは secret の取得成功とは言えません。

```bash
az webapp config appsettings list \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='COSMOS_CONNECTION_STRING' || name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].name" \
  -o table
```

Managed Identity の principalId を確認します。

```bash
APP_PRINCIPAL_ID="$(az webapp identity show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query principalId -o tsv)" || exit 1

echo "$APP_PRINCIPAL_ID"
```

## 5. Application Insights / Log Analytics を開く

```bash
APPINSIGHTS_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appInsightsName.value" -o tsv)" || exit 1

WORKSPACE_ID="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.logAnalyticsWorkspaceId.value" -o tsv)" || exit 1

echo "Application Insights: $APPINSIGHTS_NAME"
echo "Workspace ID: $WORKSPACE_ID"
```

Log Analytics ワークスペースの Logs から実行する場合、workspace-based Application Insights のテーブル名は `AppRequests` / `AppExceptions` です。Application Insights リソースの Logs では `requests` / `exceptions` の別名が使える場合があります。

まず、直近でデータが入っているテーブルを確認します。

```kusto
search *
| where TimeGenerated > ago(24h)
| summarize Records=count() by $table
| order by Records desc
```

KQL 例:

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| summarize Requests=count(), Failures=countif(Success == false) by bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

```kusto
AppExceptions
| where TimeGenerated > ago(1h)
| summarize Exceptions=count() by ExceptionType, bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

`AppRequests` / `AppExceptions` も表示されない場合は、先にアプリへリクエストを送ってから数分待ちます。

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

それでも表示されない場合は、対象 resource / 時間範囲 / SDK startup / instrumentation 設定を Portal で確認します。0 件は「障害が無い」「監視が正常」という証拠ではありません。原因確認なしで再起動・SKU 変更を行わず、[Day 1 diagnostics](day-1-validation.ja.html) の Resource Health → startup → MI / KV → DB の順で切り分けます。

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
