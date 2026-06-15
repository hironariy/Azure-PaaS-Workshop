---
title: "Day 1: GitHub Actions でデプロイ（代替）"
---

# Day 1: GitHub Actions でデプロイ（代替）

このページは任意の代替手順です。通常の受講者本線では、Cloud Shell から [バックエンドをデプロイ](day-1-deploy-backend.ja.html) し、続けて [フロントエンドをデプロイ](day-1-deploy-frontend.ja.html) します。

GitHub Actions を使うと、GitHub-hosted runner が backend/frontend をソースコードから build して Azure にデプロイします。

## 1. 前提

- 自分が push できる GitHub リポジトリを使っている。
- GitHub Actions が有効。
- Day 1 の Bicep デプロイが完了し、`RESOURCE_GROUP`、`APP_SERVICE_NAME`、`SWA_NAME` が分かっている。
- Entra ID の `TENANT_ID`、`BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` が分かっている。

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"

echo "$RESOURCE_GROUP"
echo "$APP_SERVICE_NAME"
echo "$SWA_NAME"
```

## 2. workflow template を有効化する

このリポジトリには workflow templates が含まれています。自分のリポジトリで使う場合は `.github/workflows/` にコピーします。

```bash
mkdir -p .github/workflows
cp .github/workflow-templates/deploy-backend.yml .github/workflows/
cp .github/workflow-templates/deploy-frontend.yml .github/workflows/
```

> 既に `.github/workflows/pages.yml` がある場合でも、そのまま共存できます。

workflow はリポジトリに push されると GitHub の **Actions** タブに表示されます。

```bash
git status --short .github/workflows
git add .github/workflows/deploy-backend.yml .github/workflows/deploy-frontend.yml
git commit -m "ci: enable application deployment workflows"
git push
```

## 3. Azure ログイン用の Entra アプリを作成する（OIDC 推奨）

長期シークレットを GitHub に保存しない OIDC を推奨します。

```bash
export SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
export GITHUB_REPO="<owner>/<repo>"

export AZURE_CLIENT_ID="$(az ad app create \
  --display-name "github-actions-paas-blog-${GROUP_ID}" \
  --query appId -o tsv)"

az ad sp create --id "$AZURE_CLIENT_ID" 1>/dev/null
echo "AZURE_CLIENT_ID=$AZURE_CLIENT_ID"
```

`<owner>/<repo>` は自分の GitHub リポジトリに置き換えます。

```bash
cat > federated-credential.json <<JSON
{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:${GITHUB_REPO}:ref:refs/heads/main",
  "description": "GitHub Actions main branch",
  "audiences": ["api://AzureADTokenExchange"]
}
JSON

az ad app federated-credential create \
  --id "$AZURE_CLIENT_ID" \
  --parameters federated-credential.json
```

リソースグループに Contributor を付与します。

```bash
export SP_OBJECT_ID="$(az ad sp show --id "$AZURE_CLIENT_ID" --query id -o tsv)"

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
```

## 4. GitHub Actions の Variables / Secrets を設定する

GitHub リポジトリの **Settings > Secrets and variables > Actions** を開きます。

Repository Variables:

| Variable | Value |
|---|---|
| `AZURE_CLIENT_ID` | 先ほど作成した GitHub Actions 用 Entra app の client ID |
| `AZURE_TENANT_ID` | `$TENANT_ID` |
| `AZURE_SUBSCRIPTION_ID` | `$SUBSCRIPTION_ID` |
| `AZURE_RESOURCE_GROUP` | `$RESOURCE_GROUP` |
| `AZURE_WEBAPP_NAME` | `$APP_SERVICE_NAME` |
| `ENTRA_TENANT_ID` | `$TENANT_ID` |
| `ENTRA_FRONTEND_CLIENT_ID` | `$FRONTEND_CLIENT_ID` |
| `ENTRA_BACKEND_CLIENT_ID` | `$BACKEND_CLIENT_ID` |

Repository Secret:

| Secret | Value |
|---|---|
| `SWA_DEPLOYMENT_TOKEN` | Static Web Apps deployment token |

SWA deployment token は Cloud Shell で取得できます。

```bash
az staticwebapp secrets list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query "properties.apiKey" -o tsv
```

## 5. workflow を実行する

GitHub UI で実行する場合:

1. リポジトリの **Actions** を開きます。
2. **Deploy Backend to Azure App Service** を選択します。
3. **Run workflow** で `main` を選択して実行します。
4. 成功後、**Deploy Frontend to Azure Static Web Apps** も同様に実行します。

GitHub CLI を使える場合:

```bash
gh workflow run deploy-backend.yml --ref main
gh workflow run deploy-frontend.yml --ref main
```

## 6. デプロイ結果を確認する

```bash
curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
curl -fsS "https://${SWA_HOSTNAME}/api/health" | jq .
```

両方が `healthy` になれば、GitHub Actions による代替デプロイは完了です。
