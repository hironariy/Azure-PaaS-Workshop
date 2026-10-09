# 監視ガイド（Azure Monitor + Application Insights + Log Analytics）

このガイドでは、Azure PaaS ワークショップのブログアプリケーションを監視・トラブルシュートする方法を説明します。

> **受講者本線:** Cloud Shell 専用の Day 2 手順は [Day 2: 監視と運用](learner/day-2-operations.ja.html) を参照してください。このガイドは監視設計と KQL の参照用です。

本線は B1 / M25 / HA=false / SWA Standard。設定値があるだけで telemetry ingestion / new release / recovery 成功とは言えません。以下の診断・alert は実 resource と対象時刻を確認してから行い、秘密値・token・本文・個人データ・raw logs を共有しません。

- **Frontend**: Azure Static Web Apps
- **Backend**: Azure App Service（`/health`, `/api/health`）
- **Database**: Azure Cosmos DB for MongoDB vCore
- **Telemetry**: Application Insights（workspace-based）+ Log Analytics

---

## 1. 監視の目的

ワークショップ運用では、次の 3 点に迅速に答えられる状態を目指します。

1. **利用可能か？**（稼働状況、ヘルスチェック、エラー率）
2. **健全か？**（依存先状態、DB 接続、認証フロー）
3. **性能は維持できているか？**（API レイテンシ、失敗率、リソース飽和）

---

## 2. Bicep で既に構成されている監視基盤

`materials/bicep/modules/monitoring.bicep` で次が作成されます。

- Log Analytics ワークスペース（`PerGB2018`）
- ワークスペース連携 Application Insights
- コスト抑制のための日次上限設定

`materials/bicep/modules/appservice.bicep` では、バックエンドに次が設定されます。

- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- Node.js 向け Application Insights 拡張設定
- App Service のヘルスチェックパス `/health`

---

## 3. 推奨シグナル設計

## 3.1 可用性シグナル

- App Service ヘルスエンドポイント（`/health`）
- SWA 経由 API ヘルス（`/api/health`）
- HTTP ステータス分布（2xx/4xx/5xx）

## 3.2 信頼性シグナル

- Application Insights の failed requests / exceptions
- Key Vault reference 解決失敗
- バックエンドログ上の Cosmos DB 接続障害

## 3.3 性能シグナル

- リクエスト時間の分位点（P50/P95/P99）
- 依存呼び出しの遅延・失敗
- App Service の CPU/メモリ推移

---

## 4. 実践セットアップ手順

### 4.1 App Service ヘルスチェックを検証する

1. 通常時に `/health` が HTTP 200 を返すことを確認する。
2. フロントエンド経由で `/api/health` に到達できることを確認する。
3. EasyAuth 設定でヘルス系パスが除外されていることを確認する。

### 4.2 診断設定を有効化する（未設定の場合）

本番相当の可観測性のため、次のリソースのプラットフォームログ/メトリックを Log Analytics に送ります。

- App Service
- Static Web Apps（利用可能な診断カテゴリがある場合）
- Key Vault
- Cosmos DB クラスター関連リソース

> ワークショップの Bicep ベースラインは監視リソース作成までを担い、全リソースの診断設定を強制はしていません。

### 4.3 アプリケーションログを標準化する

- 構造化ログ（JSON フレンドリー）を維持する
- 非秘密の相関キー（request id、operation id、sanitized operation）を含める。user id / token / payload を診断証拠へ出さない
- シークレット/トークン/個人情報はログ出力しない

---

## 5. KQL クエリ例（スターター）

> Log Analytics ワークスペースの Logs では、workspace-based Application Insights のテーブル名は `AppRequests` / `AppExceptions` です。Application Insights リソースの Logs では `requests` / `exceptions` の別名が使える場合があります。以降は Log Analytics ワークスペースから実行する前提です。

### 5.1 テーブルと直近テレメトリの簡易確認

```kusto
search *
| where TimeGenerated > ago(24h)
| summarize Records=count() by $table
| order by Records desc
```

### 5.2 App Service の HTTP 失敗（Application Insights）

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| where Success == false or ResultCode startswith "5"
| summarize Failures=count(), P95DurationMs=percentile(DurationMs, 95)
    by ResultCode, bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

### 5.3 API 遅延（P95）

```kusto
AppRequests
| where TimeGenerated > ago(24h)
| summarize P95DurationMs=percentile(DurationMs, 95) by bin(TimeGenerated, 5m)
| order by P95DurationMs desc
```

### 5.4 例外の種類別集計

```kusto
AppExceptions
| where TimeGenerated > ago(24h)
| summarize Exceptions=count() by ExceptionType
| order by Exceptions desc
```

### 5.5 テーブルが見えない場合の確認

`AppRequests` / `AppExceptions` が表示されない場合は、まずバックエンドへリクエストを送って Application Insights にテレメトリを発生させます。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

数分待っても 0 件なら、対象 resource / 時間範囲 / SDK startup / instrumentation 設定を Portal で確認します。0 件は正常監視の証拠ではありません。CLI は設定名のみを表示します。

```bash
az webapp config appsettings list \
	--subscription "$SUBSCRIPTION_ID" \
	--resource-group "$RESOURCE_GROUP" \
	--name "$APP_SERVICE_NAME" \
	--query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].name" \
	-o table
```

設定の変更・再起動は原因と承認範囲を確認してから実施します。App settings の全値・logs ZIP を取得して貼る方法で診断しません。[Resource Health → startup → MI / KV → DB](learner/day-1-validation.ja.html) と、[復旧の UTC / monotonic 観測](learner/day-2-reliability.ja.html) を使います。

---

## 6. 最小アラート設計

次は追加設計案です。本線の Bicep が作成・発火検証済みではありません。実 traffic / 最小 sample count / observation window / ingestion delay / 通知先 / 費用を確認してから承認された scope で作成します。

- HTTP 5xx 比率が閾値超過（例: 5 分間で 5% 超）
- `/health` の連続失敗
- レイテンシ異常（P95 上昇）
- 例外発生の急増

通知先:

- メール / Teams / PagerDuty（チーム運用に合わせる）

---

## 7. ワークショップ向け障害切り分けフロー

次の順で確認すると切り分けが早くなります。

1. **フロントエンド到達性**（SWA が静的コンテンツを配信できるか）
2. **SWA 経由 API ヘルス**（`/api/health`）
3. **バックエンド直接ヘルス**（`/health`）
4. **Application Insights の失敗/例外**
5. **DB 依存状態**（接続失敗、タイムアウト傾向）

---

## 8. 運用上のベストプラクティス

- 環境ごとに Log Analytics ワークスペースを分離する
- アラート閾値をユーザー体感 SLO と整合させる
- 実障害を待たずに月次でアラート訓練を実施する
- MTTA/MTTR を記録し、事後レビューで改善する

---

## 9. 今後の拡張（任意）

- 講師/運用者向け Dashboard / Workbook 追加
- 診断設定とアラートを Bicep モジュール化
- ログイン〜投稿作成までの合成監視（Synthetic Probe）追加
