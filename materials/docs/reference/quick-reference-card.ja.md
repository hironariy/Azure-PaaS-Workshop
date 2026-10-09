---
title: クイックリファレンス
---

# クイックリファレンス

Cloud Shell セッションが切れたときや、値を確認したいときに使うメモです。

## 変数の復元

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load base || exit 1
```

## 主要変数

| 変数 | 用途 |
|---|---|
| `WORKSHOP_REPO_DIR` | build/deploy 用のリポジトリ。通常は `~/Azure-PaaS-Workshop` |
| `WORKSHOP_STATE_DIR` | 永続化 state。通常は `~/clouddrive/paas-workshop` |
| `ENV_FILE` | version 付き JSON。保存値を `source` しない |
| `SUBSCRIPTION_ID` | 保存した Azure subscription。実行時の CLI context と比較する |
| `RESOURCE_GROUP` | ワークショップ用リソースグループ |
| `LOCATION` | App Service / Cosmos DB / Key Vault のリージョン |
| `SWA_LOCATION` | Static Web Apps のリージョン |
| `APP_SERVICE_NAME` | Backend App Service 名 |
| `SWA_NAME` | Static Web Apps 名 |
| `SWA_HOSTNAME` | Frontend URL |
| `TENANT_ID` | Entra tenant ID |
| `BACKEND_CLIENT_ID` | Backend API app registration |
| `FRONTEND_CLIENT_ID` | Frontend SPA app registration |

## URL

```bash
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
echo "API direct: https://$APP_SERVICE_NAME.azurewebsites.net/health"
```

## Health check

```bash
curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
curl -fsS "https://${SWA_HOSTNAME}/api/health" | jq .
```

## Deployment outputs

```bash
az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query properties.outputs \
  -o jsonc
```

## Backend deploy

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

## Frontend deploy

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1
./scripts/deploy-frontend.sh "$RESOURCE_GROUP"
```

## App Service logs

```bash
az webapp log tail \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

## Entra redirect URIs

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" \
  -o jsonc
```

## Cleanup

```bash
bash scripts/cleanup-workshop.sh
```

対象・タグ・所有アプリを確認し、専用 RG 全体の削除を明示的に承認します。詳細は [Cleanup](../learner/cleanup.ja.html)。JSON state とパラメータは削除確認後まで保持します。
