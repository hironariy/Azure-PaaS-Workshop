---
title: "Day 0: 事前準備 2 サブスクリプション確認、リソースグループ設定"
---

# Day 0: 事前準備 2 サブスクリプション確認、リソースグループ設定

このページでは、Cloud Shell から Azure PaaS リソースを作成するためのサブスクリプション、Provider、リージョン、費用の前提を確認します。

> **Azure サブスクリプションの Owner が受講者の必須前提です。** Contributor のみの経路は本線では扱いません。Owner は Azure RBAC の権限で、Entra のアプリ登録・本人同意には別途 Application Developer を使います。

## 1. アーキテクチャを確認する

![Azure PaaS Workshop アーキテクチャ](../assets/images/architecture.png)

このワークショップでは、受講者が Cloud Shell から Azure CLI、Bicep、デプロイスクリプトを使い、VM を直接管理せずに PaaS 構成のブログアプリを作成します。

全体像は次の通りです。

| 領域 | Azure サービス | 役割 |
|---|---|---|
| フロントエンド | Azure Static Web Apps | React アプリを配信し、`/api/*` をバックエンドへルーティングします。 |
| バックエンド API | Azure App Service | Node.js API を実行し、Microsoft Entra ID のトークンを検証します。 |
| データ | Azure Cosmos DB for MongoDB vCore | ブログ記事やユーザー情報を保存します。 |
| シークレット | Azure Key Vault | Cosmos DB 接続文字列などを保存し、App Service の Managed Identity で参照します。 |
| 監視 | Application Insights / Log Analytics | アプリのログ、依存関係、障害調査に使います。 |
| ネットワーク | VNet Integration / Private Endpoint / NAT Gateway | App Service から private endpoint 経由でデータ層へ接続します。 |

AWS に慣れている場合は、アプリ実行基盤を EC2 ではなく、Elastic Beanstalk や Amplify、Secrets Manager、CloudWatch Logs のような managed service の組み合わせとして捉えると理解しやすくなります。

## 2. サブスクリプションを確認する

```bash
az account show --query "{name:name,id:id,tenantId:tenantId}" --output table
```

講師指定のサブスクリプションと異なる場合は切り替えます。

```bash
az account set --subscription "<subscription-id-or-name>"
az account show --output table
```

### サブスクリプションの Owner を確認する

対象サブスクリプションまたはその親スコープから継承した **Owner** が必要です。リソースグループだけの Owner では、この本線のサブスクリプション準備作業を満たしません。PIM を使う場合は有効化してから確認します。次の読み取りはロールを付与・変更しません。

```bash
(
  set -euo pipefail
  SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
  USER_OBJECT_ID="$(az ad signed-in-user show --query id -o tsv)"
  OWNER_ASSIGNMENTS="$(az role assignment list \
    --assignee "$USER_OBJECT_ID" \
    --scope "/subscriptions/$SUBSCRIPTION_ID" \
    --include-inherited \
    --include-groups \
    -o json)"
  if ! jq -e 'type == "array" and any(.[]; .roleDefinitionName == "Owner")' \
    <<< "$OWNER_ASSIGNMENTS" >/dev/null; then
    echo "ERROR: 対象サブスクリプションの Owner を確認できません。演習を開始せず講師に確認してください。" >&2
    exit 1
  fi
  echo "対象サブスクリプションの Owner 割り当てを確認しました。"
)
```

読み取り自体が拒否された場合も、権限ありとは扱いません。Azure Portal の **Subscriptions > 対象 subscription > Access control (IAM) > View my access** で対象スコープと PIM の有効化を講師と確認してください。このチェックは Owner の割り当て確認であり、Deny Assignment、Azure Policy、quota、実容量やデプロイ成功を保証するものではありません。

## 3. リソースグループ名を確認する

### Day 0 の Entra 権限を先に確認する

Azure の **Owner** は PaaS リソースと必要なロール割り当てを操作するための前提です。アプリ登録・本人同意には別途 **Entra の Application Developer** を使います。PIM の eligible assignment は有効化してから進めてください。Entra ロールは対象テナントの **Microsoft Entra ID > Roles and administrators** または **Privileged Identity Management > My roles** で確認します。

Day 0 は本人が作成・所有する演習専用の Backend / Frontend と、`--consent-type Principal --principal-id <本人の user object ID>` による本人だけへの同意で完結させます。Application Administrator / Cloud Application Administrator / Global Administrator の追加付与、全ユーザーへの `AllPrincipals` 同意、講師によるアプリの事前作成は本線の前提にしません。実際の ID は [Entra ID 手順](day-0-entra-id.ja.html)で CLI から取得します。

本人同意が拒否される場合は対象テナント、Application Developer の有効化、対象 scope、適用ポリシー、CLI の Graph 認可を切り分け、エラーを記録して停止します。Owner でも Entra の制約は回避できません。Day 1 の Key Vault role assignment は Azure Owner として受講者本人が実行します。

```bash
echo "Resource group: $RESOURCE_GROUP"
echo "Primary region: $LOCATION"
echo "Static Web Apps region: $SWA_LOCATION"
```

グループ演習では、`GROUP_ID` をチームごとに変えてリソース名の衝突を避けます。

```bash
export GROUP_ID="A"
export RESOURCE_GROUP="rg-${BASE_NAME}-${GROUP_ID}-workshop"
```

## 4. Resource Provider を登録する

このワークショップでは、App Service、Static Web Apps、Cosmos DB/DocumentDB、Key Vault、Monitor/Alerts Management、Network を使います。

```bash
for ns in \
  Microsoft.Web \
  Microsoft.DocumentDB \
  Microsoft.KeyVault \
  Microsoft.Insights \
  Microsoft.AlertsManagement \
  Microsoft.OperationalInsights \
  Microsoft.Network \
  Microsoft.Authorization
do
  state=$(az provider show --namespace "$ns" --query registrationState -o tsv 2>/dev/null || echo NotRegistered)
  echo "$ns: $state"
  if [ "$state" != "Registered" ]; then
    az provider register --namespace "$ns"
  fi
done
```

登録状態を確認します。

```bash
for ns in Microsoft.Web Microsoft.DocumentDB Microsoft.KeyVault Microsoft.Insights Microsoft.AlertsManagement Microsoft.OperationalInsights Microsoft.Network Microsoft.Authorization
do
  az provider show --namespace "$ns" --query "{namespace:namespace,state:registrationState}" -o table
done
```

すべて `Registered` になるまで数分かかることがあります。

`Microsoft.AlertsManagement` が未登録の場合、Application Insights の `Failure Anomalies` アラート作成でデプロイが失敗することがあります。

## 5. Quota と費用の前提を確認する

Cloud Shell 手順では、ワークショップ向けの小さな SKU を使います。

| リソース | 既定 |
|---|---|
| App Service Plan | B1 |
| Static Web Apps | Standard (Linked Backend に必要) |
| Cosmos DB / DocumentDB | M25 |
| Cosmos DB HA | false |

> Static Web Apps Linked Backend は Free SKU では利用できません。このワークショップでは `/api/*` を App Service にルーティングするため Standard を使います。

App Service SKU の利用可否はサブスクリプションやリージョンによって異なります。デプロイ時に quota エラーが出た場合は講師に相談してください。

## 6. 作業用リソースグループを作成する

```bash
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags Workshop=Azure-PaaS-Workshop GroupId="$GROUP_ID"
```

確認します。

```bash
az group show --name "$RESOURCE_GROUP" --output table
```

## 次に進む

- [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html)
