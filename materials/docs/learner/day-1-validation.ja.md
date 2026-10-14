---
title: "Day 1: アプリケーションの動作確認"
---

# Day 1: アプリケーションの動作確認

デプロイした PaaS アプリケーションが、App Service への直接アクセスと Static Web Apps 経由の両方で正しく動作することを確認します。

## 1. 変数を確認する

> 💡 Cloud Shell が再接続されて変数が消えた場合のみ、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load deployed` を先に実行してください。

```bash
echo "RESOURCE_GROUP=$RESOURCE_GROUP"
echo "APP_SERVICE_NAME=$APP_SERVICE_NAME"
echo "SWA_HOSTNAME=$SWA_HOSTNAME"
```

## 2. App Service の直接ヘルスチェック

```bash
APP_HOSTNAME="$(az webapp show --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" --query defaultHostName -o tsv)"
curl --connect-timeout 5 --max-time 10 -fsS "https://${APP_HOSTNAME}/health" | jq .
```

期待される出力:

```json
{
  "status": "healthy"
}
```

## 3. Static Web Apps 経由のヘルスチェック

Static Web Apps の Linked Backend（`/api/*`）を経由して、バックエンドのヘルスチェックが応答することを確認します。

```bash
curl --connect-timeout 5 --max-time 10 -fsS "https://${SWA_HOSTNAME}/api/health" | jq .
```

期待される出力:

```json
{
  "status": "healthy"
}
```

`404` が返る場合は、Static Web Apps へのフロントエンドデプロイが完了しているか、Static Web Apps が `Standard` SKU で作成され Linked Backend が構成されているかを確認してください。

### 公開エンドポイントを一括チェックする

次のスクリプトを実行すると、App Service 直接の `/health`、Static Web Apps 経由の `/api/health`、両経路での公開記事一覧 API（`/api/posts`）、およびフロントエンドの `window.__APP_CONFIG__` をまとめて確認できます。

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR"
```

出力に `"status": "public_checks_passed"` が表示されれば、公開エンドポイントの疎通確認は完了です。

| エラーの傾向 | 主な確認ポイント |
|---|---|
| タイムアウト / 通信エラー | DNS 解決、App Service の起動状態、Azure Service Health を確認する |
| HTTP 401 / 403 | App Service の認証設定（EasyAuth の匿名許可パス）や API の Audience / Scope 設定を確認する |
| HTTP 404 / HTML が返る | Static Web Apps の Linked Backend 設定や `staticwebapp.config.json` のルーティングを確認する |
| HTTP 503 / `unhealthy` | App Service の VNet 統合、Key Vault 参照の解決状態、Cosmos DB への接続を確認する |
| 設定値の不一致 | フロントエンドの `window.__APP_CONFIG__` に最新の Client ID が注入されているか確認する |

## 4. ブラウザーで画面を開く

Cloud Shell で Static Web Apps の URL を表示し、ブラウザーで開きます。

```bash
echo "https://$SWA_HOSTNAME"
```

トップページが表示されることを確認します。

## 5. Microsoft Entra ID でサインインする

1. 画面右上の **Sign in with Microsoft**（サインイン）ボタンを選択します。
2. Microsoft Entra ID のサインイン画面に遷移することを確認します。
3. Cloud Shell と同じ受講者本人のアカウントでサインインします（Day 0 で本人の `Principal` 同意を設定済みのため、同意画面はスキップされる場合があります）。
4. サインイン後にブログアプリの画面へ戻り、自分のユーザー名や **My Posts** メニューが表示されることを確認します。

> **サインイン時に `AADSTS50011`（リダイレクト URI 不一致）が表示された場合:**
> フロントエンドのアプリ登録に `https://$SWA_HOSTNAME` が SPA リダイレクト URI として登録されているか確認します。
>
> ```bash
> az ad app show \
>   --id "$FRONTEND_CLIENT_ID" \
>   --query "spa.redirectUris" -o jsonc
> ```
>
> 含まれていない場合は、[Day 1: PaaS インフラのデプロイの手順 7](day-1-deploy-infrastructure.ja.html) を再実行して追加してください。

## 6. 記事の作成・更新・公開・削除（CRUD）を確認する

サインイン後、テスト記事を作成して一連の操作を確認します。

| 操作 | 手順 | 期待される結果 |
|---|---|---|
| 1. 下書き作成 | **My Posts → Create New Post** を開き、Title に `日本語の動作確認`、Content に `日本語の本文です。保存と表示を確認します。`、Excerpt に `日本語の要約`、Tags に `日本語, Azure` を入力し、**Draft → Create Post** を選択 | 記事詳細画面に移動し、日本語の各項目が下書きとして保存される（未ログイン状態の公開一覧には表示されない） |
| 2. 読み取り | 記事詳細画面を再読み込みし、**My Posts** 一覧からも同じ記事を開く | 日本語のタイトル・本文・タグが文字化けせず表示される |
| 3. 更新と公開 | **Edit** を選択し、タイトルと本文に `更新済み` を追記して Status を **Published** に変更し、**Save Changes** を選択 | 更新内容が保存され、トップページの公開記事一覧にも表示される |
| 4. 公開記事の閲覧 | シークレットウィンドウ（未ログイン状態）で公開一覧と記事 URL を開く | 未ログインでも公開した記事を閲覧できる |
| 5. 削除 | ログイン中の画面でテスト記事の **Delete** を選択して削除する | **My Posts** および公開一覧から消え、記事 URL を開くと **Post Not Found** になる |

※ 次の Day 2（監視・復旧演習）でも記事データの保持を確認するため、確認用の公開記事を 1 件作成して残しておくとスムーズです。

## 7. Application Insights のテレメトリを確認する

Application Insights のリソース名を確認します。

```bash
APPINSIGHTS_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appInsightsName.value" -o tsv)"

echo "$APPINSIGHTS_NAME"
```

Azure Portal で該当の Application Insights を開き、**Live Metrics** または **Logs（ログ）** を確認します。テレメトリの反映には 2〜5 分ほどかかる場合があります。

**Logs** で次の KQL クエリを実行し、直近 15 分間のリクエスト数・失敗数・95 パーセンタイル応答時間を確認します。

```kql
requests
| where timestamp > ago(15m)
| summarize requests=count(), failures=countif(success == false),
    p95_ms=percentile(duration, 95) by bin(timestamp, 1m)
| order by timestamp desc
```

## 8. 起動状態・マネージド ID・Key Vault 接続を確認する

App Service の実行状態、マネージド ID、スタートアップ設定は次のコマンドで確認できます。

```bash
az webapp show --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" \
  --query '{state:state,hostname:defaultHostName,principalId:identity.principalId}' -o jsonc
az webapp config show --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" \
  --query '{startup:appCommandLine,runtime:linuxFxVersion,healthPath:healthCheckPath}' -o jsonc
```

`state` が `Running`、`startup` が `node dist/src/app.js`、`healthPath` が `/health` になっていれば正常です。

| 症状 | 確認するポイント |
|---|---|
| スタートアップやランタイムの不一致 | デプロイ ZIP に `dist/src/app.js` が含まれているか、`appCommandLine` が `node dist/src/app.js` になっているか |
| Key Vault 参照エラー | Azure Portal の App Service > **環境変数** で Key Vault 参照のステータスに緑色のチェックが付いているか、`Key Vault Secrets User` ロールが割り当てられているか |
| Key Vault 解決済みだが `/health` が失敗する | App Service の VNet 統合、Cosmos DB の Private Endpoint / Private DNS Zone、DB 接続設定を確認する |

## 次に進む

- [Day 2: 監視と運用](day-2-operations.ja.html)
