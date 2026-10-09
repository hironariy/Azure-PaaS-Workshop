# Azure PaaS Workshop 改善計画と Issue 解決戦略

作成日: 2026-10-09

状態: 実装計画承認済み・段階的に実施

対象: [Azure-PaaS-Workshop](https://github.com/hironariy/Azure-PaaS-Workshop) の Issue #13–#23

本計画は、姉妹 IaaS リポジトリの改善内容と PaaS の現行実装を比較した結果に基づく。**既存の #13・#14・#15 を最優先の解決対象に含め、#16–#23 と一体のリリース計画として扱う。** 文書の作成や Issue の登録は、各不具合の解決・Azure 上の動作確認を意味しない。

## 1. 改善の目的と対象範囲を固定する

最初の目標は機能追加ではなく、受講者が既存のワークショップを確実に完了できる状態にすること。

- Cloud Shell Bash で Day 0 → Day 1 → Day 2 → Cleanup を連続して実行できる。
- Contributor のみ・講師の事前準備なしで進められる範囲と、Azure / Entra の権限制約で実施できない範囲を開始前に区別する。
- 日本語の投稿、認証、CRUD、再接続、再デプロイが正常に動作する。
- 失敗を成功と表示せず、原因を調査でき、秘密値を出力しない。
- 実際の SKU・設定・費用に一致する説明で PaaS の責任分界と復旧を学べる。

本線は **Cloud Shell Bash → Bicep standard mode → App Service の ZIP deploy → Static Web Apps Linked Backend → managed database** とする。日本語 learner pages を本線とし、GitHub Actions、fastpath-container、追加の HA/DR は任意の経路として区別する。

### 承認された実装上の選択

- 新規記事は Unicode の文字・数字を保持する slug を使い、空の場合は URL-safe な識別子へ fallback する。既存記事の URL は変更しない。
- Backend は Node.js built-in test runner と既存 TypeScript support、frontend は Vitest を使う。
- Issue ごとの branch / commit / PR で実施し、自動 merge・Issue closure・branch protection 変更は行わない。
- 実 Azure 検証は指定された隔離環境で baseline SKU に限定する。環境識別子・秘密値を教材の既定値として保存しない。
- Tenant-wide policy 変更と、追加費用を伴う optional HA / secondary-region 検証は別途承認を得る。

### Contributor-only 本線の制約

Contributor は `Microsoft.Authorization/roleAssignments/write` を持たない。現行 Bicep が App Service の Managed Identity に Key Vault Secrets User を割り当てる操作は、Contributor のみ・事前準備なしでは実行できない。また、Contributor は Entra のアプリ登録作成・ユーザー同意権限を意味しない。

この条件で Key Vault reference を含む fresh deployment 全体が完了できるとは説明しない。RBAC を無効にする、access policy へ置き換える、秘密値を公開する、必要な割り当てを省略して成功とする、受講者を自動昇格する、といった回避策は採用しない。正確な preflight・明示的な失敗・権限別の検証結果を成果物とし、未達の acceptance criteria を残す。

管理者権限による positive deployment はアプリ・IaC の検証として区別し、Contributor-only 完了の証拠にしない。自己同意は per-group app と browser/MSAL flow を使い、tenant policy が許可する場合に限る。制限を解消する architecture / permission 方針の変更が必要なら、別の意思決定として扱う。

この安定化計画では、新たな Container Apps / Functions / database の導入、VM / SSH / Bastion / ASR の導入、大規模な framework 移行、姉妹リポジトリとの共通パッケージ化は行わない。依存関係の修正で必要となる互換性対応は #15 の範囲で判断する。

## 2. 現状と未検証事項を区別する

2026-10-09 時点で #13–#23 はすべて open、open PR はない。調査基準の PaaS main は `005cc191d970b7ee3374ad73452270ebacb98eef`。着手時には最新の状態と差分を再確認する。

ソースで確認した重要な事項:

- Backend の slug 生成は ASCII 中心で、日本語などのタイトルを扱えない経路がある（#14）。
- Day 0 の Entra permission grant とアプリ登録作成では必要権限が異なる（#13）。
- Bicep が Key Vault role assignment を作成するため、Contributor 単独では必要な Azure RBAC 操作を満たさない（#16）。
- Cloud Shell の RG 名と保存 state に不整合がある（#20）。
- Active root workflow は Pages 公開で、application / Bicep の PR 品質 gate がない（#19）。
- Backend は `test: jest` を定義するが、manifest に Jest の依存宣言がない。調査時に application test files は見つからなかった。既存 test commands を CI に追加するだけではテスト基盤にならない。
- Baseline は database HA=false。PaaS の採用だけでアプリ全体の HA を保証するものではない。

本計画作成時に新たな npm audit、build、lint、application tests、Azure deployment、権限別の実証は実行していない。#15 に記録された監査件数を現在の件数として転用しない。ソース確認、ローカル検証、Azure 実証の結果を別々に記録する。

## 3. Issue ごとの成果物と優先度を明確にする

High は受講者の完了を妨げる問題、依存関係の是正、失敗・秘密値の扱いを優先する区分。Medium は再現性、教材の整合性、運用学習を改善する区分であり、脆弱性の severity を表すものではない。

| Issue | 優先度 | 主な成果物 | 完了判断 |
|---|---|---|---|
| [#13](https://github.com/hironariy/Azure-PaaS-Workshop/issues/13) | High | App ownership・permission request・自己同意・管理者同意を分けた Day 0 | Policy が許可する自己同意を実証し、blocked な条件を明記 |
| [#14](https://github.com/hironariy/Azure-PaaS-Workshop/issues/14) | High | Unicode 対応の slug、互換性維持、モデル/API 回帰テスト | 日本語などの draft/published CRUD と既存 URL が正常 |
| [#15](https://github.com/hironariy/Azure-PaaS-Workshop/issues/15) | High | 依存修正、lockfile install、deploy tooling の整理、継続監査 | Issue が要求する全監査範囲で検出ゼロと機能維持 |
| [#16](https://github.com/hironariy/Azure-PaaS-Workshop/issues/16) | High | 必要権限の preflight と Contributor-only の platform limitation | Contributor denial と authorized deployment を分けて記録。未達条件を完了扱いしない |
| [#18](https://github.com/hironariy/Azure-PaaS-Workshop/issues/18) | High | 明確な失敗通知、秘密値を出さない診断、安全な Cleanup | 権限・通信・state エラーを誤った成功に置き換えない |
| [#20](https://github.com/hironariy/Azure-PaaS-Workshop/issues/20) | High | RG / tenant / subscription / cwd / state の統一 | 順次実行とセッション再接続で同じ対象を操作 |
| [#19](https://github.com/hironariy/Azure-PaaS-Workshop/issues/19) | Medium・早期着手 | 動作する test harness と deploy-independent 品質 CI | 意図した失敗を検知し、対象 checks が正常終了 |
| [#21](https://github.com/hironariy/Azure-PaaS-Workshop/issues/21) | Medium | API / UI / startup logs / Key Vault / DB の検証手順 | 健全性だけでなく認証と実データ CRUD を検証 |
| [#22](https://github.com/hironariy/Azure-PaaS-Workshop/issues/22) | Medium | Region / SKU / quota preflight と deployment 進捗確認 | 利用不可・Running・Failed を区別し、次の対処が分かる |
| [#23](https://github.com/hironariy/Azure-PaaS-Workshop/issues/23) | Medium・早期着手 | 設計・図・費用・比較・配布 artifact の整合 | Baseline と optional の説明が実装と一致 |
| [#17](https://github.com/hironariy/Azure-PaaS-Workshop/issues/17) | Medium | 計測可能な restart / redeploy / recovery 演習 | 復旧・data integrity・元に戻す操作を実証 |

## 4. #13 の Entra 権限と管理者同意を解決する

### 実装方針

- アプリ登録作成、所有アプリの設定、API permission 要求、実際の同意付与を別操作として説明する。
- 本線は per-group owned app と browser/MSAL の自己同意を使えるか確認する。現行の無条件 AllPrincipals grant は受講者手順から外す。
- 対象 tenant、Frontend / Backend client ID、service principal object ID、scope、実行担当を確認してから同意を付与する。
- 管理者支援は明示的な代替経路に限定する。Contributor-only 本線が成功した証拠として扱わず、受講者全員への Global Administrator / Application Administrator 付与を標準にしない。
- 自己同意経路は tenant policy と CLI の挙動を確認して設計する。共有アプリの grant を壊し得るため、単に Principal に変更して繰り返す回避策は採用しない。
- Azure resource の Owner / Contributor と Entra の同意権限を混同しない。Azure RBAC 側は #16 と合わせて説明する。

### 検証と完了条件

- [ ] 隔離した検証用アプリで、learner の登録・設定と管理者の同意を役割別に確認する。
- [ ] 必要ロール不足の失敗と PIM / tenant 違いを区別し、依頼する値と対処を説明する。
- [ ] Grant の resource、scope、consentType、principalId を確認する。
- [ ] Frontend の sign-in と Backend への認証付き API 呼び出しまで成立する。
- [ ] 既存 grant を意図せず削除・置換せず、共有アプリの他受講者を壊さない。

## 5. #14 の Unicode 投稿と URL 互換性を解決する

### 実装方針

- 日本語・中国語・韓国語・accented Latin などを扱える slug 方針を決める。Unicode slug と文字種非依存の識別子のどちらでも、URL・一意性・既存互換性を優先する。
- Emoji / 記号だけでも、空文字やハイフンだけの slug にしない。
- 既存の記事 URL と編集時に slug を維持する挙動を保持する。既存データの一括書き換えは既定にしない。
- 同名タイトルと同時作成の競合を確認し、DB の unique 制約を含めて一意性を維持する。重複の事前照会だけで競合が防げるとみなさない。
- 必要に応じて API の安全なエラー分類を画面へ伝え、入力を保持する。秘密値・内部スタックを利用者へ公開しない。
- #19 の Node.js built-in backend test runner / frontend Vitest を使い、同じ目的の別 runner を独自に導入しない。

### 検証と完了条件

- [ ] Unicode-only / mixed / emoji / 記号 / 同名タイトルの model・API tests を用意する。
- [ ] Draft / published 作成が正常終了し、詳細表示・編集・削除まで確認する。
- [ ] 日本語本文・要約・tags が保存・再取得後も保持される。
- [ ] URL encoding、duplicate key の扱い、既存英語 URL を確認する。
- [ ] Day 1 の日本語 CRUD smoke-check に反映し、#21 と同じ入力・期待結果を使う。

## 6. #15 の依存関係と deployment tooling をクリーンにする

### 実装方針

- 着手時に frontend/backend の全依存・production 依存と、lockfile・配置 package の監査を取得する。Advisory、依存経路、修正版、実行環境と日時を記録する。
- Compatible な上位パッケージ更新を優先する。`npm audit fix --force` の一括適用や理由のない downgrade / override をしない。
- Major 更新が必要な場合は、根拠、移行内容、既存機能への影響を明記し、必要範囲だけ変更する。
- Build と deploy の install を lockfile-based にそろえ、frontend/backend と ZIP 内の production dependencies を整合させる。
- SWA CLI の install / execution 警告は application dependencies と分けて調査する。未解消なら安全な対応版や deploy 経路を検討する。
- #19 の test tooling を含む manifest / lockfile 変更は同じ担当へ集約するか順番に merge する。独立 PR の lockfile 再生成を同時に進めない。
- Continuous audit は #19 の CI と統合する。通信失敗や警告抑制を監査成功として扱わない。

### 検証と完了条件

- [ ] サポートする Node.js 環境で clean `npm ci` が成功し、lockfile に意図しない差分が出ない。
- [ ] Issue #15 が要求する全依存・production・lockfile・配置 package の監査が正常終了し、すべての severity がゼロ。
- [ ] SWA CLI 等の受講者 tooling も確認し、application audit と混同しない。
- [ ] Build / type-check / lint / tests と HTML sanitization の回帰を確認する。
- [ ] MSAL sign-in、SPA routing、runtime config、Linked Backend、startup、CRUD を維持する。
- [ ] 未修正の Advisory が残る場合は影響・緩和策・解消計画を記録し、検出ゼロの条件を満たしたとして閉じない。

## 7. 実装を段階化し、並行作業の境界を決める

| 段階 | 作業 | 終了条件 |
|---|---|---|
| 0: Baseline 固定 | #23 の本線／optional 定義、#19 の baseline failures と test harness 方針整理 | 実装対象と既存失敗が明確。見かけ上の green CI を作らない |
| 1: 完了ブロッカー解消 | Identity track: #13 / #16。Learner track: #20 / #18。Application track: #14 / #15 と必要な test foundation | 日本語 CRUD と安全な learner flow。権限上実施できない deploy / consent を明記 |
| 2: 再現性の確立 | #19 の品質 gate 完成、#21 の smoke-check、#22 の preflight、#23 の文書同期 | Clean checkout と Cloud Shell 再接続を含む rehearsal が成功 |
| 3: 信頼性学習の拡充 | #17 の baseline 演習、検証できる optional HA/DR | 計測・data integrity・回復操作・費用制約を実証 |

段階は作業開始の絶対的な直列順序ではない。独立した track は並行してよいが、次の実際の前提を守る。

- #14 のテストと #15 の依存更新は、test harness と manifest / lockfile の管理方針を共有する。
- #19 は早期に着手するが、既存失敗を隠したまま完了にしない。依存 remediation とテスト追加の結果を取り込んでから gate を完成する。
- #21 の最終受講者検証は #13 / #16 の権限経路、#20 の state、#14 の Unicode 修正、#15 の配置成果物を前提とする。手順作成は先行してよい。
- #17 の復旧後検証には #21 の smoke-check を再利用し、#18 の安全な操作・失敗通知と #22 の対応 region / tier 条件を使う。
- 各 functional PR で直接関連する文書を更新する。すべての文書修正を #23 の最後へ延期しない。

## 8. アプリの追加改善は受講者価値に絞る

安定化中は、新しいブログ機能より次の品質を優先する。

| 領域 | 改善方針 | 検証する結果 |
|---|---|---|
| 入力・エラー UX | Validation / authentication / authorization / network / server failure を安全に区別し、投稿入力を保持 | 原因不明の再試行を減らし、秘密値を表示しない |
| Testability | Model/API tests、重要 frontend flows、Azure の実 identity/routing 確認を分離 | Mocks の成功を Azure 実証と取り違えない |
| Operational behavior | Startup、graceful shutdown、再接続、readiness、redeploy を確認 | Restart / redeploy 前後で記事と認証が維持される |
| Observability | 必要なログと telemetry の実流入を確認し、時刻・操作・エラーを対応づける | 設定値の存在だけで監視成功としない |
| 教育的な比較 | IaaS の現行構成との差分を責任分界で説明 | OS / replica-set 管理を省いた分、identity・data・application 運用を学べる |

App Service slots / autoscale / zone redundancy / database HA / secondary-region recovery は、利用 SKU と region の条件、費用、backup、元に戻す操作を確認して optional にする。Baseline の B1 / database HA=false で利用できると仮定しない。

復旧演習では rate-limited な `/api` の 429、transport errors、5xx、control-plane 操作時間、アプリ復旧時間を区別する。Health 200 のほか、認証付き CRUD と障害前のデータ保持を確認する。

## 9. PR の粒度と検証証拠を決める

原則として **1 PR = 1 つの主要 Issue または独立した成果物**。#17 / #19 / #23 のような広い Issue は段階 PR に分け、未達の acceptance criteria がある間は parent Issue を閉じない。

各 PR に次を記録する。

- 対象 Issue、変更した挙動、維持する API / URL / learner workflow。
- Automated checks の結果と、必要な Azure / browser / Portal 検証の結果。
- 満たした acceptance criteria、未検証事項、既存失敗、optional 制約。
- 権限・費用・data への影響と rollback / recovery の方法。
- 変更した learner docs、troubleshooting、必要な講師準備。

検証は、小さいチェックから実経路へ段階的に広げる。

1. Unit / model / isolated API / focused frontend tests と targeted lint / type-check。
2. Clean install、build、ZIP / SWA artifacts、Bicep diagnostics と relevant parameter surface。
3. Fresh Cloud Shell で Day 0 → Day 1 → Day 2 → Cleanup を実行する Azure rehearsal。
4. 別の実施者による learner-level permissions と documented instructor support の独立 rehearsal。

Azure grant、Managed Identity / Key Vault references、SWA Linked Backend、regional capacity はローカル mock だけでは実証できない。明示的なスキップや baseline failure は記録し、成功へ置き換えない。テスト不在を無条件の `passWithNoTests` で完了としない。

## 10. リリースの完成条件を決める

### Milestone A: 受講者 pilot に進める

- [ ] #13 / #16 の Contributor-only 制約と自己同意の policy 条件が実証され、必要な条件を満たせない場合は pilot-ready としない。
- [ ] #14 の日本語 CRUD と既存 URL の互換性が確認されている。
- [ ] #15 の監査条件と clean install / deploy 条件を満たしている。
- [ ] #18 / #20 の状態復元、失敗通知、秘密値を出さない診断、Cleanup が成立する。
- [ ] #19 の relevant checks が enforced で、既存失敗を隠していない。Required checks は repository settings でも確認する。
- [ ] #21 / #22 の本線検証・preflight と #23 の利用者に影響する説明が整合する。
- [ ] Fresh Cloud Shell で少なくとも 1 回、途中再接続を含む本線 rehearsal が成功する。

### Milestone B: ワークショップ実施に進める

- [ ] Pilot feedback を記録し、完了ブロッカーを解消する。
- [ ] 別の実施者が、選択した learner-level permissions で独立 rehearsal を完了する。管理者が補った操作や権限上の未達を隠さない。
- [ ] #17 の必須 baseline recovery exercises が実証され、optional exercises の利用条件と未対応範囲が明確。
- [ ] 日本語 learner flow、portal navigation、internal links、Pages preview/build を必要な範囲で確認する。
- [ ] 進捗保存、copy buttons、狭い画面の表示を、portal 変更がある場合に確認する。
- [ ] Architecture、費用、Instructor preparation、troubleshooting、rollback、Cleanup がリリース対象と一致する。

日付や所要時間は実証結果から決める。Build の成功、文書の追加、Issue の登録だけをリリース判断にしない。

## 11. 姉妹リポジトリの改善を継続的に取り込む

IaaS の Issue を「共通 application」「learner workflow」「PaaS へ適応する運用原則」「IaaS 専用」に分類し、既存 PaaS Issue への重複登録を避ける。

- 共通 application fixes は差分と tests を比較して取り込み、source comment の「IDENTICAL」だけで互換性を判断しない。
- IaaS の修正を参考にしても、PaaS の auth、runtime config、deployment artifacts、database、telemetry を再確認する。
- VM kernel、Run Command、MongoDB keyFile、ASR の実装は移さず、責任分界の説明に活用する。
- IaaS 比較と対応記録を更新し、次回の workshop release 前に新しい relevant Issues を確認する。

参考: [Azure-IaaS-Workshop Issues](https://github.com/hironariy/Azure-IaaS-Workshop/issues)、[Materials Validation Strategy](MaterialsValidationStrategy.md)、[受講者ポータル](../materials/docs/index.md)。

## 12. 初回実装の証拠と未解決事項を反映する

初回の実装は Issue ごとの PR に分けて開始した。以下は全 Issue の解決宣言ではなく、次の実装・レビューのための到達点である。PR は自動 merge せず、Issue も閉じていない。

| 対象 | 成果物 | 現時点で言えること | 未達の検証・条件 |
|---|---|---|---|
| #19 foundation | #25: Node / Vitest の回帰テスト基盤 | 実行可能な model / HTTP / runtime-config tests | 全体 CI と Azure の実証は別 |
| #14 | #26: Unicode slug、競合 retry、URL encode、作成エラー表示 | 日本語・記号 fallback、draft/published、競合と安全なエラーをローカル検証 | 実 DB とブラウザー CRUD / ownership / 既存 URL |
| #15 | **Draft #27:** 依存更新 candidate と再現可能な build | 設定済み registry 内では clean install / audit / production ZIP smoke が成功 | public release / package provenance、通常の Cloud Shell 再現性、SWA CLI |
| #13 | #28: 自己同意と管理者例外の分離 | learner の暗黙 AllPrincipals grant を除き、所有者・request・grant の確認を明記 | 実ユーザーの policy / consent / token / 認証付き API |
| #16 | #29: read-only RBAC preflight | 承認された環境の tenant/subscription を確認。RG は未作成で、呼び出し元には必要な roleAssignments/write が許可として報告されず停止 | isolated Contributor principal の実証、権限を保持した新規 deploy |
| #19 gate | **Draft #30:** app / Bicep CI | 実 GitHub run で Bicep artifact parity は成功。app jobs は package-source guard で停止 | public-source の依存解決後の green CI と手動 required-check 設定 |

### 依存更新は registry の結果だけで完成にしない

初回環境の registry は package mirror を使用しており、更新後の lockfile もその artifact URL を参照した。そこでの audit 0 件は public npm 上の公開版・upstream provenance の証明ではない。Axios 1.20.0 は public npm の確認で E404、latest は 1.18.1 だった。他パッケージの public metadata 取得で生じた transport error も成功と解釈しない。

このため #27 は draft とし、#30 は非 public npm の package source をインストール前に拒否する。URL だけを置換して未公開 version / integrity を残したり、組織固有 registry を説明なしの前提にしたりしない。公開済みの supported versions と source を再確認し、通常の Cloud Shell で clean install / audit / build が成立するまで #15 は未解決である。

別途インストールして確認した SWA CLI 2.0.10 は、互換範囲の `npm audit fix` 後も 6 件（high 5、low 1）の package-level 指摘が残った。これは unique CVE 数や exploitability の実証ではない。古い CLI への強制 downgrade、非互換 override、警告抑制で解決扱いにしない。

### Azure の停止は失敗を隠すためのスキップではない

承認された環境で read-only permission check は実行したが、必要な `Microsoft.Authorization/roleAssignments/write` が許可として報告されなかったため、リソースは作成していない。これは現在の呼び出し元の結果であり、isolated principal に Contributor だけを割り当てた試験の代用とはしない。Contributor-only / 主催者事前準備なしという条件を、受講者の権限昇格や Key Vault RBAC 無効化で変更しない。

### 次の実装は独立した作業とブロックされた実証を分ける

#20 の state / naming と #18 の失敗通知・秘密値・Cleanup、#22 の preflight、#21 の diagnostics、#23 の文書同期は、可能なローカル実装を継続できる。一方、public-source 依存の確認、必要権限、実ユーザー consent、実 DB / browser の証拠がないまま、#17 の有料・復旧演習や workshop-ready 判定へ進まない。環境 ID と認証情報は repository の既定値にせず、検証用の非公開設定に保持する。
