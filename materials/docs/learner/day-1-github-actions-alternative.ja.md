---
title: "Day 1: GitHub Actions でデプロイ（代替）"
---

# Day 1: GitHub Actions でデプロイ（代替）

このページは任意の代替手順です。通常のワークショップ手順では、Cloud Shell から [バックエンドのデプロイ](day-1-deploy-backend.ja.html) と [フロントエンドのデプロイ](day-1-deploy-frontend.ja.html) を行います。

自分の GitHub リポジトリ（Fork など）から GitHub Actions を使ってビルド・デプロイを体験したい場合は、以下の手順を参照してください。

## 1. 前提条件

- 自分が push 権限を持つ GitHub リポジトリを用意していること。
- そのリポジトリで GitHub Actions が有効になっていること。
- Day 1 の Bicep デプロイが完了し、`RESOURCE_GROUP`、`APP_SERVICE_NAME`、`SWA_NAME` が保存されていること。
- Day 0 の Entra ID 設定が完了し、`TENANT_ID`、`BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` が保存されていること。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1

echo "$RESOURCE_GROUP"
echo "$APP_SERVICE_NAME"
echo "$SWA_NAME"
```

## 2. 自分の GitHub リポジトリを指定する

GitHub CLI（`gh`）を使って、デプロイ元となる自分の GitHub リポジトリ（`owner/repository`）を指定します。

```bash
cd "$WORKSHOP_REPO_DIR" || exit 1
command -v gh >/dev/null || { echo "GitHub CLI が必要です。" >&2; exit 1; }
gh api user --silent || exit 1
read -r -p "自分が管理する GitHub repository (owner/repository): " GITHUB_REPO
export GITHUB_REPO
[[ "$GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || exit 1
gh repo view "$GITHUB_REPO" --json nameWithOwner --jq .nameWithOwner || exit 1
```

## 3. フロントエンド用の Variables と Secret を設定する

Entra ID の公開設定値を GitHub Actions の **Variables** に登録し、Static Web Apps のデプロイトークンを **Secrets** に登録します（デプロイトークンは画面に出力せずパイプで直接渡します）。

```bash
gh variable set ENTRA_TENANT_ID --repo "$GITHUB_REPO" --body "$TENANT_ID" || exit 1
gh variable set ENTRA_FRONTEND_CLIENT_ID --repo "$GITHUB_REPO" --body "$FRONTEND_CLIENT_ID" || exit 1
gh variable set ENTRA_BACKEND_CLIENT_ID --repo "$GITHUB_REPO" --body "$BACKEND_CLIENT_ID" || exit 1

set +x
SWA_DEPLOYMENT_TOKEN="$(az staticwebapp secrets list --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$SWA_NAME" --query properties.apiKey -o tsv)" || exit 1
if [ -z "$SWA_DEPLOYMENT_TOKEN" ] || [ "$SWA_DEPLOYMENT_TOKEN" = null ]; then
  unset SWA_DEPLOYMENT_TOKEN
  echo "Deployment token を取得できませんでした。" >&2
  exit 1
fi
if ! printf '%s' "$SWA_DEPLOYMENT_TOKEN" | gh secret set SWA_DEPLOYMENT_TOKEN --repo "$GITHUB_REPO"; then
  unset SWA_DEPLOYMENT_TOKEN
  exit 1
fi
unset SWA_DEPLOYMENT_TOKEN
```

## 4. バックエンドも GitHub Actions でデプロイする場合（OIDC 設定）

フロントエンドのみを GitHub Actions でデプロイする場合は、このセクションをスキップして手順 5 へ進んでください。

バックエンドも GitHub Actions から App Service へデプロイする場合は、クライアントシークレットを使わない **OpenID Connect (OIDC) フェデレーション資格情報** を設定し、対象リソースグループへの `Contributor` ロールを付与します。

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-role-assignment-permission.cjs" \
  "$SUBSCRIPTION_ID" "$TENANT_ID" "$RESOURCE_GROUP" || exit 1
```

デプロイ専用の Entra アプリとサービスプリンシパルを作成し、リソースグループスコープで `Contributor` ロールを割り当てます。

```bash
AZURE_CLIENT_ID="$(az ad app create \
  --display-name "github-actions-paas-blog-${GROUP_ID}" \
  --query appId -o tsv)" || exit 1
export AZURE_CLIENT_ID

az ad sp create --id "$AZURE_CLIENT_ID" --output none || exit 1
SP_OBJECT_ID="$(az ad sp show --id "$AZURE_CLIENT_ID" --query id -o tsv)" || exit 1
az role assignment create --subscription "$SUBSCRIPTION_ID" \
  --assignee-object-id "$SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --output none || exit 1
```

続けて、`main` ブランチ用のフェデレーション資格情報を作成し、GitHub リポジトリの Variables を設定します。

```bash
FED_PARAMETERS="$(node -e 'console.log(JSON.stringify({
  name: "github-main", issuer: "https://token.actions.githubusercontent.com",
  subject: `repo:${process.env.GITHUB_REPO}:ref:refs/heads/main`,
  audiences: ["api://AzureADTokenExchange"]
}))')" || exit 1
az ad app federated-credential create --id "$AZURE_CLIENT_ID" \
  --parameters "$FED_PARAMETERS" --output none || exit 1
unset FED_PARAMETERS

gh variable set AZURE_CLIENT_ID --repo "$GITHUB_REPO" --body "$AZURE_CLIENT_ID" || exit 1
gh variable set AZURE_TENANT_ID --repo "$GITHUB_REPO" --body "$TENANT_ID" || exit 1
gh variable set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_REPO" --body "$SUBSCRIPTION_ID" || exit 1
gh variable set AZURE_RESOURCE_GROUP --repo "$GITHUB_REPO" --body "$RESOURCE_GROUP" || exit 1
gh variable set AZURE_WEBAPP_NAME --repo "$GITHUB_REPO" --body "$APP_SERVICE_NAME" || exit 1
```

## 5. ワークフローを有効化して実行する

`.github/workflow-templates/` にあるテンプレートを `.github/workflows/` にコピーし、自分のリポジトリの `main` ブランチへ push します。

```bash
mkdir -p .github/workflows
if [ -e .github/workflows/deploy-frontend.yml ]; then
  echo "既存 frontend workflow を確認し、手動で差分を統合してください。" >&2
  exit 1
fi
cp .github/workflow-templates/deploy-frontend.yml .github/workflows/deploy-frontend.yml
read -r -p "Backend OIDC 設定済みで backend workflow も有効化しますか？ (y/N): " ENABLE_BACKEND
if [ "$ENABLE_BACKEND" = y ]; then
  if [ -e .github/workflows/deploy-backend.yml ]; then
    echo "既存 backend workflow を確認し、手動で差分を統合してください。" >&2
    exit 1
  fi
  cp .github/workflow-templates/deploy-backend.yml .github/workflows/deploy-backend.yml
fi
```

コミットして push し、ワークフローを実行します。

```bash
git remote -v
git status --short .github/workflows
git add .github/workflows/deploy-frontend.yml
if [ "$ENABLE_BACKEND" = y ]; then git add .github/workflows/deploy-backend.yml; fi
git commit -m "ci: enable optional application deployment"
git push
gh workflow run deploy-frontend.yml --repo "$GITHUB_REPO" --ref main || exit 1
```

## 6. デプロイ結果を確認する

GitHub Actions の実行が完了したら、[Day 1: アプリケーションの動作確認](day-1-validation.ja.html) に進み、ヘルスチェック・サインイン・記事 CRUD・テレメトリを確認します。

| よくある症状 | 確認と対処 |
|---|---|
| Variables / Secret の不足 | GitHub リポジトリの **Settings > Secrets and variables > Actions** で変数名とシークレット名を確認する |
| OIDC ログイン失敗 | フェデレーション資格情報の `subject`（`repo:<owner>/<repo>:ref:refs/heads/main`）と Variables の各 ID を確認する |
| デプロイ後の 503 / ルーティングエラー | [Day 1: アプリケーションの動作確認](day-1-validation.ja.html) の切り分け手順に従って確認する |
