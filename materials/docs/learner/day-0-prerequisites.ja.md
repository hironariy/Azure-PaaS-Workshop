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
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load base || exit 1
az account show --query "{name:name,id:id,tenantId:tenantId}" --output table
```

helper が context 不一致で停止した場合は、保存済みの対象を確認してから明示的に選択します。

```bash
az account set --subscription "$SUBSCRIPTION_ID"
workshop_state_load base || exit 1
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

名前はクイックスタートで保存した値を使い、このページで `GROUP_ID` / RG 名を再定義しません。別グループは別の state ディレクトリで開始します。

```bash
printf 'Group: %s / Resource group: %s\n' "$GROUP_ID" "$RESOURCE_GROUP"
```

### 3.1 新規デプロイに必要なロール割り当て権限を確認する

手順 2 で対象サブスクリプションを選択し、表示された ID と tenant が意図した環境であることを確認してから実行します。Node.js 24 と Azure CLI を使います。リソースは作成せず、CLI の既定サブスクリプションも変更しません。

```bash
node scripts/check-role-assignment-permission.cjs \
  "$SUBSCRIPTION_ID" "$TENANT_ID" "$RESOURCE_GROUP" || exit "$?"
```

期待値と停止条件:

| 結果 | 意味 | 次の行動 |
|---|---|---|
| 終了コード `3` / `BLOCKED` | 調査スコープで `Microsoft.Authorization/roleAssignments/write` が許可として報告されていない | Contributor のみでは現行構成を完了できないため、費用の発生する操作前に停止する |
| 終了コード `1` | tenant 不一致、CLI/API エラー、または応答不正 | 原因を確認する。権限不足の証明や成功として扱わない |
| 終了コード `0` | 必要な management action が permission API 上で許可されている | 新規デプロイの必要条件の一つのみ確認。以下の前提を別途確認する |

既存 RG は RG スコープ、未作成 RG は親サブスクリプションの permission API を確認します。ロールの `NotActions` はそのロールからの除外で、他ロールへの deny ではありません。deny assignment、条件付きロール、Azure Policy、既存リソース固有の追加権限、Entra 同意、Key Vault のデータ権限、Provider・SKU・quota はこの結果だけでは確定しません。管理者での成功は Contributor-only の成功証拠になりません。

Key Vault の RBAC 無効化、access policy への切り替え、必要な割り当てを省略しての「成功」は行いません。主催者事前準備なしという条件では、この制約を未解決として記録します。

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
  info="$(az provider show --subscription "$SUBSCRIPTION_ID" --namespace "$ns" \
    --query '{state:registrationState,policy:registrationPolicy}' -o json)" || exit 1
  state="$(printf '%s' "$info" | jq -er '.state')" || exit 1
  policy="$(printf '%s' "$info" | jq -r '.policy')" || exit 1
  printf '%s: %s / %s\n' "$ns" "$state" "$policy"
  if [ "$state" = Registered ] || [ "$policy" = RegistrationFree ]; then continue; fi
  case "$state" in
    NotRegistered)
      az provider register --subscription "$SUBSCRIPTION_ID" --namespace "$ns" --output none || exit 1 ;;
    Registering) ;;
    *) echo "想定外の provider 状態です。"; exit 1 ;;
  esac
  for attempt in $(seq 1 20); do
    state="$(az provider show --subscription "$SUBSCRIPTION_ID" --namespace "$ns" \
      --query registrationState -o tsv)" || exit 1
    printf '%s: %s (%s/20)\n' "$ns" "$state" "$attempt"
    case "$state" in
      Registered) break ;;
      Registering|NotRegistered) ;;
      *) echo "Provider 登録が正常に進んでいません。"; exit 1 ;;
    esac
    if [ "$attempt" -eq 20 ]; then echo "Provider 登録待ちを打ち切りました。"; exit 1; fi
    sleep 15
  done
