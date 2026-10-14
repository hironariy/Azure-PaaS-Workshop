# Bicep ガイド（Azure PaaS ワークショップ）

このガイドでは、ワークショップで使用する Bicep テンプレート（`materials/bicep/`）の構成、主要パラメータ、および各モジュールの設計意図を解説します。

> **受講手順について:** Cloud Shell から順番に実行する手順は [Day 1: インフラのデプロイ](learner/day-1-deploy-infrastructure.ja.html) を参照してください。このページはテンプレートの構造を理解するためのリファレンスです。

ディレクトリ構成:

```text
materials/bicep/
├── main.bicep
├── *.bicepparam
└── modules/
    ├── network.bicep
    ├── monitoring.bicep
    ├── keyvault.bicep
    ├── keyvault-rbac.bicep
    ├── cosmosdb.bicep
    ├── appservice.bicep
    ├── appservice-auth.bicep
    └── staticwebapp.bicep
```

---

## 1. デプロイされる全体構成

`materials/bicep/main.bicep` をエントリポイントとして、以下の PaaS リソース群を一括でデプロイします。

1. **ネットワーク基盤**（VNet、サブネット、NAT Gateway、Private DNS ゾーン）
2. **監視基盤**（Log Analytics ワークスペース + Application Insights）
3. **Key Vault**（Private Endpoint 接続、RBAC 認可モード）
4. **Cosmos DB for MongoDB vCore**（Private Endpoint 接続）
5. **App Service**（Linux Node.js 22 LTS、VNet 統合、システム割り当てマネージド ID）
6. **Static Web Apps (`Standard`) + Linked Backend**（`/api/*` を App Service へルーティング）
7. **App Service 認証設定 (`authsettingsV2`)**（未認証 API アクセス時にログイン画面へリダイレクトせず HTTP 401 を返す設定）

---

## 2. 主要パラメータ

`main.bicep` で受け取る主なパラメータは次のとおりです。

| パラメータ名 | 説明 |
|---|---|
| `environment` | 環境識別子（`dev` / `staging` / `prod`） |
| `location` | 主要リソースのデプロイ先リージョン（例: `japaneast`） |
| `baseName` | リソース名のベース文字列 |
| `deploymentMode` | ワークショップ標準構成では `standard` |
| `groupId` | 受講グループ識別子（`A`〜`J` など） |
| `entraTenantId` | Microsoft Entra テナント ID |
| `entraBackendClientId` | バックエンド API アプリ登録の Client ID |
| `entraFrontendClientId` | フロントエンド SPA アプリ登録の Client ID |
| `cosmosDbAdminPassword` | Cosmos DB 管理者パスワード（`@secure()` パラメータ） |
| `appServiceSku` | App Service Plan の SKU（標準は `B1`） |
| `cosmosDbTier` | Cosmos DB for MongoDB vCore のクラスター層（標準は `M25`） |
| `cosmosDbEnableHa` | Cosmos DB の高可用性設定（標準は `false`） |
| `staticWebAppSku` | Static Web Apps の SKU（Linked Backend を使うため `Standard`） |
| `staticWebAppLocation` | Static Web Apps のリージョン（例: `eastasia`） |

> **SKU に関する補足:**
> ワークショップの標準構成はコストを抑えるため **App Service `B1` / Cosmos DB `M25` (`HA=false`) / Static Web Apps `Standard`** を使用します。なお、Cosmos DB を `M30` 以上へスケールアップすると `M25` へダウングレードすることはできないため注意してください。

---

## 3. モジュール別の解説

### 3.1 `network.bicep`

- **作成リソース**: `snet-appservice` と `snet-privateendpoint` を持つ VNet、NAT Gateway、Public IP、Cosmos DB / Key Vault 用の Private DNS ゾーン
- **設計意図**: App Service から閉域網（Private Endpoint）経由で Cosmos DB と Key Vault へ安全に通信できるようにし、外向き通信の送信元 IP も NAT Gateway で固定化します。

### 3.2 `monitoring.bicep`

