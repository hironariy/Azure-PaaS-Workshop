---
title: "Day 2: 信頼性と復旧"
---

# Day 2: 信頼性と復旧

このページでは、**B1 / M25 / HA=false** の計画再起動・再 deploy・既知 revision の code rollback を観測します。これは managed DB failover / SLA / DR の実証ではありません。VM の OS 復旧、MongoDB replica-set 管理、Bastion/SSH、ASR は扱いません。

## 1. 実施条件と障害前のデータを確認する

[Day 1 の検証](day-1-validation.ja.html) を完了し、実 deploy / release、自己同意、認証付き CRUD、telemetry を確認したグループだけ実施します。Contributor-only / 事前準備なしで #16 の RBAC prerequisite を満たせない場合、または #15 の公開依存・SWA CLI 検証がブロック中なら、演習の成功は未検証です。管理者成功に置き換えません。共有アプリ・実ユーザーデータには障害注入しません。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load deployed || exit 1

node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

ブラウザーで、自分の published テスト記事と draft を 1 件ずつ作成します。post ID / slug、固定した title / content / tags / status、作成時刻を手元の私的なメモに記録し、公開の証拠には本文を貼りません。未認証では draft を参照できないことも確認します。詳細 GET は viewCount を増やすため、比較対象は **内容・所有者・状態** とし、viewCount や意図的編集後の updatedAt の違いをデータ破損としません。

各演習の合格条件は、control-plane 操作完了、公開契約、同じ記事の内容保持、認証付き更新/作成/削除、draft 非公開、telemetry の実流入です。health だけで合格にしません。

| 演習 | 影響・元に戻す方法 | 合格条件 |
|---|---|---|
| restart | B1 の API が一時停止し得る。自動起動を待ち、失敗時は startup / MI / KV / DB を診断 | 操作成功 + 下記の検証。outage 未観測なら復旧時間は未測定 |
| 同じ source の redeploy | 再 build / ZIP / Frontend upload。既知 revision を再 build して戻せることを先に確認 | 今回の release 完了 + 同じデータ + 認証付き CRUD |
| code rollback | 専用・clean checkout の revision だけを変更。DB schema / secret / app ID は変更しない | 既知 revision の配信 + 同じデータ + 認証付き CRUD |

## 2. 先に観測を開始してから再起動する

**Cloud Shell 1** で state を復元して観測を開始します。最初の `sample` が healthy であることを確認してから、Cloud Shell 2 で操作します。

```bash
node "$WORKSHOP_REPO_DIR/scripts/observe-workshop-recovery.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

実 hostname / saved context を照合し、直接 `/health` と SWA `/api/health` を並行 GET します。デフォルトは最大 30 sample、要求は各 10 秒 / 1 MiB、sample 間隔 15 秒です。API 記事詳細を連続アクセスせず、body / token を表示しません。`observation_started` / `sample` / `result` を JSON lines で表示します。

**Cloud Shell 2** でも同じ state をロードしてから、専用ターゲットを再起動します。

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

結果の読み方:

| 出力 | 意味 |
|---|---|
| `observed_recovery` | 失敗を観測し、その後に両経路で 2 回連続 healthy を確認した |
| `detectedAfterMs` / `confirmedAfterMs` | 観測開始から失敗 sample / healthy 確定までの monotonic 経過 |
| `observedRecoveryMs` | 最初の失敗 sample から healthy 確定まで。真の停止時間や DB failover RTO ではない |
| `healthy_without_observed_outage` | sample 間で短い停止を見逃した可能性。復旧時間は null、0 秒成功ではない |
| `observation_exhausted` | 上限内に healthy を確定できず exit 1。自動で SKU / DB / network / auth を変更しない |
| `rate_limited` | 429。停止時刻へ換算せず、stable healthy もリセットする |

sample は要求完了後の値で、15 秒間隔に要求時間が加わります。UTC は別 session / telemetry の照合、duration は単調増加 clock を使います。control-plane 操作時間と sample 上の復旧時間を別に記録します。HTTP 401/403/404/5xx、transport、JSON 契約エラーは診断対象ですが、それだけで DB failover と判定しません。`workshopReady: false` は常に維持します。

観測上限後は [Day 1 diagnostics](day-1-validation.ja.html) に戻ります。承認なく再起動を繰り返したり、public DB / Key Vault RBAC 無効化へ切り替えたりしません。

## 3. 既知の正常 revision を記録して再 deploy する

Cloud Shell 2 の専用 checkout が clean で、今回の release / CRUD が実際に正常だった場合だけ記録します。`git status` が dirty なら自分や他人の変更を reset / stash で隠さず、演習を止めます。

```bash
cd "$WORKSHOP_REPO_DIR" || exit 1
if [ -n "$(git status --porcelain)" ]; then
  echo "Clean dedicated checkout is required." >&2
  exit 1