done
```

登録状態を確認します。

```bash
for ns in Microsoft.Web Microsoft.DocumentDB Microsoft.KeyVault Microsoft.Insights Microsoft.AlertsManagement Microsoft.OperationalInsights Microsoft.Network Microsoft.Authorization
do
  az provider show --subscription "$SUBSCRIPTION_ID" --namespace "$ns" \
    --query "{namespace:namespace,state:registrationState,policy:registrationPolicy}" -o table || exit 1
done
```

登録が必要な provider は `Registered`、登録不要な provider は `RegistrationFree` を確認します。CLI の権限・通信エラーを `NotRegistered` へ読み替えて登録を続けません。待機は最大 20 回、間隔 15 秒です（各 CLI 呼び出し時間は別）。未登録のまま deployment へ進まないでください。

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

### 公開 catalog と対象 subscription の表示を確認する

```bash
node scripts/check-paas-catalog.cjs \
  "$SUBSCRIPTION_ID" "$TENANT_ID" "$LOCATION" "$SWA_LOCATION" B1 || exit 1
```

現在の subscription/tenant/public-cloud context、provider、実際の `mongoClusters` を含む主要 resource type の region、Linux B1 の advertised region を read-only で確認します。blocked は終了コード 3、CLI / metadata 不正は 1 です。成功でも `status: catalog_checks_passed`、**`deploymentReady: false`** と未確認項目を出力します。リソース作成・provider 登録・region/SKU の自動変更はしません。SKU を変更する場合は末尾の値も実際のパラメータと一致させます。

### quota・tier・その時点の容量を別々に確認する

catalog に region が載ることと、subscription に quota があること、その瞬間に物理容量があることは別です。自動チェックだけで次へ進まず、対象 subscription / region / SKU / 台数と確認時刻を記録します。

| 確認 | 本線の条件 | 未確認・不適合の場合 |
|---|---|---|
| App Service | Linux B1 を 1 instance 作成できる subscription quota と region の容量 | Quotas / App Service support で確認。勝手に別 region や有料上位 SKU に変えない |
| Static Web Apps | 選択 region で Standard と Linked Backend が利用可能 | Free に変更して `/api` を省略しない |
| DocumentDB | `Microsoft.DocumentDB/mongoClusters` の M25・1 shard・128 GiB・HA=false を作成可能 | RU ベース Cosmos DB の quota 表で代用しない |
| Networking | private endpoint / VNet、および有効にした場合の public IP / NAT の quota | quota API の対象名を ARM resource type から推測しない |

quota API が対象をサポートする場合は Azure CLI の quota extension と `az quota list` から実際の quota 名を調べ、対応する usage と単位を照合します。未対応・BadRequest・空の値・「No Limit」は無制限の証拠ではありません。MongoDB cluster の制約は [Azure DocumentDB limits](https://learn.microsoft.com/en-us/azure/documentdb/limitations) と [region availability](https://learn.microsoft.com/en-us/azure/documentdb/regional-availability)、App Service は [quota / regional capacity の区別](https://learn.microsoft.com/en-us/troubleshoot/azure/app-service/troubleshoot-non-zone-redundant-quota-requests) を使い、対象 subscription の Portal / support で補います。

App Service は、上で保存・確認した `SUBSCRIPTION_ID` / `LOCATION` の scope を使います。Quota extension が未導入なら `az extension add --name quota` で導入し、まず actual resource names を調べます。

```bash
QUOTA_SCOPE="/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Web/locations/$LOCATION"
az quota list --subscription "$SUBSCRIPTION_ID" --scope "$QUOTA_SCOPE" --output json || exit 1
az quota usage list --subscription "$SUBSCRIPTION_ID" --scope "$QUOTA_SCOPE" --output json || exit 1
```

応答の `name` に `B1` がある場合だけ、同じ scope の limit / usage を確認します。別の quota 名へ推測で置き換えません。

```bash
az quota show --subscription "$SUBSCRIPTION_ID" --scope "$QUOTA_SCOPE" --resource-name B1 --output json || exit 1
az quota usage show --subscription "$SUBSCRIPTION_ID" --scope "$QUOTA_SCOPE" --resource-name B1 --output json || exit 1
```

`isQuotaApplicable`、limit、usage、unit を両方で確認します。2026-10-13 の Owner 検証では B1 limit は `0 / applicable true / Instances`、usage list は `-1 / applicable false`、subscription を明示した個別 usage show は `-1 / applicable true` でした。List と個別応答の flag に差があっても、負数の usage を 0 と見なして available capacity を計算せず、baseline 1 instance の作成前に停止します。Portal / support で対象 region の Linux B1 を確認してください。Quota increase、別 region、上位 SKU は自動で要求・変更しません。Owner role や catalog success だけでは次へ進めません。

#### Quota API の usage が不明なら App Service 側の値を照合する

上で定義した `QUOTA_SCOPE` / `SUBSCRIPTION_ID` をそのまま使い、[App Service Get Usages In Location](https://learn.microsoft.com/rest/api/appservice/get-usages-in-location/list?view=rest-appservice-2026-07-15) の公式 read-only API で同じ region / B1 の値を確認します。

```bash
az rest --subscription "$SUBSCRIPTION_ID" --method get \
  --url "https://management.azure.com${QUOTA_SCOPE}/usages?api-version=2026-07-15" \
  --query "{nextLink:nextLink,quotas:value[?name.value=='B1'].{name:name.value,currentValue:currentValue,limit:limit,unit:unit}}" \
  --output json || exit 1
