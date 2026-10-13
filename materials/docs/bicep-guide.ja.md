# Bicep ガイド（Azure PaaS ワークショップ ブログアプリケーション）

このガイドでは、ワークショップの Bicep テンプレート構成、主要パラメータ、運用時の安全なデプロイ手順を解説します。

> **受講者本線:** Cloud Shell 専用の手順は [Day 1: PaaS インフラをデプロイ](learner/day-1-deploy-infrastructure.ja.html) を参照してください。このガイドは Bicep の背景理解と参照用です。
>
> この PaaS ワークショップの本線は Static Web Apps Linked Backend + App Service です。Application Gateway や Bastion は使用しません。

ディレクトリ構成:

```
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

## 1. Bicep が実装するデプロイ構成

このテンプレートは、次の PaaS トポロジをデプロイします。

1. ネットワーク基盤（VNet、サブネット、NAT Gateway、Private DNS）
2. 監視基盤（Log Analytics + Application Insights）
3. Key Vault（Private Endpoint 付き）
4. Cosmos DB for MongoDB vCore（Private Endpoint 付き）
5. App Service（public HTTPS、Linux、outbound VNet Integration、Managed Identity）
6. Static Web Apps Standard + Linked Backend（本線の必須 routing）
7. API 向け EasyAuth 上書き（`Return401`、除外パス定義）

エントリポイント:

- `materials/bicep/main.bicep`

---

## 2. 重要パラメータの理解

`main.bicep` の主要パラメータ:

- `environment`: `dev` / `staging` / `prod`
- `location`: プライマリ Azure リージョン
- `baseName`: リソース名のベース
- `deploymentMode`: 受講者本線では `standard`
- `groupId`: ワークショップ用グループ識別子（`A`-`J`）
- `entraTenantId`, `entraBackendClientId`, `entraFrontendClientId`
- `cosmosDbAdminPassword`（secure）
- `appServiceSku`, `cosmosDbTier`, `cosmosDbEnableHa`
- `staticWebAppSku`, `staticWebAppLocation`

本線は **B1 / M25 / HA=false / SWA Standard**。B1 の slots / zone redundancy と M25 の HA はありません。`environment='prod'` だけで production-ready にはなりません。既存 M30+ は実 tier を明示して保持し、新しい M25 default を downgrade として使いません。M30+→M25 は不可で、upgrade は可逆的な演習 toggle ではありません。

---

## 3. モジュール別の解説

## 3.1 `network.bicep`

作成対象:

- `snet-appservice` と `snet-privateendpoint` を持つ VNet
- NAT Gateway と Public IP
- Cosmos/Key Vault 用 Private DNS ゾーン

設計意図:

- App Service の外向き通信を安定化
- DB / KV 向けの private endpoint / DNS / route を構成。effective isolation は実際の firewall・名前解決・接続で別途検証

## 3.2 `monitoring.bicep`

作成対象:

- Log Analytics ワークスペース
- ワークスペース連携 Application Insights

設計意図:

- アプリ/プラットフォーム両面の調査先を一元化

## 3.3 `keyvault.bicep`

作成対象:

- Key Vault（Private Endpoint）
- endpoint / DNS group。vault と network resources の writer はこの module のみ

設計意図:

- シークレットをソース/平文設定に置かない

### `keyvault-rbac.bicep`

既存 vault に App Service MI の **Key Vault Secrets User** を付与します。vault / endpoint を再作成しません。assignment は同じ vault scope / principal / role の deterministic GUID を保持します。Contributor は必要な `Microsoft.Authorization/roleAssignments/write` を持たないため、Contributor-only / 主催者準備なしの新規 deploy はここでブロックです。role を省略したり access policy へ降格したりしません。

## 3.4 `cosmosdb.bicep`

作成対象:

- Cosmos DB for MongoDB vCore クラスター
- Private Endpoint + DNS ゾーングループ
- 接続文字列と管理者パスワードを Key Vault に格納

設計意図:

- バックエンドは平文ではなく Key Vault reference 経由で DB 接続

pinned `Microsoft.DocumentDB/mongoClusters@2024-02-15-preview` は `publicNetworkAccess` property を持ちません。「Disabled を設定済み」と断定せず、private DNS / endpoint / effective firewall / app connectivity を検証します。RU Cosmos DB の quota と混同しません。

## 3.5 `appservice.bicep`

作成対象:

- App Service Plan（Linux）
- App Service（System-assigned Managed Identity）
- VNet Integration
- App Insights 接続文字列、Key Vault reference を含む app settings
- ヘルスチェックパス `/health`

設計意図:

- マネージド実行環境 + セキュアなシークレット参照 + ヘルス監視

## 3.6 `staticwebapp.bicep`

作成対象:

- Static Web App
- `sku == 'Standard'` かつ backend ID 指定時のみ Linked Backend

設計意図:

- orchestrator は Standard を必須にして SWA→App Service 連携を作成。standalone module の Free は linked backend なしの別用途

## 3.7 `appservice-auth.bicep`

SWA/Backend 連携後に App Service `authsettingsV2` を設定:

- `unauthenticatedClientAction: 'Return401'`
- `/health`, `/api/health` と公開閲覧系投稿 API を除外
- Entra ID と Azure Static Web Apps の identity provider を有効化

設計意図:

- API 呼び出し時のログインリダイレクト回避とヘルスチェック維持

---

## 4. パラメータファイル運用

利用可能な例:

- `main.bicepparam`, `dev.bicepparam`
- ローカル用 `*.local.bicepparam`

推奨運用:

1. 近いベースライン（通常は `dev`）をコピーする。
2. Entra ID と secure 値を設定する。
3. 受講者本線では `deploymentMode = 'standard'` のままにする。
4. ローカル上書き値は非コミットのローカルパラメータに保持する。

本線の PARAM_FILE は JSON state と同じ専用ディレクトリに置き、実 clone への `using` を生成します。初回だけ password をファイルへ直接生成し、再実行で既存 secret を保持します。JSON / terminal / Git に秘密値を保存しません。詳細は [Day 1](learner/day-1-deploy-infrastructure.ja.html) を参照してください。

---

## 5. デプロイコマンド（参照）

Day 0 の permissions / consent / catalog / quota / tier / capacity / 費用条件を満たした場合だけ実行します。catalog success は deploymentReady ではありません。先に state をロードし、保存した context と target を検証します。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load identity || exit 1

az deployment group validate \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$WORKSHOP_REPO_DIR/materials/bicep/main.bicep" \
  --parameters "$PARAM_FILE" || exit 1
```

