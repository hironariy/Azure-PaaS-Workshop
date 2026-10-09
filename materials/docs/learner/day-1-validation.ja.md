---
title: "Day 1: アプリを検証"
---

# Day 1: アプリを検証

デプロイした PaaS アプリケーションが、App Service 直接経路と Static Web Apps 経由の両方で動作することを確認します。

## 1. 変数を復元する

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1
```

## 2. App Service 直接ヘルスチェック

```bash
APP_HOSTNAME="$(az webapp show --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" --query defaultHostName -o tsv)" || exit 1
curl --connect-timeout 5 --max-time 10 -fsS "https://${APP_HOSTNAME}/health" | jq .
```

期待値:

```json
{
  "status": "healthy"
}
```

## 3. Static Web Apps 経由ヘルスチェック

```bash
curl --connect-timeout 5 --max-time 10 -fsS "https://${SWA_HOSTNAME}/api/health" | jq .
```

期待値:

```json
{
  "status": "healthy"
}
```

`404` の場合は、Static Web Apps へのフロントエンドデプロイが完了しているか、SWA Linked Backend が Standard SKU で作成されているかを確認します。

### 公開経路の応答契約をまとめて検証する

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

実際の App Service hostname と保存した SWA を照合し、直接 / SWA の healthy JSON、両経路の公開記事一覧の pagination、Frontend runtime config と保存済み client ID を検査します。HTTP 200 でも HTML や不正 JSON なら停止します。要求は GET のみ、10 秒 timeout、応答は最大 1 MiB とし、トークン・レスポンス本文をログへ出しません。大きな投稿で probe 上限に達した場合も成功扱いにせず、payload サイズを別途確認します。

結果は `public_checks_passed` でも **`workshopReady: false`** です。サインイン・自己同意・認証付き CRUD・新 release・telemetry・復旧は続く別検証です。`/live` / `/ready` は本線 EasyAuth の匿名除外に含まれないため、匿名チェックを通す目的で認証を無効化しません。記事詳細 GET は view count を更新するため、自動 probe は記事一覧までに留めます。

| 結果 | 切り分け |
|---|---|
| transport / timeout | DNS・到達経路・service health・起動状態。すぐ SKU を上げない |
| 401 / 403 | EasyAuth の匿名公開対象・SWA provider・API audience / scope。認証を無効化しない |
| 404 / HTML | Linked Backend / SPA fallback / API routing。200 HTML を API 成功にしない |
| 503 / unhealthy | DB 接続・startup・Managed Identity / Key Vault / private network |
| config mismatch | 古い Frontend / 別アプリ ID / `NODE_ENV` / runtime config 注入 |

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

[Day 0 の自己同意検証](day-0-entra-id.ja.html#day-1-のサインイン後に自己同意を検証する) も実施し、対象ユーザーの Principal grant と API scope を確認します。管理者承認が必要なら Contributor-only 本線はブロックであり、AllPrincipals grant や tenant policy 変更で回避しません。ブラウザーの token / Authorization header はコピー・記録・共有しないでください。

失敗する場合は、Frontend SPA app registration に `https://<swa-hostname>` が redirect URI として登録されているか確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

## 6. CRUD を確認する

ログイン後、次の操作を確認します。

1. 自分の演習用タイトル・本文・タグで **draft** を作成し、My Posts で再表示する。公開一覧と未認証の詳細では見えないことを確認する。
2. **published** に変更し、公開一覧・詳細で同じタイトル・本文を確認する。日本語タイトル、絵文字のみ、`!!!` のような記号タイトル、同じタイトルの 2 件を試し、異なる nonempty slug と正常な画面遷移を確認する（#14 の修正が前提）。
3. 投稿を編集し、再読み込みして変更が保存されていることを確認する。API の失敗通知を隠さず、画面だけ変わった状態を保存成功としない。
4. 自分のテスト投稿だけを削除し、一覧 / My Posts から消え、元の詳細 URL が 404 になることを確認する。

