# 監視ガイド（Azure Monitor + Application Insights + Log Analytics）

このガイドでは、Azure PaaS ワークショップのブログアプリケーションを監視・トラブルシュートする方法を解説します。

> **演習手順について:** Cloud Shell から順番に実行する手順は [Day 2: 監視と運用](learner/day-2-operations.ja.html) を参照してください。このページは監視設計と KQL クエリのリファレンスです。

- **フロントエンド**: Azure Static Web Apps (`Standard`)
- **バックエンド**: Azure App Service（`/health`, `/api/health`）
- **データベース**: Azure Cosmos DB for MongoDB vCore
- **監視基盤**: Application Insights（ワークスペースベース）+ Log Analytics

---

## 1. 監視の目的

PaaS アプリケーションの運用では、主に次の 3 つの問いに素早く答えられることを目指します。

1. **サービスは利用可能か？**（フロントエンド表示、ヘルスチェック応答、HTTP エラー率）
2. **依存サービスは健全か？**（Key Vault シークレット解決、Cosmos DB 接続、Entra 認証）
3. **パフォーマンスは維持されているか？**（API の応答時間、リソース使用率）

---

## 2. Bicep で構成される監視リソース

`materials/bicep/modules/monitoring.bicep` と `appservice.bicep` によって、以下の設定が自動的に構成されます。

- Log Analytics ワークスペース（`PerGB2018`）と日次データ上限（Daily Cap）
- ワークスペース連携の Application Insights
- App Service の `APPLICATIONINSIGHTS_CONNECTION_STRING` と Node.js テレメトリ設定
- App Service のヘルスチェックパス `/health`

---

## 3. 監視シグナルの整理

### 3.1 可用性シグナル
- App Service 直接のヘルスチェック（`/health`）
- Static Web Apps Linked Backend 経由のヘルスチェック（`/api/health`）
- HTTP ステータスコードの分布（2xx / 4xx / 5xx）

### 3.2 信頼性・エラーシグナル
- Application Insights の失敗リクエスト（`AppRequests` で `Success == false`）と例外（`AppExceptions`）
- App Service の Key Vault 参照ステータス
- App Service ログストリーム上の起動エラーや DB 接続エラー

### 3.3 性能シグナル
- API リクエストの応答時間（P50 / P95 / P99）
- Cosmos DB など外部依存呼び出しの応答時間（`AppDependencies`）
- App Service Plan の CPU / メモリ使用率

---

## 4. KQL クエリ集（Log Analytics ワークスペース用）

> **補足:** Log Analytics ワークスペースの **Logs（ログ）** 画面では、Application Insights のテーブル名は `AppRequests` / `AppExceptions` / `AppDependencies` になります（Application Insights リソース側の Logs 画面では `requests` / `exceptions` / `dependencies` が使われます）。

### 4.1 直近 24 時間でデータが記録されているテーブルを確認する

```kusto
search *
| where TimeGenerated > ago(24h)
| summarize Records=count() by $table
| order by Records desc
```

### 4.2 HTTP 失敗リクエストと 95 パーセンタイル応答時間を確認する

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| where Success == false or ResultCode startswith "5"
| summarize Failures=count(), P95DurationMs=percentile(DurationMs, 95)
    by ResultCode, bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

### 4.3 時間帯別の API 応答時間（P95）の推移を確認する

```kusto
AppRequests
| where TimeGenerated > ago(24h)
| summarize P95DurationMs=percentile(DurationMs, 95) by bin(TimeGenerated, 5m)
| order by P95DurationMs desc
```

### 4.4 発生した例外（Exceptions）を種類別に集計する

```kusto
AppExceptions
| where TimeGenerated > ago(24h)
| summarize Exceptions=count() by ExceptionType
| order by Exceptions desc
```

### 4.5 テーブルが表示されない場合の対処

デプロイ直後などでまだリクエストが送信されていない場合、`AppRequests` や `AppExceptions` テーブルが表示されないことがあります。次のコマンドでヘルスチェックと公開 API へのリクエストを発生させ、数分待ってから再度クエリを実行してください。

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR"
```

また、App Service に `APPLICATIONINSIGHTS_CONNECTION_STRING` が設定されているかは次のコマンドで確認できます。

```bash
az webapp config appsettings list \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].name" \
  -o table
```

---

## 5. 本番運用に向けたアラート設計の例

本番環境では、以下のような条件で Azure Monitor のアラートルールとアクショングループ（メール / Teams / PagerDuty 通知など）を設定することを推奨します。

- 直近 5 分間の HTTP 5xx エラー率が 5% を超えた場合
- `/health` エンドポイントの正常応答率がしきい値を下回った場合
- API の P95 応答時間が目標値（例: 2,000 ms）を超えた場合
- 未処理例外（`AppExceptions`）が短時間に急増した場合

---

## 6. 障害切り分けの基本フロー

問題が発生した際は、ユーザーに近い側から順番に確認すると原因を特定しやすくなります。

1. **フロントエンド到達性**: Static Web Apps のトップページが表示されるか。
2. **SWA 経由の API 疎通**: `https://<SWA_HOSTNAME>/api/health` が 200 を返すか。
3. **バックエンド直接の疎通**: `https://<APP_HOSTNAME>/health` が 200 を返すか。
4. **アプリケーションログと例外**: `az webapp log tail` や `AppExceptions` にエラーが出ていないか。
5. **シークレットと DB 接続**: Key Vault 参照が解決されているか、Cosmos DB への接続エラーが出ていないか。
