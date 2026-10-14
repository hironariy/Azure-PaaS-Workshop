---
title: "Day 2: 監視と運用"
---

# Day 2: 監視と運用

Day 2 では、PaaS アプリケーションの稼働状態を Azure の標準機能で確認します。仮想マシン（VM）へ SSH 接続して調査するのではなく、App Service、Application Insights、Log Analytics、Key Vault、マネージド ID を組み合わせて状態を確認・切り分けます。

## 1. 変数を確認する

> 💡 Cloud Shell が再接続されて変数が消えた場合のみ、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load deployed` を先に実行してください。

```bash
echo "RESOURCE_GROUP=$RESOURCE_GROUP"
echo "APP_SERVICE_NAME=$APP_SERVICE_NAME"
```

## 2. App Service の設定を確認する

App Service の稼働状態や HTTPS 設定を確認します。

```bash
az webapp show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{name:name,state:state,hostNames:hostNames,httpsOnly:httpsOnly}" \
  -o jsonc
```

ランタイムバージョン、ヘルスチェックパス（`/health`）、Always On の設定を確認します。

```bash
az webapp config show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{linuxFxVersion:linuxFxVersion,healthCheckPath:healthCheckPath,alwaysOn:alwaysOn}" \
  -o jsonc
```

## 3. アプリケーションログを確認する

App Service のリアルタイムログストリームを表示します。

```bash
az webapp log tail \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

確認を終えたら `Ctrl+C` を押して終了します。

> **注意:** ログをチーム内や Issue で共有する際は、接続文字列・パスワード・アクセストークン・個人情報などが含まれていないことを確認してください。

## 4. Key Vault 参照とマネージド ID を確認する

App Service はシステム割り当てマネージド ID を使って Key Vault から接続文字列を参照しています。秘密情報そのものは表示せず、環境変数名（設定キー）が存在することを確認します。

```bash
az webapp config appsettings list \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='COSMOS_CONNECTION_STRING' || name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].name" \
  -o table
```

Azure Portal の **App Service > 環境変数** 画面では、Key Vault 参照のステータスに緑色のチェックマークが付いているかも確認できます。

続けて、App Service のマネージド ID（`principalId`）を確認します。

```bash
APP_PRINCIPAL_ID="$(az webapp identity show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query principalId -o tsv)"

echo "$APP_PRINCIPAL_ID"
```

## 5. Application Insights / Log Analytics でクエリを実行する

デプロイ出力から Application Insights 名と Log Analytics ワークスペース ID を確認します。

```bash
APPINSIGHTS_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appInsightsName.value" -o tsv)"

WORKSPACE_ID="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.logAnalyticsWorkspaceId.value" -o tsv)"

echo "Application Insights: $APPINSIGHTS_NAME"
echo "Workspace ID: $WORKSPACE_ID"
```

> **テーブル名の違いについて:**
> Log Analytics ワークスペースの **Logs（ログ）** 画面からクエリを実行する場合、テーブル名は `AppRequests` / `AppExceptions` になります（Application Insights リソース側の **Logs** 画面では `requests` / `exceptions` が使われます）。

まず、直近 24 時間でデータが記録されているテーブルを確認します。

```kusto
search *
| where TimeGenerated > ago(24h)
| summarize Records=count() by $table
| order by Records desc
```

直近 1 時間のリクエスト数と失敗数を 5 分単位で集計します。

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| summarize Requests=count(), Failures=countif(Success == false) by bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

直近 1 時間の例外（Exceptions）を種類別に集計します。

```kusto
AppExceptions
| where TimeGenerated > ago(1h)
| summarize Exceptions=count() by ExceptionType, bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

`AppRequests` や `AppExceptions` がまだ表示されない場合は、次のスクリプトでアプリケーションへリクエストを送信し、数分待ってから再度クエリを実行してください。

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR"
```

さらに詳しい KQL クエリ例やアラート設計については、[監視ガイド](../monitoring-guide.ja.html) を参照してください。

## 6. PaaS アプリケーションの基本的な切り分け順序

障害や応答異常が発生した際は、上から順番に確認すると原因を素早く切り分けられます。

1. Static Web Apps のトップページ（`https://<SWA_HOSTNAME>`）が表示されるか。
2. Static Web Apps 経由の API ヘルスチェック（`https://<SWA_HOSTNAME>/api/health`）が成功するか。
3. App Service 直接のヘルスチェック（`https://<APP_HOSTNAME>/health`）が成功するか。
4. App Service のログストリーム（`az webapp log tail`）に起動エラーや例外が出ていないか。
5. App Service の環境変数で Key Vault 参照が正常に解決されているか。
6. Application Insights / Log Analytics に失敗リクエスト（`AppRequests`）や例外（`AppExceptions`）が記録されていないか。

## 次に進む

- [Day 2: 信頼性と復旧](day-2-reliability.ja.html)
