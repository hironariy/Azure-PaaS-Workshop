# Azure PaaS ワークショップ - マルチユーザー ブログ アプリケーション

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English version: [README.md](./README.md)
注: 日本語版の受講者導線を先行して更新しています。英語版 README は後続フェーズで同期予定です。

このリポジトリは、マルチユーザー ブログ アプリケーションを Azure PaaS で構築しながら、App Service、Static Web Apps、Azure DocumentDB、Key Vault、Managed Identity、Application Insights などのマネージドサービス設計・デプロイ・運用を学ぶためのハンズオン教材です。

## まずどこから始めるか

| 利用者 | 入口 | 目的 |
|---|---|---|
| 受講者 | [受講者ポータル](https://hironariy.github.io/Azure-PaaS-Workshop/) または [Markdown 版ポータル](materials/docs/index.md) | Cloud Shell だけで Day 0、Day 1、Day 2、Cleanup を順番に進める |
| 講師 / TA | [インストラクターガイド](docs/instructor-guide.ja.md) | 進行上の注意点、成功条件、つまずきやすいポイントを確認する |
| 教材・アプリ開発者 | [ローカル開発セットアップ（任意）](materials/docs/development/local-development-setup.ja.md) と [design/](design/) | アプリケーション、Bicep、教材を保守・拡張する |

GitHub Pages を有効化したコピーリポジトリでは、公開 URL は通常 `https://<OWNER>.github.io/<REPOSITORY>/` になります。Pages が未設定の場合も、`materials/docs/*.ja.md` を GitHub 上でそのまま読めます。

## 受講者向けクイックリンク

| 順番 | ページ | 内容 |
|---|---|---|
| 1 | [受講者クイックスタート](materials/docs/learner/cloud-shell-quickstart.ja.md) | Cloud Shell Bash、リポジトリ取得、共通変数、ツール確認 |
| 2 | [Day 0: 事前準備](materials/docs/learner/day-0-prerequisites.ja.md) | サブスクリプション、Resource Provider、リージョン、Quota、リソースグループ |
| 3 | [Day 0: Entra ID と認証設定](materials/docs/learner/day-0-entra-id.ja.md) | Backend API / Frontend SPA の app registration と認証パラメータ |
| 4 | [Day 1: PaaS インフラをデプロイ](materials/docs/learner/day-1-deploy-infrastructure.ja.md) | Bicep、FastPath container、Static Web Apps Standard、App Service、DocumentDB、Key Vault |
| 5 | [Day 1: フロントエンドをデプロイ](materials/docs/learner/day-1-deploy-frontend.ja.md) | Cloud Shell 上での React build、runtime config 注入、Static Web Apps deploy |
| 6 | [Day 1: アプリを検証](materials/docs/learner/day-1-validation.ja.md) | `/health`、`/api/health`、サインイン、CRUD、初期テレメトリ確認 |
| 7 | [Day 2: 監視と運用](materials/docs/learner/day-2-operations.ja.md) | App Service logs、Key Vault reference、Managed Identity、Application Insights、Log Analytics |
| 8 | [Day 2: 信頼性と復旧](materials/docs/learner/day-2-reliability.ja.md) | ヘルスチェック、restart、再デプロイ可能性、BCDR 観点 |
| 9 | [Cleanup](materials/docs/learner/cleanup.ja.md) | Resource Group、Entra ID app registration、Cloud Shell 作業ファイルの削除 |
| 10 | [トラブルシューティング](materials/docs/learner/troubleshooting.ja.md) | Cloud Shell、Provider、Entra ID、Bicep、App Service、SWA の症状別確認 |
| 11 | [クイックリファレンス](materials/docs/reference/quick-reference-card.ja.md) | 変数、主要 URL、ヘルスチェック、ログ、redirect URI、Cleanup コマンド |

通常のワークショップ参加では、ローカル PC に Azure CLI、Azure PowerShell、Bicep CLI、Node.js、Docker、WSL、PowerShell をインストールする必要はありません。CLI とデプロイ作業は Azure Cloud Shell Bash を標準にします。

## ワークショップ概要

### 対象者

- AWS の設計・運用経験があり、Azure PaaS の実践パターンを学びたいエンジニア
- Azure レベルは AZ-900 から AZ-104 程度
- IaaS から PaaS への移行、モダナイズ、マネージドサービス運用を体験したい方
- Day 1 の [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) と同じ題材を PaaS で比較したい方

### 学習内容

| トピック | 主な Azure サービス |
|---|---|
| マネージド compute | Azure Static Web Apps、Azure App Service |
| マネージド database | Azure DocumentDB / Cosmos DB for MongoDB vCore |
| アイデンティティ | Microsoft Entra ID、EasyAuth |
| シークレット管理 | Azure Key Vault、Managed Identity、Azure RBAC |
| ネットワーク | Virtual Network、VNet Integration、Private Endpoints、NAT Gateway |
| Infrastructure as Code | Bicep |
| 監視 | Application Insights、Azure Monitor、Log Analytics |
| 信頼性 / 運用 | Health check、再デプロイ、ログ確認、BCDR 観点 |

## サンプルアプリケーション

サンプルは、Microsoft Entra ID 認証を使うマルチユーザー ブログプラットフォームです。

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18、TypeScript、TailwindCSS、Vite |
| バックエンド | Node.js 22、Express.js、TypeScript |
| データベース | Azure DocumentDB / Cosmos DB for MongoDB vCore |
| 認証 | Microsoft Entra ID + MSAL.js |

主な機能:

- 公開ブログ投稿の閲覧
- 認証済みユーザーによる投稿作成、編集、削除
- 下書き保存
- プロフィール管理

## Azure アーキテクチャ

![Architecture Diagram](assets/images/architecture.png)

このワークショップでは、フロントエンドを Azure Static Web Apps、バックエンド API を Azure App Service、データベースを Azure DocumentDB / Cosmos DB for MongoDB vCore で構成します。Static Web Apps Linked Backend で `/api/*` を App Service にルーティングし、Key Vault、Managed Identity、Private Endpoints、Application Insights を組み合わせて PaaS らしいセキュリティと運用を学びます。

Application Gateway、Bastion、VM への SSH、Azure Site Recovery などの IaaS 手順は、この PaaS ワークショップの受講者本線では使用しません。

## リポジトリ構成

| パス | 内容 |
|---|---|
| `materials/docs/` | 受講者向けポータル、Cloud Shell 手順、補足資料 |
| `materials/bicep/` | Azure PaaS 環境をデプロイする Bicep テンプレート |
| `materials/frontend/` | React フロントエンド |
| `materials/backend/` | Express バックエンド |
| `docs/` | 講師向け、ローカル開発、デプロイスクリプトなどの補足ドキュメント |
| `design/` | アーキテクチャ、バックエンド、フロントエンド、DB、横断設計 |
| `scripts/` | プレビュー、デプロイ補助、検証用スクリプト |
| `.github/workflows/pages.yml` | GitHub Actions-based Pages による受講者ポータル公開 |

## 開発者向け

アプリケーションをローカルで実行・変更する場合は、[ローカル開発セットアップ（任意）](materials/docs/development/local-development-setup.ja.md) と [docs/local-development-setup.ja.md](docs/local-development-setup.ja.md) を参照してください。これは受講者の通常デプロイ手順ではなく、教材やアプリケーションを保守する開発者向けの任意資料です。

Bicep の構造を理解したい場合は、[Bicep ガイド](materials/docs/bicep-guide.ja.md) と [materials/bicep/README.md](materials/bicep/README.md) を参照してください。既存のデプロイスクリプトを確認したい場合は、[デプロイスクリプトガイド（任意）](materials/docs/development/deployment-scripts-guide.ja.md) を参照してください。

## GitHub Pages の公開

このリポジトリは GitHub Actions-based Pages を使います。管理者は GitHub の **Settings > Pages** で source を **GitHub Actions** に設定してください。`main` ブランチに `materials/docs/**`、`assets/**`、または `.github/workflows/pages.yml` の変更が push されると、受講者ポータルがビルド・公開されます。

ローカルで Pages build を確認する場合は、Docker Desktop を起動して次を実行します。

```bash
./scripts/preview-pages.sh build
```

## ライセンス

このプロジェクトは [MIT License](LICENSE) のもとで公開されています。
