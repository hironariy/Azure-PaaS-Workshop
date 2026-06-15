---
title: クイックリファレンス
---

# クイックリファレンス

Cloud Shell セッションが切れたときや、値を確認したいときに使うメモです。

## 変数の復元

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
```

## 主要変数

| 変数 | 用途 |
|---|---|
| `WORKSHOP_REPO_DIR` | build/deploy 用のリポジトリ。通常は `~/Azure-PaaS-Workshop` |
| `WORKSHOP_STATE_DIR` | 永続化 state。通常は `~/clouddrive/paas-workshop` |
| `ENV_FILE` | 共通変数を保存するファイル |
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
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

## Frontend deploy

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
cat > "$WORKSHOP_STATE_DIR/deploy-frontend.local.env" <<EOF
ENTRA_TENANT_ID="$TENANT_ID"
ENTRA_FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
ENTRA_BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
EOF
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
az group delete --name "$RESOURCE_GROUP" --yes --no-wait
az ad app delete --id "$FRONTEND_CLIENT_ID"
az ad app delete --id "$BACKEND_CLIENT_ID"
```