- **作成リソース**: Log Analytics ワークスペース、ワークスペースベースの Application Insights
- **設計意図**: アプリケーションの要求・例外・依存関係トレースとプラットフォームログを一元的に検索・分析できるようにします。

### 3.3 `keyvault.bicep` / `keyvault-rbac.bicep`

- **作成リソース**: Key Vault（RBAC モード有効）、Private Endpoint、および App Service のマネージド ID に対する `Key Vault Secrets User` ロール割り当て
- **設計意図**: 接続文字列やパスワードをアプリケーション設定に平文で持たせず、Key Vault 参照（`@Microsoft.KeyVault(SecretUri=...)`）経由で安全に注入します。
- **必要な権限**: `keyvault-rbac.bicep` は `Microsoft.Authorization/roleAssignments` を作成するため、デプロイを実行する受講者にはサブスクリプションの **Owner** ロールが必要です。

### 3.4 `cosmosdb.bicep`

- **作成リソース**: Cosmos DB for MongoDB vCore クラスター、Private Endpoint + Private DNS ゾーングループ、Key Vault シークレット（接続文字列）
- **設計意図**: データベース接続文字列を Bicep デプロイ内で直接 Key Vault シークレットへ格納し、人間が接続文字列をコピー＆ペーストする手間と漏洩リスクをなくします。

### 3.5 `appservice.bicep`

- **作成リソース**: App Service Plan（Linux）、App Service（システム割り当てマネージド ID 有効）、VNet 統合、環境変数（Key Vault 参照・Application Insights 接続文字列）、ヘルスチェックパス `/health`
- **設計意図**: OS 管理不要のマネージド実行環境を構成し、ヘルスチェックと Key Vault 連携を標準装備します。

### 3.6 `staticwebapp.bicep`

- **作成リソース**: Static Web Apps (`Standard`)、App Service への Linked Backend
- **設計意図**: フロントエンド SPA と同じオリジン（`https://<SWA_HOSTNAME>/api/*`）でバックエンド API を呼び出せるようにし、CORS 設定の複雑化を防ぎます。

### 3.7 `appservice-auth.bicep`

- **作成リソース**: App Service の `authsettingsV2` 設定
- **設計意図**: 未認証リクエストに対してログインページへの HTML リダイレクトではなく HTTP `401 Unauthorized` を返すようにし、`/health` や公開記事一覧 API などの匿名アクセス対象パスを除外設定します。

---

## 4. パラメータファイルの扱い方

演習では、Git 管理下の `materials/bicep/dev.bicepparam` を直接編集せず、Cloud Shell の永続領域（`$HOME/clouddrive/paas-workshop/dev.local.bicepparam`）を生成して使用します。これにより、生成した DB 管理者パスワードや自分のテナント固有の Client ID を誤って Git にコミットすることを防ぎます。

---

## 5. デプロイ・確認コマンド（リファレンス）

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load identity || exit 1

# 1. 事前検証 (validate)
az deployment group validate \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$WORKSHOP_REPO_DIR/materials/bicep/main.bicep" \
  --parameters "$PARAM_FILE" || exit 1

# 2. デプロイ実行 (create)
az deployment group create \
  --subscription "$SUBSCRIPTION_ID" --name main \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$WORKSHOP_REPO_DIR/materials/bicep/main.bicep" \
  --parameters "$PARAM_FILE" || exit 1

# 3. 出力値の確認 (show)
az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query '{state:properties.provisioningState,started:properties.timestamp,outputs:properties.outputs}' \
  -o jsonc || exit 1
```

---

## 6. テンプレート改修時のベストプラクティス

1. **1 回の変更で 1 つの関心事に絞る**: ネットワーク変更と認証変更を同時に行わず、段階的に検証します。
2. **`create` の前に必ず `validate` を実行する**: 構文エラーやパラメータ不足を早期に検出できます。
3. **SKU の制約を意識する**: Static Web Apps の Linked Backend は `Standard` SKU が必須であり、Cosmos DB の `M30` 以上から `M25` へのダウングレードはできません。
4. **`main.json` の同期**: `materials/bicep/main.bicep` を更新した場合は、`az bicep build --file materials/bicep/main.bicep` で `main.json` も更新します。