他ユーザーの投稿は編集・削除しません。記録はテスト名・非秘密の投稿 ID/slug・状態・時刻・結果だけにし、実データ本文や token を証拠へ貼りません。詳細の閲覧回数は増えるため、content integrity と view count を混同しません。HTTP 200 やサインインだけでは DB write / 認可 / persistence の証拠になりません。

公開状態でも同じ操作を確認します。同じタイトルで 2 件作成しても URL が重複せず、それぞれの詳細を開けることを確認します。新規 URL は Unicode の文字を保持し、絵文字・記号のみのタイトルには識別子を使います。既存記事の URL は変更しません。タイトル編集後も URL は維持されます。

## 7. テレメトリの初期流入を確認する

Application Insights 名を取得します。

```bash
APPINSIGHTS_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appInsightsName.value" -o tsv)" || exit 1

echo "$APPINSIGHTS_NAME"
```

ポータルで Application Insights を開き、Live Metrics または Logs に移動します。テレメトリの反映には数分かかることがあります。

検証を開始した UTC 時刻以降の request / dependency の **集計** を確認します。ログの生の message / URL query / request body を共有せず、0 件を「エラーが無い」と解釈しません。数分待っても 0 件なら、対象 resource / 時間範囲 / SDK 起動 / instrumentation 設定を確認します。

```kql
requests
| where timestamp > ago(15m)
| summarize requests=count(), failures=countif(success == false),
    p95_ms=percentile(duration, 95) by bin(timestamp, 1m)
| order by timestamp desc
```

## 8. 起動・MI・Key Vault・DB を秘密値なしで切り分ける

最初に Azure Portal の Resource Health / Service Health を確認し、その後 Deployment Center の今回の deployment 完了、App Service の起動状態を確認します。プラットフォーム障害・起動失敗・DB readiness は別です。対象が実際に存在する場合は **Diagnose and solve problems (AppLens)** の startup / availability 診断も使います。

```bash
az webapp show --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" \
  --query '{state:state,hostname:defaultHostName,principalId:identity.principalId}' -o jsonc
az webapp config show --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" \
  --query '{startup:appCommandLine,runtime:linuxFxVersion,healthPath:healthCheckPath}' -o jsonc
```

期待値は `Running`、system-assigned MI の principal ID、Node.js 24 runtime、`node dist/src/app.js`、health path `/health` です。MI principal ID と Entra Backend client ID は別の ID です。App settings / Key Vault の秘密値は取得・表示しません。

| 観測 | 次の確認 |
|---|---|
| startup / runtime 不一致 | production ZIP の `dist/src/app.js`・startup command・remote build 設定 |
| Key Vault reference 未解決 | Portal の reference **status**、MI、Secrets User の scope、KV private endpoint / DNS |
| reference 解決済みで health が unhealthy | App Service の VNet integration、DocumentDB private endpoint / DNS、DB 認証・接続 |
| health が healthy で公開一覧が失敗 | DB read query / application route / EasyAuth、同じ deployment の sanitized error code |
| CRUD が失敗 | tenant / audience / scope・入力検証・認可・DB write。token と接続文字列はログに出さない |

Cloud Shell から private DB / Key Vault へ直接届かないことだけで App Service の接続失敗と判断しません。VM / SSH / Bastion や public DB への切り替えを本線の回避策にしません。Secrets User を Contributor で追加できない場合は #16 の制約で停止します。

診断ログを使う場合は必要な期間だけ見て、connection string・password・token・個人データを伏せます。未加工の ZIP logs、app settings、request headers を Issue / PR に貼らないでください。再起動・再 deploy・SKU 変更は原因確認と承認範囲に従い、diagnostics が成功したことと復旧したことを区別します。

## 次に進む

- [Day 2: 監視と運用](day-2-operations.ja.html)
