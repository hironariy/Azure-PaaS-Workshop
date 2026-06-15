---
title: "Day 2: 信頼性と復旧"
---

# Day 2: 信頼性と復旧

このページでは、PaaS サービスの機能を使った復旧・再デプロイ・継続性の考え方を確認します。VM の OS 復旧や Bastion/SSH は扱いません。

## 1. ヘルスチェックを基準にする

```bash
source ~/paas-workshop.env

curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
curl -fsS "https://${SWA_HOSTNAME}/api/health" | jq .
```

App Service 直接経路と SWA 経由経路の両方を見ることで、問題が backend 側か routing/frontend 側かを切り分けます。

## 2. App Service を再起動して復旧動作を見る

```bash
az webapp restart \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

復旧までヘルスチェックを繰り返します。

```bash
for i in $(seq 1 20); do
  echo "Attempt $i"
  curl -s -o /tmp/health.json -w "%{http_code}\n" "https://${APP_SERVICE_NAME}.azurewebsites.net/health"
  cat /tmp/health.json
  echo
  sleep 10
done
```

## 3. 再デプロイ可能性を確認する

このワークショップでは backend は prebuilt container image、frontend は Static Web Apps への成果物デプロイです。再構築時は次を確認します。

- Bicep パラメータファイルを再利用できる。
- `BACKEND_IMAGE` が digest 固定である。
- Entra ID の redirect URI に SWA URL が含まれている。
- Key Vault secret と Managed Identity/RBAC が Bicep で再現できる。

## 4. 監視で復旧を確認する

Application Insights で次を見ます。

- failed requests が増えていないか。
- exceptions が出ていないか。
- restart 後に `/health` が戻っているか。

詳細は [監視ガイド](../monitoring-guide.ja.html) と [BCDR ガイド](../disaster-recovery-guide.ja.html) を参照してください。

## 5. PaaS の信頼性観点

| 観点 | このワークショップで見る場所 |
|---|---|
| ヘルスチェック | App Service `/health`、SWA `/api/health` |
| 設定の再現性 | Bicep parameters、Key Vault references |
| 認証 | Entra ID app registrations、EasyAuth |
| 監視 | Application Insights、Log Analytics |
| 復旧 | 再デプロイ、restart、BCDR runbook |

## 次に進む

- [Cleanup](cleanup.ja.html)
