# Bicep ガイド（Azure PaaS ワークショップ ブログアプリケーション）

このガイドでは、ワークショップの Bicep テンプレート構成、主要パラメータ、運用時の安全なデプロイ手順を解説します。

ディレクトリ構成:

```
materials/bicep/
├── main.bicep
├── *.bicepparam
└── modules/
    ├── network.bicep
    ├── monitoring.bicep
    ├── keyvault.bicep
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
5. App Service（Linux、VNet Integration、Managed Identity）
6. Static Web Apps（必要に応じて Linked Backend）
7. API 向け EasyAuth 上書き（`Return401`、除外パス定義）

エントリポイント:

- `materials/bicep/main.bicep`

---

## 2. 重要パラメータの理解

`main.bicep` の主要パラメータ:

- `environment`: `dev` / `staging` / `prod`
- `location`: プライマリ Azure リージョン
- `baseName`: リソース名のベース
- `deploymentMode`: `standard` または `fastpath-container`
- `appServiceContainerImage`: コンテナ FastPath 時に必須
- `groupId`: ワークショップ用グループ識別子（`A`-`J`）
- `entraTenantId`, `entraBackendClientId`, `entraFrontendClientId`
- `cosmosDbAdminPassword`（secure）
- `appServiceSku`, `cosmosDbTier`, `cosmosDbEnableHa`
- `staticWebAppSku`, `staticWebAppLocation`

---

## 3. モジュール別の解説

## 3.1 `network.bicep`

作成対象:

- `snet-appservice` と `snet-privateendpoint` を持つ VNet
- NAT Gateway と Public IP
- Cosmos/Key Vault 用 Private DNS ゾーン

設計意図:

- App Service の外向き通信を安定化
- データプレーンの到達をプライベートネットワーク経由に限定

## 3.2 `monitoring.bicep`

作成対象:

- Log Analytics ワークスペース
- ワークスペース連携 Application Insights

設計意図:

- アプリ/プラットフォーム両面の調査先を一元化

## 3.3 `keyvault.bicep`

作成対象:

- Key Vault（Private Endpoint）
- App Service Managed Identity によるシークレット読み取り権限

設計意図:

- シークレットをソース/平文設定に置かない

## 3.4 `cosmosdb.bicep`

作成対象:

- Cosmos DB for MongoDB vCore クラスター
- Private Endpoint + DNS ゾーングループ
- 接続文字列と管理者パスワードを Key Vault に格納

設計意図:

- バックエンドは平文ではなく Key Vault reference 経由で DB 接続

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

- フロントエンド配信を簡潔化し、条件付きで SWA→App Service 連携を活用

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
- `main.fastpath.bicepparam`, `dev.fastpath.bicepparam`
- ローカル用 `*.local.bicepparam`

推奨運用:

1. 近いベースライン（通常は `dev`）をコピーする。
2. Entra ID と secure 値を設定する。
3. `fastpath-container` では不変イメージ参照を設定する。
4. ローカル上書き値は非コミットのローカルパラメータに保持する。

---

## 5. デプロイコマンド（参照）

デプロイ前検証:

```bash
az deployment group validate \
  --resource-group <resource-group-name> \
  --template-file materials/bicep/main.bicep \
  --parameters materials/bicep/dev.fastpath.local.bicepparam
```

デプロイ実行:

```bash
az deployment group create \
  --resource-group <resource-group-name> \
  --template-file materials/bicep/main.bicep \
  --parameters materials/bicep/dev.fastpath.local.bicepparam
```

出力確認:

```bash
az deployment group show \
  --resource-group <resource-group-name> \
  --name main \
  --query properties.outputs
```

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

- `deploymentMode` と `appServiceContainerImage` の不整合
- パラメータファイルの Entra ID 未設定
- ローカルパラメータ更新漏れ
- SWA SKU 制約を無視した Linked Backend 前提運用
- 認証設定変更後の EasyAuth 動作未確認

---

## 8. デプロイ後タスク（運用）

- 必要に応じて SWA デプロイトークンを取得
- App Service へバックエンド成果物/コンテナをデプロイ
- `/health` と `/api/health` を検証
- App Service で Key Vault secret 解決を確認
- Application Insights / Log Analytics へのテレメトリ流入を確認

---

## 9. 今後の拡張（任意）

- 診断設定・アラートの Bicep モジュール化
- DR 演習向けセカンダリリージョンパラメータの整備
- SKU やネットワーク既定値に対するポリシー/ガードレール導入
