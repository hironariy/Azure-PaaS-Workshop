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
3. 受講者本人のアカウントでログインします。ユーザー同意が表示され、テナントの方針が許可する場合は本人が内容を確認して同意します。
4. ログイン後に同じアプリへ戻ることを確認します。

サポートによる本人認証の代行や、無条件の管理者同意はこの確認に含めません。管理者の承認が必要と表示された場合は、Azure Owner / Contributor であることだけでは解消できないため、ブロックとして記録します。ブラウザーの token / Authorization header はコピー・記録・共有しないでください。

Day 0 で `Principal` grant を作成済みなら同意画面が再表示されなくても正常です。ブラウザーでも Day 0 と同じ本人アカウントを使い、[Day 0 の grant 確認](day-0-entra-id.ja.html)と認証 CRUD を併せて確認してください。別ユーザーにはこの grant は適用されません。

`AADSTS50011` などの戻り先エラーの場合は、Day 0 で作成した Frontend アプリの **SPA** 設定に、現在ブラウザーで開いている `https://$SWA_HOSTNAME` が登録されているか確認します。localhost のみ、別の SWA hostname、または Web 設定だけへの登録では、このアプリの戻り先を満たしません。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

不足している場合は、[インフラ配備の手順 7](day-1-deploy-infrastructure.ja.html)を再実行し、既存 URI を保持して実 URL を追加します。Entra への遷移成功だけでは同意・API token・認証 CRUD が完了したとは判断しません。

## 6. CRUD を確認する

ログイン後、今回作成するテスト投稿だけで確認します。画面のボタン名は英語です。

| 操作 | 手順 | 期待結果 |
|---|---|---|
| 作成 | **My Posts → Create New Post**。Title に `日本語の動作確認`、Content に `日本語の本文です。保存と表示を確認します。`、Excerpt に `日本語の要約`、Tags に `日本語, Azure` を入力。**Draft → Create Post** を選択 | 詳細画面に移動し、下書きとして日本語の各項目が保存される。公開一覧と未認証の詳細では見えない |
| 読取 | 投稿 URL を控え、詳細画面を再読み込み。**My Posts** からも同じ投稿を開く | 日本語のタイトル・本文・タグが保持される |
| 更新・公開 | **Edit** でタイトルと本文に `更新済み` を追記。Status を **Published** にして **Save Changes**。トップページの一覧も確認 | 更新内容が保存され、編集前と同じ投稿 URL で開ける。公開後の一覧には日本語の要約が表示される |
| 公開後の読取 | 未ログインの別ブラウザー／別プロファイルで、控えた投稿 URL を開く | 公開した記事が表示される。同じブラウザーの別タブはログイン状態を共有するため使わない |
| 削除 | ログイン中の画面で、今回の投稿の **Delete** と確認ダイアログを承認。控えた URL を再読み込み | **My Posts** から消え、URL は **Post Not Found** になる。他の投稿は削除しない |

追加の文字種確認には `中文文章`、`한국어 제목`、絵文字のみの `😀`、`!!!` のような記号タイトルを使えます。`Draft` と `Publish Now` の両方で保存できること、同じタイトルで 2 件作成しても URL が重複せずそれぞれの詳細を開けることを確認し、作成したテスト投稿は最後に削除します。URL に日本語や `%` エンコードが含まれていても、ブラウザーに表示された URL をそのまま使い、手作業で二重にエンコードしないでください。

他ユーザーの投稿は編集・削除しません。成功・失敗した操作と発生時刻を記録し、エラー画面を共有する場合は個人情報を隠し、パスワード、MFA コード、token、通信ログ全体は共有しません。詳細の閲覧回数は増えるため、content integrity と view count を混同しません。

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
