---
title: "Day 1: バックエンドのデプロイ"
---

# Day 1: バックエンドのデプロイ

このページでは、`materials/backend` の Node.js / TypeScript アプリケーションを Cloud Shell 上でビルドし、Azure App Service に ZIP デプロイします。

## 1. 変数を確認する

[Day 1: PaaS インフラのデプロイ](day-1-deploy-infrastructure.ja.html) から続けて作業している場合は、そのまま対象のリソースグループ名と App Service 名を確認します。

> 💡 Cloud Shell が再接続されて変数が消えた場合のみ、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load deployed` を先に実行してください。

```bash
echo "$RESOURCE_GROUP"
echo "$APP_SERVICE_NAME"
```

### デプロイ前に状態ファイルを保存・検証する

バックエンドのデプロイスクリプトは、引数のリソースグループ名と App Service 名だけでなく、**`$WORKSHOP_STATE_DIR/paas-workshop.json` に保存された設定値**を読み込みます。環境変数を設定しただけでは、この JSON ファイルは更新されません。同じ Cloud Shell セッションで続けて作業している場合も、手順 3 に進む前に以下の保存・検証を実行してください。

共通変数は[事前準備 1: Cloud Shell 設定](cloud-shell-quickstart.ja.html)で設定済みであることに加え、次の変数が必要です。

| 変数 | 値の取得元 |
|---|---|
| `BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` | [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html)の手順 2・3 で作成したアプリ登録の Client ID |
| `ACCESS_SCOPE_ID` | 同ページの手順 1・2 で設定した `access_as_user` スコープの ID |
| `APP_SERVICE_NAME`、`SWA_NAME`、`SWA_HOSTNAME` | [Day 1: PaaS インフラのデプロイ](day-1-deploy-infrastructure.ja.html)の手順 6 で取得したデプロイ先の情報 |

変数を `export` して保存処理に渡し、`deployed` 段階で必要な値をまとめて JSON に保存します。その後、保存した JSON を再読み込みして、必須項目と Azure のサブスクリプション・テナントが正しいことを検証します。

```bash
export BACKEND_CLIENT_ID FRONTEND_CLIENT_ID ACCESS_SCOPE_ID
export APP_SERVICE_NAME SWA_NAME SWA_HOSTNAME

source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" &&
workshop_state_save deployed &&
workshop_state_load deployed &&
printf 'デプロイ用の状態を保存・検証しました: %s/paas-workshop.json\n' "$WORKSHOP_STATE_DIR"
```

最後に `デプロイ用の状態を保存・検証しました: .../paas-workshop.json` と表示されることを確認してから、次の手順へ進んでください。

> **`Workshop state error: Missing state value: BACKEND_CLIENT_ID` などが出た場合:**
> 必要な変数が未設定、未保存、または別の `WORKSHOP_STATE_DIR` を参照しています。上の表の取得元で不足している変数を設定し、保存・検証を再実行してください。アプリ登録やスコープの ID は作成済みの値を使い、新しい ID に置き換えないでください。保存前に `workshop_state_load base` を実行すると、JSON に未保存の Client ID などが空に上書きされるため、現在のシェルに値がある場合は先に保存してください。

## 2. ビルド・デプロイ用のツールを確認する

```bash
node --version
npm --version
zip -v | head -1
az webapp deploy --help | head -20
```

Node.js 24 LTS の利用を推奨します。`zip` コマンドが見つからない場合は講師に相談してください。

## 3. バックエンドをビルドして App Service にデプロイする

`scripts/deploy-backend.sh` を実行すると、依存パッケージのインストール、TypeScript のビルド、本番用パッケージ（`--omit=dev`）の ZIP 作成、App Service の起動設定、ZIP デプロイ、および `/health` エンドポイントの疎通確認までが順番に実行されます。

```bash
chmod +x scripts/deploy-backend.sh
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

#### ヘルスチェック（Readiness）待機中の出力と状態一覧

ZIP のアップロード完了後（`Waiting 20s before bounded readiness checks...` の後）、初回デプロイ時は App Service のコンテナ起動・Managed Identity 初期化・Key Vault 参照解決・Cosmos DB 接続確立までに **2〜4 分程度（試行 8〜15 回前後）** かかります。途中に表示されるメッセージの意味は以下のとおりです。