デプロイ実行:

```bash
az deployment group create \
  --subscription "$SUBSCRIPTION_ID" --name main \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$WORKSHOP_REPO_DIR/materials/bicep/main.bicep" \
  --parameters "$PARAM_FILE" || exit 1
```

出力確認:

```bash
az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query '{state:properties.provisioningState,started:properties.timestamp,outputs:properties.outputs}' \
  -o jsonc || exit 1
```

今回の start / correlation ID / Succeeded を確認し、前回成功の outputs と取り違えません。Failed / Canceled / quota / capacity error なら保存・app deploy へ進みません。main.json は Bicep 0.44.1 で再生成し、[配布 ARM の parity](../bicep/README.md#maintain-the-compiled-arm-artifact) を保ちます。local compilation は live validation / idempotence の証拠ではありません。

---

## 6. 安全な変更管理（Bicep）

テンプレート更新時の推奨:

1. 1 回の変更で 1 つの関心事に絞る。
2. `create` 前に `validate` を必ず実施する。
3. 破壊的変更リスクは検証用リソースグループで先行確認する。
4. 出力値と依存サービス接続を確認する。
5. パラメータ変更点を運用メモに残す。

---

## 7. よくある落とし穴

- `deploymentMode` が `standard` になっていない
- パラメータファイルの Entra ID 未設定
- ローカルパラメータ更新漏れ
- SWA SKU 制約を無視した Linked Backend 前提運用
- 認証設定変更後の EasyAuth 動作未確認

---

## 8. デプロイ後タスク（運用）

- state-scoped deploy script が SWA token を取得し環境渡し。値は表示しない
- App Service へバックエンド成果物を ZIP deploy
- actual hostname の直接 / SWA 公開契約と browser consent / CRUD を [検証](learner/day-1-validation.ja.html)
- App Service で Key Vault secret 解決を確認
- Application Insights / Log Analytics へのテレメトリ流入を確認

---

## 9. 今後の拡張（任意）

- 診断設定・アラートの Bicep モジュール化
- DR 演習向けセカンダリリージョンパラメータの整備
- SKU やネットワーク既定値に対するポリシー/ガードレール導入
