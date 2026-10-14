---
title: "Day 2: 信頼性と復旧"
---

# Day 2: 信頼性と復旧

このページでは、ワークショップの標準構成（**App Service B1 / Cosmos DB M25 / HA=false**）において、計画的な再起動・再デプロイ・ロールバックを行った際の挙動と、データの永続性を確認します。

> **PaaS における復旧の特徴:**
> IaaS のように VM の OS 再起動や MongoDB レプリカセットの手動復旧を行うのではなく、App Service のプロセス再起動やビルド成果物の再デプロイによってアプリケーション層を復旧させます。一方、データ層（Cosmos DB for MongoDB vCore）はステートフルなマネージドサービスとして独立しているため、アプリケーションを再起動・再デプロイしても記事データはそのまま保持されます。

## 1. 事前状態とテストデータを確認する

まず、[Day 1: アプリケーションの動作確認](day-1-validation.ja.html) が完了しており、現在の環境が正常に応答することを確認します。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1

node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

ブラウザーでサインインし、**公開済み（Published）の記事 1 件**と**下書き（Draft）の記事 1 件**が存在することを確認します（未作成の場合は作成しておきます）。再起動や再デプロイの後に、同じ記事の内容・公開状態が保持されていることを確認します。

| 演習項目 | 内容 | 確認ポイント |
|---|---|---|
| 1. App Service の再起動 (`restart`) | `az webapp restart` を実行し、ヘルスチェックの応答推移を観測する | 再起動後に `/health` と `/api/health` が正常復帰し、既存の記事データが保持されていること |
| 2. 同一ソースからの再デプロイ (`redeploy`) | バックエンドとフロントエンドを再デプロイする | 再デプロイ後も公開 API・認証・既存記事データが維持されていること |
| 3. 既知の正常コミットへのロールバック (`rollback`) | 記録しておいた正常コミット（SHA）から再ビルド・再デプロイする | 問題発生時に特定のリビジョンへ安全に戻せること |

## 2. ヘルスチェックを観測しながら App Service を再起動する

Cloud Shell で 2 つのターミナル（タブ）を開き、片方でヘルスチェックの連続観測を行いながら、もう片方で App Service を再起動します。

**ターミナル 1（観測用）** で次のスクリプトを実行します。App Service 直接の `/health` と Static Web Apps 経由の `/api/health` を 15 秒間隔で並行チェックし、結果を JSON Lines 形式で表示します。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
node "$WORKSHOP_REPO_DIR/scripts/observe-workshop-recovery.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

最初の `sample` で `directHealthy: true` と `swaHealthy: true` が表示されたら、**ターミナル 2（操作用）** で App Service を再起動します。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1

OPERATION_STARTED="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
OPERATION_SECONDS=$SECONDS
printf 'restart started UTC=%s\n' "$OPERATION_STARTED"
az webapp restart --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_NAME" || exit 1
printf 'restart control-plane completed UTC=%s elapsed=%ss\n' \
  "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$((SECONDS - OPERATION_SECONDS))"
```

### 観測結果の見方

| `status` の値 | 意味 |
|---|---|
| `observed_recovery` | 再起動に伴う一時的な応答失敗（502/503 など）を検知し、その後に両経路で 2 回連続の正常応答（`healthy`）を確認した状態。`observedRecoveryMs` に検知から復旧確認までの経過時間が記録されます。 |
| `healthy_without_observed_outage` | ポーリング間隔（15 秒）の間に再起動と復帰が完了し、一度もエラーが観測されずに正常応答が継続した状態。 |
| `observation_exhausted` | 最大試行回数内に正常応答へ復帰しなかった状態。`az webapp log tail` や [Day 1 の切り分け手順](day-1-validation.ja.html) で起動エラーを確認します。 |

## 3. 正常動作コミットを記録して再デプロイする

現在正常に動作している Git コミットのハッシュ（SHA）を記録し、同じソースから再デプロイしても環境とデータが維持されることを確認します。

```bash
cd "$WORKSHOP_REPO_DIR" || exit 1
if [ -n "$(git status --porcelain)" ]; then
  echo "未コミットの変更があります。git status を確認してください。" >&2
  exit 1