| 出力メッセージ | 現在の状態 | 次のアクション |
|---|---|---|
| `Readiness attempt N/30: HTTP 503; not ready.` | **コンテナ起動待機（正常な経過）**<br>インフラ作成直後（コード未配置時）のクールダウン解除待ち、または App Service が古いプロセスを停止して新しいコンテナを準備している状態です。 | **そのままお待ちください**（15 秒間隔で自動リトライされます）。 |
| `curl: (28) Operation timed out after 10005 milliseconds...`<br>`Readiness attempt N/30: transport failure; not ready.` | **コンテナ初期化・ウォームアップ中（正常な経過）**<br>App Service が Node.js 24 コンテナを起動し、内部のウォームアッププローブ（`dist/src/app.js` の起動と Cosmos DB 接続）を実行している最中のため、10 秒タイムアウトで待機しています。 | **中断せずそのままお待ちください**（ウォームアップが完了すると次の試行で即座に HTTP 200 になります）。 |
| `Readiness check passed on attempt N/30.`<br>`Upload and readiness checks passed: https://<APP_SERVICE_NAME>.azurewebsites.net` | **デプロイ・起動完了**<br>`/health` エンドポイントから HTTP 200 と `{"status":"healthy"}` が返り、バックエンド API が正常に稼働開始した状態です。 | 次の手順へ進んでください。 |
| `Backend health endpoint did not become healthy after 30 attempts.` | **起動失敗（30 回リトライ上限到達）**<br>約 8 分経過しても `/health` が正常応答しなかった状態です（Key Vault の RBAC 伝播待ちや接続設定不備など）。 | 手順 6 の `az webapp log tail` でエラーログを確認するか、数分待ってから再実行してください。 |

## 4. スクリプトの処理内容を確認する

`scripts/deploy-backend.sh` は、手作業ではミスが起きやすいパッケージングと App Service の設定を次の順序で自動実行します。

| ステップ | 処理内容 | 目的 |
|---|---|---|
| 1. 対象の確認 | 保存済みの設定値（リソースグループ・App Service 名・サブスクリプション・テナント）と引数を照合 | 誤った環境へのデプロイを防止する |
| 2. アプリのビルド | `npm ci --include=dev` と `npm run build` を実行し、一時ディレクトリの `package/dist` に出力 | TypeScript をコンパイルし、JavaScript の成果物を生成する |
| 3. ZIP の作成 | 一時ディレクトリに `package.json` と `package-lock.json` をコピーし、`npm ci --omit=dev` で本番用依存パッケージのみを入れて ZIP 化 | 開発用パッケージを除外し、App Service 上での再ビルドを不要にする |
| 4. ZIP の検査 | `unzip -t` とファイルパスの区切り文字を確認 | 破損した ZIP やパス形式の違いによる起動失敗を防ぐ |
| 5. App Service 設定 | `SCM_DO_BUILD_DURING_DEPLOYMENT=false` とスタートアップコマンド `node dist/src/app.js` を設定 | ビルド済みの ZIP をそのまま起動させる |
| 6. ZIP デプロイ | `az webapp deploy --type zip --clean true --restart true --async true` を実行 | 既存ファイルを置き換え、アップロード後に App Service を再起動する |
| 7. ヘルスチェック | `/health` エンドポイントに対して最大 30 回ポーリングし、HTTP 200 かつ `status: "healthy"` の JSON 応答を確認 | アプリケーションの起動完了と DB 接続の確立を確認する |
| 8. 一時ファイルの削除 | 作成された一時ディレクトリを削除 | 作業ディレクトリをクリーンな状態に保つ |

ZIP のルート直下に `dist/src/app.js` と `node_modules/` が配置されるため、App Service のスタートアップコマンド（`node dist/src/app.js`）とファイル構成がそのまま一致します。

成功すると、最後に次のようなメッセージが表示されます。

```text
Readiness passed after ...s (HTTP 200, status=healthy).
Upload and readiness checks passed: https://<actual-hostname>
```

## 5. App Service のヘルスチェックを直接確認する

App Service のデフォルトホスト名に対して `/health` を呼び出し、正常に応答することを確認します。

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

## 6. アプリケーションログを確認する

もし起動に失敗したりヘルスチェックが通らない場合は、App Service のログストリームを確認します。

```bash
az webapp log tail \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

確認を終えたら `Ctrl+C` で終了します。

## 補足: GitHub Actions を使う場合

Cloud Shell からのデプロイの代わりに GitHub Actions を使って自動デプロイしたい場合は、[GitHub Actions でデプロイ（代替）](day-1-github-actions-alternative.ja.html) を参照してください。

## 次に進む

- [Day 1: フロントエンドのデプロイ](day-1-deploy-frontend.ja.html)