fi
KNOWN_GOOD_REVISION="$(git rev-parse --verify HEAD)" || exit 1
printf 'Known-good source revision: %s\n' "$KNOWN_GOOD_REVISION"
```

この full SHA は非秘密の演習記録へ残します。package-lock、compiler/runtime、公開 registry の version/integrity、パラメータ、runtime settings も再 build に必要です。source SHA だけで ZIP が byte-identical になる保証はありません。既知 revision に JSON state 対応 scripts が含まれることを確認し、古い unsafe deploy script へ戻しません。

Cloud Shell 1 で再度観測を開始してから、Cloud Shell 2 で同じ source を再 deploy します。

```bash
bash "$WORKSHOP_REPO_DIR/scripts/deploy-backend.sh" "$RESOURCE_GROUP" "$APP_SERVICE_NAME" || exit 1
bash "$WORKSHOP_REPO_DIR/scripts/deploy-frontend.sh" "$RESOURCE_GROUP" || exit 1
node "$WORKSHOP_REPO_DIR/scripts/check-workshop-app.cjs" "$WORKSHOP_STATE_DIR" || exit 1
```

backend は一時 ZIP を削除するため、rollback は **既知 revision と lockfile からの rebuild** です。upload acceptance、古い instance の healthy と今回の release 完了を分け、Deployment Center の今回の時刻・成功状態・deployment ID と、対象 frontend 内容を照合します。registry / artifact が再取得不能なら rollback capability は未確認であり、演習を始めません。データを失う schema migration・password rotation・app registration 再作成はこの演習に含めません。

インフラの再現性も確認する場合は、[Day 1](day-1-deploy-infrastructure.ja.html) の同じ PARAM_FILE / names / context で validate → deploy → outputs 確認を実施します。既存 secret を再生成しません。これは RBAC / policy / quota と追加承認条件を満たした場合の確認であり、local compilation だけで idempotence 成功としません。

## 4. 既知 revision へ code rollback する

演習用の別 revision を実際に配信・確認してから、記録済みの known-good full SHA に戻します。意図的に本番障害を作ったり、他人の変更を削除したりする操作ではありません。

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

Cloud Shell 1 の観測を開始し、手順 3 の build/deploy を再実行します。B1 に slot swap はありません。失敗時は diagnostics → known-good rebuild / deployment 完了確認を行い、DB や secrets を削除しません。

演習後はローカル source を元に戻します。これは **ローカル checkout の復元だけ** で、配信コードは自動では変わりません。

```bash
if [ -n "$CURRENT_BRANCH" ]; then
  git switch "$CURRENT_BRANCH" || exit 1
else
  git switch --detach "$CURRENT_SOURCE" || exit 1
fi
```

## 5. 同じデータ・認証・telemetry を確認する

各操作後に元の post ID / slug で再表示し、title / content / tags / status / author が保たれていることを確認します。自分の published 記事だけを更新して reload し、新しい確認用 draft を作成→再表示→削除します。元の baseline 記事は演習終了まで残します。未認証で draft が隠れること、別ユーザーの投稿を操作しないことも維持します。

[Day 1 の公開契約・browser CRUD・telemetry](day-1-validation.ja.html) と [監視と運用](day-2-operations.ja.html) で今回の UTC 範囲を照合します。telemetry 0 件は成功ではありません。記録は revision / deployment ID、operation start/end、sample 結果、content 比較の pass/fail、CRUD / consent / telemetry 結果だけにし、token / password / raw logs / 本文は共有しません。

**この手順と native fixtures の成功は Azure 実証ではありません。** 実 restart / redeploy / rollback / DB persistence が成立するまで #17 は未解決です。

## 6. Optional の HA / restore / DR を本線と分離する

B1 の slots / zone redundancy、M25 の HA は利用できません。M30+ への upgrade は M25 へ戻せないため、単なる可逆的な workshop toggle としません。backup/restore、secondary region、Premium compute、Front Door などは、対応 SKU / region / quota / restore point / RPO / 費用 / rollback / cleanup と追加承認を確認した別演習です。現環境で実行していない optional 手順を検証済みとしません。

[BCDR reference](../disaster-recovery-guide.ja.html) は追加設計の参考であり、VM / ASR 演習を取り込んだり、baseline で multi-region failover が有効と解釈したりしません。

## 次に進む

- [Cleanup](cleanup.ja.html)