```

`quotas` に B1 が1件、単位が `Instances`、`nextLink` が `null` であることを確認します。空・負数・単位違い・ページ未完了・API間の上限の矛盾は未確認として停止し、結果を Portal / support に伝えます。この API の `B1 VMs` は App Service worker の quota 表示で、Azure VM の作成手順ではありません。

同日の指定環境では App Service 自身も **B1 `currentValue: 0 / limit: 0 / Instances`** と報告しました。これは独立した API の実測であり、Quota API の `usage: -1` を 0 に置き換えた値ではありません。使用量が0でも上限が0なら1 instance を追加できる根拠にはなりません。上限・使用量が足りても、その時点の物理容量や validation / what-if の成功を保証しません。SKU・region変更や増枠申請はこのコマンドでは行いません。

`InvalidAuthenticationTokenTenant` や context mismatch は quota 不足の証拠ではありません。保存した tenant/subscription と CLI context を照合し、別環境へ切り替わっていたら停止します。`--scope` だけで default subscription に依存せず、上記の `--subscription` も指定してください。別利用者の CLI 設定を自動変更したり、失敗を quota 0 / 成功へ読み替えたりしません。

M25 は Dev/Test 用で、in-region HA はサポートされません。M30 以上へ上げると M25 以下へ戻せない制約があるため、演習中に自動 upgrade しません。有料 HA / 別 region は別途承認が必要です。確認できない条件は「未確認」として停止し、catalog 成功を workshop-ready と扱わないでください。

## 6. 作業用リソースグループを作成する

```bash
GROUP_EXISTS="$(az group exists --subscription "$SUBSCRIPTION_ID" --name "$RESOURCE_GROUP")" || exit 1
case "$GROUP_EXISTS" in
  false)
    az group create --subscription "$SUBSCRIPTION_ID" \
      --name "$RESOURCE_GROUP" --location "$LOCATION" \
      --tags Workshop=Azure-PaaS-Workshop GroupId="$GROUP_ID" || exit 1 ;;
  true)
    TAGS="$(az group show --subscription "$SUBSCRIPTION_ID" --name "$RESOURCE_GROUP" --query tags -o json)" || exit 1
    printf '%s' "$TAGS" | jq -e --arg group "$GROUP_ID" \
      '.Workshop == "Azure-PaaS-Workshop" and .GroupId == $group' >/dev/null || {
      echo "既存 RG の workshop/group tag が一致しません。対象を確認し、上書きしないでください。"
      exit 1
    } ;;
  *) echo "RG の存在確認結果が不正です。"; exit 1 ;;
esac
```

確認します。

```bash
az group show --name "$RESOURCE_GROUP" --output table
```

## 次に進む

- [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html)