fi
KNOWN_GOOD_REVISION="$(git rev-parse --verify HEAD)" || exit 1
printf 'Known-good source revision: %s\n' "$KNOWN_GOOD_REVISION"
```

バックエンドとフロントエンドを再デプロイし、公開エンドポイントのチェックを実行します。

```bash
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME" || exit 1
./scripts/deploy-frontend.sh "$RESOURCE_GROUP" || exit 1
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

また、Bicep テンプレートも同じパラメータファイル（`$PARAM_FILE`）を使って冪等に再実行できます（既存の DB パスワードや Key Vault ロール割り当てはそのまま保持されます）。

## 4. 記録したコミットへロールバックする

コード変更後に問題が見つかった場合を想定し、手順 3 で記録した `KNOWN_GOOD_REVISION` をチェックアウトして再デプロイする手順を確認します。

```bash
cd "$WORKSHOP_REPO_DIR" || exit 1
if [ -n "$(git status --porcelain)" ]; then
  echo "Dirty checkout: refusing revision switch." >&2
  exit 1
fi
if ! [[ "${KNOWN_GOOD_REVISION:-}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Set the verified full SHA recorded in step 3." >&2
  exit 1
fi
CURRENT_SOURCE="$(git rev-parse --verify HEAD)" || exit 1
CURRENT_BRANCH="$(git branch --show-current)" || exit 1
git rev-parse --verify "${KNOWN_GOOD_REVISION}^{commit}" > /dev/null || exit 1
git switch --detach "$KNOWN_GOOD_REVISION" || exit 1
```

この状態で `./scripts/deploy-backend.sh` や `./scripts/deploy-frontend.sh` を実行することで、正常動作を確認済みのリビジョンへロールバックできます。

確認が終わったら、ローカルのブランチを元に戻します。

```bash
if [ -n "$CURRENT_BRANCH" ]; then
  git switch "$CURRENT_BRANCH" || exit 1
else
  git switch --detach "$CURRENT_SOURCE" || exit 1
fi
```

## 5. 再起動・再デプロイ後のデータとテレメトリを確認する

1. ブラウザーでブログアプリを再読み込みし、手順 1 で確認した**公開記事**と**下書き記事**のタイトル・本文・タグ・公開状態がそのまま保持されていることを確認します。
2. 新しい下書き記事を 1 件作成して削除し、認証付きの書き込み操作も正常に行えることを確認します。
3. [Day 2: 監視と運用](day-2-operations.ja.html) の KQL クエリを実行し、再起動・再デプロイ中のリクエストや応答時間が Application Insights / Log Analytics に記録されていることを確認します。

## 6. ワークショップ標準構成と本番向け高可用性（HA / DR）の違い

このワークショップの標準構成（`B1` / `M25` / `HA=false`）は学習・検証向けにコストを最小化した構成であり、本番環境向けの高可用性構成とは次の点が異なります。

| 観点 | ワークショップ標準構成 (`dev`) | 本番向け拡張構成（参考） |
|---|---|---|
| App Service | `B1`（単一インスタンス、デプロイスロットなし） | `Standard` / `Premium`（複数インスタンス、デプロイスロットによるゼロダウンタイム切り替え、ゾーン冗長） |
| Cosmos DB (MongoDB vCore) | `M25`（開発・検証用、高可用性 `HA=false`） | `M30` 以上（ゾーン冗長 HA 有効化、バックアップ・ポイントインタイムリストア）※ `M30` 以上へ変更すると `M25` には戻せません |
| リージョン構成 | 単一リージョン構成 | セカンダリリージョンへの Bicep 展開とトラフィック切り替え |

本番システム向けの事業継続・災害復旧（BCDR）の設計ポイントについては、[BCDR ガイド](../disaster-recovery-guide.ja.html) を参照してください。

## 次に進む

- [クリーンアップ（リソース削除）](cleanup.ja.html)
