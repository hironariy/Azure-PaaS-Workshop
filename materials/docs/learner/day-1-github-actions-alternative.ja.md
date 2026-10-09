---
title: "Day 1: GitHub Actions でデプロイ（代替）"
---

# Day 1: GitHub Actions でデプロイ（代替）

このページは任意の代替手順です。通常の受講者本線では、Cloud Shell から [バックエンドをデプロイ](day-1-deploy-backend.ja.html) し、続けて [フロントエンドをデプロイ](day-1-deploy-frontend.ja.html) します。

GitHub-hosted runner で build し、既存の Azure リソースへデプロイします。Frontend だけを Actions に切り替える場合は、新しい Entra アプリや role assignment は不要です。Microsoft の公式 deployment action に build 済み成果物を渡し、SWA npm CLI はインストールしません。

これは任意の経路です。Contributor-only の fresh infrastructure / Key Vault RBAC 制約を解消せず、通常の Cloud Shell 経路を置き換えません。公式 action の commit は固定しますが、upstream Docker image は `stable` であり、native client の完全な immutable inventory / audit=0 や実 Azure deploy は別の検証です。SWA CLI の 6 findings をこの経路の追加で解決済みにはしません。

## 1. 前提

- 自分が push できる GitHub リポジトリを使っている。
- GitHub Actions が有効。
- Day 1 の Bicep デプロイが完了し、`RESOURCE_GROUP`、`APP_SERVICE_NAME`、`SWA_NAME` が分かっている。
- Entra ID の `TENANT_ID`、`BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` が分かっている。
- Frontend のみなら、backend の Cloud Shell deploy が完了している。
- Backend も Actions を使う場合は、専用 OIDC identity と既存 RG の Contributor grant が必要。新しい grant の作成には別の権限が必要であり、受講者の Contributor だけでは付与できない。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1

echo "$RESOURCE_GROUP"
echo "$APP_SERVICE_NAME"
echo "$SWA_NAME"
```

## 2. 自分の GitHub リポジトリを選ぶ

GitHub の自分の repository ページで `owner/repository` を確認します。以下は GitHub CLI が利用でき、対象 repository の Variables / Secrets を設定できる場合の手順です。GitHub CLI がない場合は公式の導入手順を確認するか、GitHub Settings と Azure Portal の **Manage deployment token** を使い、秘密値を Cloud Shell の stdout に表示しないでください。

```bash
cd "$WORKSHOP_REPO_DIR" || exit 1
command -v gh >/dev/null || { echo "GitHub CLI が必要です。" >&2; exit 1; }
gh api user --silent || exit 1
read -r -p "自分が管理する GitHub repository (owner/repository): " GITHUB_REPO
export GITHUB_REPO
[[ "$GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || exit 1
gh repo view "$GITHUB_REPO" --json nameWithOwner --jq .nameWithOwner || exit 1
```

表示された repository が自分のデプロイ対象であることを確認します。Fork の remote と push 先も確認し、意図しない共有 repository を設定・上書きしません。

## 3. Frontend の Variables と token を安全に設定する

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

Client/tenant ID は公開設定値として **Variables** に保存します。SWA token は **Secret** であり、引数・stdout・履歴・ファイルへ出しません。GitHub Settings > Secrets and variables > Actions で、3 Variables と Secret の **名前だけ**を確認します。token は保存 state の SWA に対して取得しています。別 SWA の token を流用しません。

## 4. Backend も Actions を使う場合だけ OIDC を設定する

Frontend のみなら、この節をスキップして次へ進みます。Backend は OIDC のみで、旧 `AZURE_CREDENTIALS` client-secret fallback は使用しません。build job は Azure credentials / OIDC mint 権限を持たず、production ZIP だけを別の deploy job に渡します。

以下は **明示的に許可された追加権限を持つ実施者**の任意 setup です。strict Contributor-only 本線を講師の事前設定で成功扱いにする手順ではありません。必要な権限がない場合は、この経路を停止します。

```bash
node "$WORKSHOP_REPO_DIR/scripts/check-role-assignment-permission.cjs" \
  "$SUBSCRIPTION_ID" "$TENANT_ID" "$RESOURCE_GROUP" || exit 1
```

この read-only check が通っても deny / conditions / Azure Policy と Entra 登録権限は別です。Day 0 の tenant policy を満たす、自分が所有する専用 deployment identity を使います。以下の create は初回だけ実行し、再実行時は作成済み client ID を Azure Portal から確認して `AZURE_CLIENT_ID` に設定します。同名 app を重複作成せず、既存 federation が別 repository / branch を指す場合は上書きしません。

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

この SP の Contributor は既存 App Service の app deploy 用です。新規 Bicep の Key Vault role assignment を作成できるという意味ではありません。Frontend/Backend の app client ID と、ここで作る deployment identity は別です。

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

Azure Portal の対象 app > Certificates & secrets > Federated credentials で issuer、`repo:owner/repository:ref:refs/heads/main` subject、audience を確認します。client secret は作りません。既存 `workshop-setup.sh` の optional setup も OIDC IDs を Variables に保存しますが、target Variables は成功した baseline の値を別途設定します。

## 5. 必要な workflow だけを有効化する

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

Backend も Actions を使い、前節を完了した場合だけ backend template も同様にコピーします。既存ファイルは上書きしません。Pages workflow と共存でき、enable 後は main の対象 source changes と manual dispatch で動きます。main 以外の production dispatch、設定不足、build/audit 失敗は明示的に停止します。

```bash
git remote -v
git status --short .github/workflows
git add .github/workflows/deploy-frontend.yml
if [ "$ENABLE_BACKEND" = y ]; then git add .github/workflows/deploy-backend.yml; fi
git commit -m "ci: enable optional application deployment"
git push
gh workflow run deploy-frontend.yml --repo "$GITHUB_REPO" --ref main || exit 1
```

push 先を確認し、workflow が main に入ってから dispatch します。Backend を有効化した場合は `deploy-backend.yml` を先に実行し、upload/readiness の成功後に frontend を実行します。

## 6. release と受講者操作を確認する

Actions の対象 commit と Deployment Center の今回の deployment 完了を確認します。backend は `dist/src/app.js` と production-only dependencies を含む ZIP、実際の hostname、bounded healthy JSON を使います。Frontend は同じ runtime-config helper と `API_BASE_URL=/api`、routing config を含む prebuilt `dist` を公式 action に渡します。

[Day 1: アプリを検証](day-1-validation.ja.html) で両公開経路、runtime IDs、browser sign-in/自己同意、Unicode CRUD/drafts、DB persistence と telemetry を検証します。health だけで新 release や workshop-ready としません。

| 症状 | 対処 |
|---|---|
| Variables / token 不足 | GitHub Settings の名前と対象 repository、保存 state の app ID/SWA を確認。秘密値は表示しない |
| OIDC login 失敗 | 専用 identity、tenant/subscription、main branch の subject/audience、RG grant を確認。client-secret fallback を追加しない |
| role assignment 作成拒否 | Contributor-only の権限制約として停止。講師準備や RBAC 無効化を本線の成功にしない |
| build/audit 失敗 | 該当 application と public source/lock を修正。失敗を skip して deploy しない |
| upload 後 503 / HTML / CRUD 失敗 | Day 1 diagnostics で startup、MI/KV、DB、Linked Backend、scope を別々に確認 |

参考: [Microsoft の prebuilt app deployment 設定](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration#skip-building-front-end-app)。低レベル StaticSitesClient の非公開 interface を独自 wrapper で直接呼ぶ経路は採用しません。
