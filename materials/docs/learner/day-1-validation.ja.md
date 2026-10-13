---
title: "Day 1: アプリを検証"
---

# Day 1: アプリを検証

デプロイした PaaS アプリケーションが、App Service 直接経路と Static Web Apps 経由の両方で動作することを確認します。

## 1. 変数を復元する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
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
3. 受講者本人のアカウントでログインします。ユーザー同意が表示され、テナントの方針が許可する場合は本人が内容を確認して同意します。
4. ログイン後に同じアプリへ戻ることを確認します。

サポートによる本人認証の代行や、無条件の管理者同意はこの確認に含めません。管理者の承認が必要と表示された場合は、Azure Owner / Contributor であることだけでは解消できないため、ブロックとして記録します。

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
| 作成 | **My Posts → Create New Post**。Title に `日本語の動作確認`、Content に `日本語の本文です。保存と表示を確認します。`、Excerpt に `日本語の要約`、Tags に `日本語, Azure` を入力。**Draft → Create Post** を選択 | 詳細画面に移動し、下書きとして日本語の各項目が保存される |
| 読取 | 投稿 URL を控え、詳細画面を再読み込み。**My Posts** からも同じ投稿を開く | 日本語のタイトル・本文・タグが保持される |
| 更新・公開 | **Edit** でタイトルと本文に `更新済み` を追記。Status を **Published** にして **Save Changes**。トップページの一覧も確認 | 更新内容が保存され、編集前と同じ投稿 URL で開ける。公開後の一覧には日本語の要約が表示される |
| 公開後の読取 | 未ログインの別ブラウザー／別プロファイルで、控えた投稿 URL を開く | 公開した記事が表示される。同じブラウザーの別タブはログイン状態を共有するため使わない |
| 削除 | ログイン中の画面で、今回の投稿の **Delete** と確認ダイアログを承認。控えた URL を再読み込み | **My Posts** から消え、URL は **Post Not Found** になる。他の投稿は削除しない |

追加の文字種確認には `中文文章`、`한국어 제목`、絵文字のみの `😀` を使えます。`Draft` と `Publish Now` の両方で保存できること、同じタイトルの別投稿も保存できることを確認し、作成したテスト投稿は最後に削除します。URL に日本語や `%` エンコードが含まれていても、ブラウザーに表示された URL をそのまま使い、手作業で二重にエンコードしないでください。

成功・失敗した操作と発生時刻を記録します。エラー画面を共有する場合は個人情報を隠し、パスワード、MFA コード、token、通信ログ全体は共有しません。

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
