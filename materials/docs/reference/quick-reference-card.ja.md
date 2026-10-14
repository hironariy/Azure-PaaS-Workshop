---
title: クイックリファレンス
---

# クイックリファレンス

Cloud Shell のセッションが切れたときや、よく使うコマンド・環境変数をすぐ確認したいときのためのチートシートです。

- **標準構成**: Static Web Apps (`Standard`) + App Service (`B1`) + Cosmos DB for MongoDB vCore (`M25`, `HA=false`)
- **前提ロール**: Azure サブスクリプションの **Owner** + Microsoft Entra ID の **Application Developer**

## 1. 環境変数の復元（Cloud Shell 再接続時のみ）

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh"
workshop_state_load base
```

（Day 0 完了後は `workshop_state_load identity`、Day 1 インフラ構築後は `workshop_state_load deployed` を使用できます。）

## 2. 主な環境変数一覧

| 変数名 | 用途 |
|---|---|
| `WORKSHOP_REPO_DIR` | リポジトリの配置先（通常は `~/Azure-PaaS-Workshop`） |
| `WORKSHOP_STATE_DIR` | 永続化ファイルの保存先（通常は `~/clouddrive/paas-workshop`） |
| `ENV_FILE` | 状態保存用の JSON ファイル（`$WORKSHOP_STATE_DIR/paas-workshop.json`） |
| `PARAM_FILE` | Bicep パラメータファイル（`$WORKSHOP_STATE_DIR/dev.local.bicepparam`） |
| `SUBSCRIPTION_ID` | 使用する Azure サブスクリプション ID |
| `TENANT_ID` | Microsoft Entra テナント ID |
| `RESOURCE_GROUP` | ワークショップ用のリソースグループ名 |
| `LOCATION` | App Service / Cosmos DB / Key Vault のリージョン（例: `japaneast`） |
| `SWA_LOCATION` | Static Web Apps のリージョン（例: `eastasia`） |
| `APP_SERVICE_NAME` | バックエンドの App Service 名 |
| `SWA_NAME` | フロントエンドの Static Web Apps 名 |
| `SWA_HOSTNAME` | フロントエンドの公開ホスト名 |
| `BACKEND_CLIENT_ID` | バックエンド API アプリ登録の Client ID |
| `FRONTEND_CLIENT_ID` | フロントエンド SPA アプリ登録の Client ID |

## 3. 公開 URL とヘルスチェックの確認

```bash
APP_HOSTNAME="$(az webapp show --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" --query defaultHostName -o tsv)"
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
echo "API direct: https://$APP_HOSTNAME/health"
```

公開エンドポイントの一括検証:

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR"
```

## 4. Bicep デプロイ出力の確認

```bash
az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query properties.outputs \
  -o jsonc
```

## 5. バックエンドのデプロイ

```bash
cd "$WORKSHOP_REPO_DIR"
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

## 6. フロントエンドのデプロイ

```bash
cd "$WORKSHOP_REPO_DIR"
./scripts/deploy-frontend.sh "$RESOURCE_GROUP"
```

（ARM ZIP API を使う代替手順については [Day 1: フロントエンドのデプロイ](../learner/day-1-deploy-frontend.ja.html) を参照してください。）

## 7. App Service のログ確認

```bash
az webapp log tail \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

（`Ctrl+C` で終了します。）

## 8. Entra ID の SPA リダイレクト URI 確認

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" \
  -o jsonc
```

## 9. クリーンアップ（リソース削除）

```bash
bash "$WORKSHOP_REPO_DIR/scripts/cleanup-workshop.sh"
```

詳細は [クリーンアップ（リソース削除）](../learner/cleanup.ja.html) を参照してください。
