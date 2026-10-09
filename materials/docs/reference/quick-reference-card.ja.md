---
title: クイックリファレンス
---

# クイックリファレンス

Cloud Shell セッションが切れたときや、値を確認したいときに使うメモです。

本線は **SWA Standard / App Service B1 / DocumentDB M25 / HA=false**。B1 の slots / zone redundancy、M25 の HA はありません。Contributor-only の RBAC・tenant consent・公開依存の block は [Day 0](../learner/day-0-prerequisites.ja.html) で確認し、quota や費用の成功を catalog だけで保証しません。

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
workshop_state_load deployed || exit 1
APP_HOSTNAME="$(az webapp show --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" --query defaultHostName -o tsv)" || exit 1
echo "Frontend: https://$SWA_HOSTNAME"
echo "API via SWA: https://$SWA_HOSTNAME/api/health"
echo "API direct: https://$APP_HOSTNAME/health"
```

## Health check

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

公開契約の成功でも `workshopReady: false`。MSAL / consent / authenticated CRUD / telemetry / new release は [Day 1](../learner/day-1-validation.ja.html) で別確認します。復旧の [read-only observer](../learner/day-2-reliability.ja.html) は停止未観測を 0 秒成功とせず、viewCount は content integrity と別です。

## Deployment outputs

```bash
az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
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
bash "$WORKSHOP_REPO_DIR/scripts/deploy-backend.sh" "$RESOURCE_GROUP" "$APP_SERVICE_NAME" || exit 1
```

## Frontend deploy

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1
bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend.sh" "$RESOURCE_GROUP" || exit 1
```

## App Service logs

```bash
az webapp log tail \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

log stream は `Ctrl+C` で終了します。token / connection string / 本文 / 個人データを伏せ、未加工 logs を共有しません。telemetry は集計で確認し、0 件を監視成功とは解釈しません。

## Entra redirect URIs

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" \
  -o jsonc
```

## Cleanup

```bash
bash "$WORKSHOP_REPO_DIR/scripts/cleanup-workshop.sh" || exit 1
```

対象・タグ・所有アプリを確認し、専用 RG 全体の削除を明示的に承認します。詳細は [Cleanup](../learner/cleanup.ja.html)。JSON state とパラメータは削除確認後まで保持します。
