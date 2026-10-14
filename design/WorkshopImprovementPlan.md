# Azure PaaS Workshop 改善計画と Issue 解決戦略

作成日: 2026-10-09

再評価日: 2026-10-14

### 現行の受講前提と Issue 共通方針（2026-10-14）

ユーザーの明示的な指示により、受講者は **利用する Azure サブスクリプションの Owner** を保持することを正式な前提とする。従来の strict Contributor-only / 管理者支援なしの完走条件は撤回し、今後の Issue 対応・受け入れ・Azure rehearsal は Owner を基準にする。必要なら PIM を有効化する。Resource Group だけの Owner や Contributor のみでの完走は本線の対象外である。

Entra のアプリ登録・本人同意は別の権限であり、**Application Developer と本人専用 Principal grant** を維持する。Azure Owner を Entra の Global Administrator / 組織全体同意と同一視しない。現在の CLI が Contributor のままなら、Owner の実証としてデプロイせず停止する。方針変更は現在のアカウントへのロール追加を実行する許可ではない。

#13 の CLI は #58 で main に採用済み。2026-10-14 の Contributor + Application Developer の実テストで登録・scope・要求設定・Principal grant・既存 grant 再利用が成功し、検証アプリの削除も確認した。新規本人同意・サインイン・認証 CRUD は利用者報告で受け入れ済み。#16 は Owner の前提説明・開始前確認・Owner baseline の実検証へ更新する。#15/#17–#23 はそれぞれの品質・配備・運用・復旧・Cloud Shell・診断・quota・文書条件を Owner baseline 上で判断する。

Owner の採用で全 Issue を自動完了にはしない。Cloud Shell 全ページの連続完走、再接続、復旧後データ保持、cleanup 等の未検証事項は残す。過去の Contributor 拒否と Owner の正例はそのまま保存する。以下の dated records にある「Contributor-only を維持」「Owner 成功は本線の証拠ではない」は旧方針の履歴であり、この現行方針を上書きしない。

### 2026-10-13 までの方針・検証履歴

**2026-10-13 22:34 の CI 方針変更:** ユーザーの指示により、脆弱性の検出だけで PR を NG にする監査 gate は廃止する。依存関係と SWA CLI の監査は `npm audit --audit-level=none` による情報レポートとして保持し、検出件数や重大度はビルド成否に含めない。ビルド、型検査、lint、テスト、成果物検証、公開 package source / integrity、実行・通信エラーの検出は維持する。残っている Actions NG の PR はこの方針で再実行し、監査以外の失敗を区別して記録する。以下の「監査が赤いため採用保留」という記述は変更前の履歴であり、この CI gate は現在の方針ではない。脆弱性自体が修正された、#15 が解決した、無条件に全 PR を採用する、という意味ではない。

本人認証の追加結果: 22:30 に利用者からサインインと案内した認証 CRUD が問題なく完了したとの報告を受け、実環境の機能受け入れ結果として記録した。新規同意画面の表示と既存 grant の利用は区別できていないため、初回自己同意の証拠は断定しない。Contributor-only の fresh deployment と Cloud Shell 全手順の連続完走は別の未達条件である。

状態: **①は A（Contributor のみ・管理者支援なし）を維持、②は B（ARM ZIP 経路の実装）で進めると決定済み**。2026-10-13 に merge 戦略の実行と Owner アカウントによる指定 Azure 環境の検証が承認された。新規 artifact host の費用、tenant policy、branch settings、Issue closure は別承認。

**2026-10-13 の追加承認と最新の実測:** ユーザーは残存脆弱性を認識したうえで SWA CLI による機能検証の継続を承認した。CLI 2.0.10 で既存の検証用 SWA への実配備が成功し、公開 HTML の一致、直接 / SWA 経由の API 正常応答、未認証の書き込み拒否、デスクトップ / モバイル表示、MSAL の認証開始を確認した。承認された実 URL の SPA リダイレクト URI 追加も、既存 URI を保持して実施・読み戻し済み。CLI 依存関係の High 5 件・Low 1 件は残り、この承認は監査 gate の免除や #15 の解決ではない。ARM 候補は代替として保持する。

B1 クオータは引き上げ後に上限100を確認し、Owner で baseline インフラ、バックエンド、Key Vault reference、telemetry、再起動後の health を実測済み。以下の quota0 / フロントエンド未配備の記録は過去の状態である。**本人のサインイン・同意・認証 CRUD、Contributor-only の fresh deployment、全 Cloud Shell 手順の連続完走は未確認**。①A は変更せず、赤い #51 を採用しない。受講者ページと配備スクリプトには、実 URL の SPA 登録、既存 URI の保持、token 非表示、正しい作業ディレクトリ、終了コードに依存しない公開後確認を反映する。

### 2026-10-13 までの解決方針（現行の Owner 方針で更新済み）

実行状況は [第 27 節](#merge-execution-evidence) を参照する。#24（計画）、#50（アプリ）、#52（ポータル入口の注意書き）は main へ採用済み。運用/ARM の #51 は draft / 未マージ。実環境では Owner の role preflight、catalog、Entra policy の読み取りが成功した一方、App Service 自身も B1 上限0を報告した。Quota の解消前にリソースを作成せず、別 SKU / region へ自動 fallback しない。赤い tool gate と Contributor-only の未達条件を通過扱いにしない。

2026-10-11 の再確認では全 23 Issues のうち #1–#12 は closed、#13–#23 の 11 件は open、#24–#48 の 25 PRs は未マージ。2026-10-12 に #49 の ARM frontend candidate を追加した。main への自動採用は行わず、修正候補の成功を受講者が使う main の改善や Issue 解決と混同しない。

**今後は追加の局所修正を積み続けるのでなく、採用単位の整理 → main 向け review / CI → 承認された merge → 共通 Azure rehearsal → Issue 単位の受け入れ → release の順で進める。** 最新の merge 方針は [第 26 節](#pr-merge-strategy) を参照する。第 24 節の権限担当者 handoff は採用しない。承認済みの権限・tool 選択と実装は [第 25 節](#arm-implementation-decision)、第 1–24 節は従来の提案・証拠として保持する。

現在の選択は **restricted privilege handoff / 追加 RBAC を導入しない**ことと、**documented ARM ZIP deployment を実装・検証する**こと。許可済み owned HTTPS host を利用する前提で準備・送信を分離し、host が未確定なら送信を止める。strict Contributor-only / 講師準備・関与なし / fresh MI + Key Vault RBAC をすべて維持したまま全 Issue を解決できる、とは約束しない。

最新の到達点: #41 の public application provenance / audit / production ZIP、#46 の実 MongoDB persistence、#47 の署名付き API token、#48 の runtime API/config に続き、#49 で ARM ZIP upload / trusted bounded LRO / exact HTML と public readiness を実装した。**Legacy SWA CLI audit と Contributor/Entra/hosted artifact/live Azure の完成条件は未達**。実装した経路と実 cloud acceptance は区別する。

2026-10-12 の merge 再調査では **26 PRs が open、#25–#49 の全 head は #49 の履歴に含まれる**。推奨は #24 の計画文書を先に審査し、main 向けのアプリ改善と運用/ARM 統合を別の採用単位にすること。現在の赤い統合候補をそのまま merge せず、旧 mirror / CI の途中 PR も順番に merge しない。この文書は merge / close / required-check 設定変更の承認ではない。

対象: [Azure-PaaS-Workshop](https://github.com/hironariy/Azure-PaaS-Workshop) の Issue #13–#23

本計画は、姉妹 IaaS リポジトリの改善内容と PaaS の現行実装を比較した結果に基づく。**既存の #13・#14・#15 を最優先の解決対象に含め、#16–#23 と一体のリリース計画として扱う。** 文書の作成や Issue の登録は、各不具合の解決・Azure 上の動作確認を意味しない。

## 1. 改善の目的と対象範囲を固定する

最初の目標は機能追加ではなく、受講者が既存のワークショップを確実に完了できる状態にすること。

- Cloud Shell Bash で Day 0 → Day 1 → Day 2 → Cleanup を連続して実行できる。
- サブスクリプション Owner と Entra Application Developer を開始前に確認し、Azure / Entra / policy / quota の制約を区別する。
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

### Owner 本線の前提と Contributor の対象外範囲

Contributor は `Microsoft.Authorization/roleAssignments/write` を持たない。現行 Bicep が App Service の Managed Identity に Key Vault Secrets User を割り当てる操作は、Contributor のみ・事前準備なしでは実行できない。また、Contributor は Entra のアプリ登録作成・ユーザー同意権限を意味しない。

そのため本線はサブスクリプション Owner を前提とし、受講者本人が必要な vault-scoped role assignment を作成する。Contributor-only の完走は受け入れ条件から外す。RBAC を無効にする、access policy へ置き換える、秘密値を公開する、必要な割り当てを省略して成功とする、受講者を自動昇格する、といった回避策は採用しない。正確な preflight・明示的な失敗・権限別の検証結果は維持する。

Owner による実検証は今後の本線の証拠として採用するが、実際に確認した対象・操作・結果だけを記録し、過去の限定的な正例を全 Cloud Shell 手順の完走へ読み替えない。自己同意は本人専用アプリと Application Developer のガード付き Principal CLI 経路とし、適用ポリシー・Graph 認可の拒否は明示する。

この安定化計画では、新たな Container Apps / Functions / database の導入、VM / SSH / Bastion / ASR の導入、大規模な framework 移行、姉妹リポジトリとの共通パッケージ化は行わない。依存関係の修正で必要となる互換性対応は #15 の範囲で判断する。

## 2. 現状と未検証事項を区別する

初回調査時（2026-10-09）は #13–#23 がすべて open、open PR はなかった。以降の PR / 検証記録は第 12 節以降に記載する。調査基準の PaaS main は `005cc191d970b7ee3374ad73452270ebacb98eef`。着手時には最新の状態と差分を再確認する。

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
| [#16](https://github.com/hironariy/Azure-PaaS-Workshop/issues/16) | High | サブスクリプション Owner の前提説明・preflight・Key Vault RBAC | Owner baseline の実効権限・MI 割り当て・起動・CRUD と既存割り当て維持を確認 |
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
- 本線は本人専用の owned app と Application Developer による CLI の自己同意とする。`--consent-type Principal` とサインイン中の本人の `--principal-id` を明示し、無条件 AllPrincipals grant は受講者手順から外す。
- 対象 tenant、Frontend / Backend client ID、service principal object ID、scope、実行担当を確認してから同意を付与する。
- Entra 管理者支援は明示的な例外に限定する。Azure Owner を Entra 同意の成功証拠として扱わず、受講者全員への Global Administrator / Application Administrator 付与を標準にしない。
- 自己同意経路は tenant policy と CLI の Graph 認可・既存 grant 置換挙動を確認して設計する。本人の完全な既存 grant は再利用し、同じ client/resource の競合 grant は変更せず停止する。共有・並行利用はしない。
- Azure resource の Owner / Contributor と Entra の同意権限を混同しない。Azure RBAC 側は #16 と合わせて説明する。

### 検証と完了条件

- [x] 隔離した検証用アプリで Application Developer の登録・設定・Principal 同意を確認する（2026-10-14 実 CLI 成功）。
- [ ] 必要ロール不足の失敗と PIM / tenant 違いを区別し、依頼する値と対処を説明する。
- [x] Grant の client/resource、scope、consentType、principalId を確認する（2026-10-14 実 grant 照合）。
- [x] Frontend の sign-in と Backend への認証付き API 呼び出しまで成立する（新規本人同意・認証 CRUD の利用者報告）。
- [x] 既存本人 grant を再利用し、競合時は停止する（実再実行で grant 不変、他ユーザー等の競合は isolated regression）。

### 2026-10-14 の本人同意報告と Day 0 方針更新

利用者が「新しく本人同意が成立しました」と明示したため、2026-10-13 のサインイン・認証 CRUD 成功報告を、既存同意の再利用と未分離のまま扱っていた判定を訂正する。**新規本人同意・本人ログイン・認証 CRUD は利用者報告による受け入れ結果**であり、エージェントによる token 検査・grant object の直接観測・Application Developer 単独での CLI 完走を意味しない。

Day 0 の本人専用 Principal CLI 経路、tenant/本人/所有権確認、既存 grant 保護、grant の全項目確認は #58 で main に採用済み。README、事前準備、旧 setup guide、講師ガイド、トラブルシューティング、Day 1 の同意画面の期待値も同期した。その後の限定ロールの実 CLI 検証も成功し、#16 の Azure RBAC 条件とは区別する。

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
4. 別の実施者によるサブスクリプション Owner + Entra Application Developer の独立 rehearsal。

Azure grant、Managed Identity / Key Vault references、SWA Linked Backend、regional capacity はローカル mock だけでは実証できない。明示的なスキップや baseline failure は記録し、成功へ置き換えない。テスト不在を無条件の `passWithNoTests` で完了としない。

## 10. リリースの完成条件を決める

### Milestone A: 受講者 pilot に進める

- [ ] #13 の Principal 本人同意と #16 のサブスクリプション Owner 前提が教材・実検証で整合し、必要な条件を満たせない場合は pilot-ready としない。
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

## 13. 第 2 段階の実装結果と次の判定

| 対象 | PR / base | 実装・証拠 | 未完了 |
|---|---|---|---|
| #20 Cloud Shell state | #31 / #29 の branch | version 1 JSON、atomic rename / lock、対象変更拒否、context 検証、グループ / clone / パラメータパス統一、Entra 再利用・所有者確認・既存 redirect 保持 | 実 Cloud Shell / Azure Files / Entra 再接続・グループ別リハーサル |
| #18 明示的な失敗・秘密値・cleanup | #32 / #31 の branch | explicit subscription/resource、`npm ci`、所有する一時 ZIP のみ削除、bounded healthy JSON、token 非表示・環境渡し、password 非表示・再実行保持、所有対象の削除待機 / 空一覧確認 | 実 App Service / SWA / Entra delete、DB 起動、release 完了の証拠 |
| #19 native script CI | #33 / #32 の branch | Ubuntu 24.04 / Node.js 24、Bash/CJS syntax、22 isolated regression tests。Actions run `37942050776` が **success** | アプリの公開 package source / audit / build CI は #30 でブロックのまま |

PR は積み重ねであり、自動 merge・Issue close はしていない。#31/#32 の Azure/npm/SWA/curl テストは隔離した stub を使用し、実クラウドに書き込まない。`scripts-quality.yml` には Azure credentials・本物の token・アプリ package install を与えない。script CI 成功は app CI や workshop-ready の代用ではない。

### 失敗を成功へ読み替えない実装

- RG・Entra・token の lookup error は不存在と扱わない。optional GitHub setup の role assignment / secret 設定失敗は停止し、既存 federation は subject / issuer / audience を照合する。
- health は最大 30 回、各要求最大 10 秒（接続最大 5 秒）、失敗間隔 15 秒。最後に余分な待機をせず、実経過時間を表示する。HTTP 200 の HTML、unhealthy JSON、通信失敗では成功しない。
- upload acceptance / readiness / release 完了を区別する。古いインスタンスの healthy は新しいコードの配信証拠ではなく、#21/#17 の追加検証が必要。
- cleanup は saved subscription / dedicated tag / current app owner / 完全な対象入力を確認し、RG 削除待機と正常な空 app 一覧まで確認する。タグだけで所有を証明したとはしない。timeout 時は app と state を保持する。
- checkout や state ディレクトリ全体は再帰削除しない。Azure 削除確認後に、明示したパラメータと JSON の 2 ファイルだけを任意で削除する。

### 再確認したブロックと残りの順序

公開 npm の再確認でも Axios latest は 1.18.1、compression metadata は transport error となった。別の取得方法でも compression の transport が失敗した。候補 mirror の version を公開済みと扱わず、#15/#30 の gate を緩めない。

次は #22 の provider / region / SKU / quota と #21 の secret-safe diagnostics を実装し、#23 の現行 baseline / optional material / 費用説明を同期する。#17 は baseline restart / 再 deploy / data integrity / rollback の測定仕様を先に整える。実 consent / DB / browser / recovery は、必要な権限・公開依存・ツールの根拠が揃うまで未検証として保持する。Contributor-only 制約を解消したことにせず、管理者や主催者の事前準備へ置き換えない。

### #22 catalog / quota / progress の実装後

#34（base: #33 の branch）で read-only PaaS catalog checker、registration error / bounded wait、quota・tier・physical capacity の区別、deployment progress の安全な表示を公開した。承認済み環境で **18 catalog checks が通過**し、実際の native CI `37944250145` も **26 tests / success**。installed CLI の `account list-locations` は subscription selector が無かったため、context を勝手に変更せず、明示した subscription の locations API を使って再実行した。

出力は catalog 成功時も **`deploymentReady: false`**。subscription quota、物理容量、M25 の eligibility、SWA Standard / Linked Backend eligibility、RBAC / deny / Policy、tenant consent、実 parameter / deployment validation は未確認であり、自動で region / SKU / HA を変えない。M25 は Dev/Test で HA 不可、M30 以上から M25 への downgrade 不可という制約も教材へ追加した。

catalog 成功後に現在の caller の permission を再確認したが、専用 RG はまだ未作成で、必要な roleAssignments/write は許可として報告されなかった。リソース・app registration・provider 登録・quota increase は実行していない。この caller 結果を isolated Contributor-only principal の試験とは扱わない。

#33 の optional setup test は public-cloud fixture と failure-path 到達 assert を強化し、更新後の run `37942734034` も success。次の実装は #21 の public response contract / secret-safe startup・KV・DB・telemetry diagnostics と #23/#17 の文書・測定仕様である。catalog や native CI の成功で残る Azure / dependency blocker を解決済みにしない。

### #21 の公開経路検証を配布する

#35（base: #34 の branch）で、saved context / scoped target lookup、直接・SWA health / published pagination / Frontend runtime config の 5 contracts、timeout / payload 上限 / 本文非表示、browser CRUD と secret-safe diagnostics を公開した。native **31 tests** と Pages build が成功し、実 Actions run `37947506964` も success。記事詳細 GET は view count を更新するため自動 probe に含めない。

成功出力は **`workshopReady: false`**。実 resource がないため HTTP は injected fixture であり、MSAL / consent / DB / telemetry / release / recovery は未検証である。#21 は閉じない。

## 14. #23 の gap analysis と同期先を決める

広い文書改訂の前に、現行実装と以下の差分を確認した。削除で片付けず、現行の normative reference と過去の設計案を分離する。

| 確認した差分 | 改善する surface | 同期後の基準 |
|---|---|---|
| main / production parameter の SWA Free と実際の Linked Backend が矛盾 | main.bicep、配布 parameters、main.json | orchestrator は Standard を必須とする。standalone module の Free 利用は linked backend なしに限定 |
| keyvault module を resource 作成と role assignment のため 2 回実行 | Key Vault / RBAC module、compiled ARM、native regression | vault / endpoint / DNS group の writer は 1 module。既存 vault へ同じ deterministic assignment ID / Secrets User を付与 |
| design rules が App Gateway / private App Service / GitHub Actions を必須としている | RepositoryWideDesignRules、Bicep README | Cloud Shell / ZIP / SWA Standard、public authenticated App Service、private data dependencies を normative にする |
| architecture / database / comparison に Free / M30 HA / 2 DB VM の旧前提が残る | component design、comparison、README、講師・reference | B1 / M25 / HA=false と optional paid resilience を分離。IaaS は現行 README の 3 data-bearing members、比較 revision を記録 |
| 既存 raster 図の内容をまだ確認していない | assets の実画像と元データ | 内容を確認してから表示を更新。未確認の画像を古いと断定しない |
| 月額固定価格が SKU / region / telemetry / NAT / storage / 税を反映しない | README、cost tables、baseline reference | 見積時点・地域・通貨・稼働時間を示す。SWA Standard、NAT / public IP / private endpoints / storage / logs を漏らさない |
| 過去の guide / FastPath と現行手順が混在 | learner / reference / development 入口 | 日本語 learner を実行本線、英語 README は対応する入口へ。過去資料は歴史・任意であり copy-and-run 本線ではないと明示 |

実装順は **IaC ownership / SKU → normative baseline reference / diagram → component・comparison・cost → 教材リンク / build**。main.json は Bicep **0.44.1** で再生成して parity を検証する。resource 名 / role GUID / secret reference / private DNS / public API routing は維持し、権限不足を回避する変更はしない。

#17 はこれと並行して、B1 で可能な restart / 既知 revision の rebuild・redeploy と content integrity の計測手順を配布する。slots / HA / backup restore / multi-region は追加承認・対応 SKU・実証が揃わなければ実行済みとしない。依存・権限・consent の block は文書同期や template build の成功では解消しない。

## 15. #23 / #17 のローカル実装と実証待ちを記録する

| 対象 | 成果物 | 確認した結果 | 未確認 |
|---|---|---|---|
| #23 第 1 slice | #36 / base #35 branch | SWA Standard 必須、B1/M25/HA=false、新規 default と既存 M30 の区別、Key Vault single writer / role-only module、既存 role GUID/RBAC 維持、main.json parity（0.44.1）、4 parameter templates、33 native tests。実 CI `37948591435` success | 実 redeploy / role idempotence / effective DB network isolation、全 component / comparison / reference / instructor の個別同期 |
| #17 baseline | #37 / base #36 branch | read-only recovery observer、2 経路の stable healthy、初期 healthy で観測終了しない、未観測 downtime は null、429 区別、UTC / monotonic、restart / redeploy / known revision rebuild rollback / content integrity の具体手順。38 native tests、実 CI `37949511461` success | 実 restart / release / rollback / DB persistence / browser CRUD / telemetry |
| #21 Day 2 同期 | #37 内 | exact subscription、real hostname helper、connection value / raw logs ZIP 表示の除去、exception aggregate、0 件は成功でない説明 | 実 SDK / reference status / sanitized incident の診断 |

両 slice は Pages build と changed Bash / relative links を確認した。stdout と outfile の末尾 newline の差を ARM 差分と取り違えず、同じ compiler の **outfile 同士**で配布 artifact の exact parity を検証した。既存の unused environment warnings は残している。

### 互換性と歴史資料を扱う

- role assignment は同じ vault scope / MI principal / Secrets User role / deterministic GUID を使い、resource 名・secret reference を変えない。resource writer の分離だけで Contributor-only の不足権限を解消したとはしない。
- 以前の implicit M30 deployment は actual tier を明示して保持する。fresh baseline の M25 default を既存 cluster の downgrade として使わない。
- Bicep README の App Gateway / certificate / Free / callback / token 表示 / F1 回避策を現行本線へ同期。両 README の価格は未検証 fixed total ではなく、実 region / quote date / currency / storage / NAT / public IP / telemetry を含む見積へ変更した。
- 現行 raster 図を確認し、既存 B1 / Dev-Test の非 HA 警告を保持した。3 zone backdrop を有効な冗長性の保証とは解釈しない。
- IaaS 比較は sister README revision `5aa79ac5969e551f08295ad660f6b1ec6856eda6` の **3 data-bearing members / no arbiter** を基準とする。旧 2 DB VM / Free / HA / gateway 設計は normative でない境界を設け、内容を削除して解決扱いにはしない。
- pinned mongoClusters `2024-02-15-preview` schema には publicNetworkAccess property が無い。private endpoint 作成だけで effective isolation が検証済みとは言わず、実 firewall / DNS / route の確認を残す。無承認の API migration や public DB 回避策を追加しない。

### 残る完成条件

公開依存 provenance / SWA CLI audit と app CI、必須 RBAC、実ユーザー consent がブロックのまま、Azure resource は作成していない。#17 observer は probe のみで restart を自動実行せず、paid HA / secondary region / DB destructive injection も実行していない。#23 の歴史資料区分は個別同期の代替ではない。これらの local PR / CI の成功を全 Issue 解決・workshop-ready・Contributor-only rehearsal 成功へ読み替えない。

次の作業は #23 の残る component / comparison / reference / instructor synchronization と、ブロック解消後の実 Cloud Shell → Entra → PaaS deploy → CRUD / telemetry → recovery → owned cleanup である。PR は #24〜#37 を公開したが、自動 merge / Issue close はしていない。#27/#30 は public-source / audit の制約を保持した draft である。

### #23 component / comparison / instructor / reference の追加同期

#38（base: #37 branch）で、比較表・DB/Frontend/Backend component・講師ガイド・quick reference を追加同期した。3 data-bearing member の比較基準、B1/M25/HA=false、SWA Standard、Cloud Shell deployment と runtime config、Actions optional、tier-dependent slots/scaling/HA、Entra は WAF/firewall 代替でない責任分界を反映。DB の未実証 concurrent-user count、M30 HA-enabled、M30+→M25 を cost reduction とする説明、Free-SWA/fixed savings の比較を除いた。

講師の organizer-prepared registration と固定所要時間を本線成功の代替としない。quick reference は actual hostname / deployed JSON / exact subscription / bounded public contracts / absolute script paths / secret-safe logs を使う。changed Bash / added links / Pages build を確認した documentation-only slice で、#37 の actual native CI と live Azure acceptance を混同しない。

旧 architecture / migration / validation と長い reference の詳細 proposals は保持しており、全例を executable に刷新したとは言わない。#23 の残りはその個別 modernization と live idempotence / network 検証。PR は #38 まで公開したが、merge / Issue close はしていない。

## 16. 運用 reference と公開依存の検証経路を進める

#40（base: #38 branch）で JA/EN の Bicep / monitoring / BCDR reference を同期した。single-writer / role-only、SWA Standard、B1/M25/HA=false、scoped JSON state / parameter / compiled ARM、actual public contracts、aggregate telemetry を反映。secret value / constructed hostname / unexplained placeholder commands を除き、secondary / restore / fixed RPO-RTO を未承認の baseline 成功条件にしない。six pages の Bash / added links / Pages を確認した。

### 公開依存に関する新しい証拠を過去の仮説から分離する

この環境の public npm lookup は引き続き Axios latest 1.18.1 と compression transport failure を返したが、**official GitHub の Axios v1.20.0（2026-08-24 published）と compression v1.8.2 tag は存在**した。したがって、この環境の E404 / stale metadata だけで upstream release 不在と一般化しない。過去の draft 判断はその時点の証拠であり、mirror tarball の正当性を無検証で追認するものでもない。

#39（base: draft #30 branch）で、credential-free Ubuntu/Node 24 runner が candidate manifest から explicit public npm の clean lock を生成する evidence job を追加した。既存 mirror lock は読まず、lifecycle scripts は実行せず、全 tarball の URL / credentials / sha512 を検査し、成功後だけ artifact を保存する。app source guard は維持する。

初回 actual run `37951156347` は **backend public lock 成功（358 packages）**。frontend は public resolution / audit 0 を報告したが、verifier が oxide WASM 内の bundled dependency を拒否して停止した。npm の `inBundle` entry は独立 tarball でなく parent tarball に含まれるため、shared guard に **verified public parent を必須**とする追跡と regression tests を追加した。unbundled missing source / missing parent / mirror / credential URL / malformed integrity を拒否する。これは provenance guard の除去ではない。

候補 source は自動で URL 書換・version/integrity 再利用しない。外部生成 artifact の source/manifest/version/integrity を確認してから follow-up へ取り込み、clean install / type/lint/test/build / installed/production/lock/ZIP audits を実行する。generation success や audit-only は installed app / Azure deploy / SWA CLI 完成の代替ではない。新しい証拠による public blocker の再評価は進行中で、tenant/RBAC と real consent/DB/telemetry/recovery gate は維持する。

## 17. 公開 application と統合検証の実結果を反映する

以下は初回の仮説を更新する最新の証拠である。第 12–16 節の失敗は当時の記録として保持し、現在も application source が未検証だという意味では使わない。

| 対象 | PR / actual evidence | 現在の判定 |
|---|---|---|
| Public lock generation | #39 / run `37951887919` | backend/frontend の clean public generation・guard・regressions と Bicep 成功。backend 358 public tarballs、frontend 266 public tarballs + verified parent 内の 6 bundled entries |
| Public application acceptance | #41 / run `37952822043` | exact generated locks を取り込み、public clean install・type/lint・各 8 tests・build、installed/production/lockfile audit=0。backend extracted production ZIP の integrity / production audit=0 / compiled sanitizer/app loading / DB 未接続時の両 health=503 を確認。全 5 jobs 成功 |
| Deployment tooling | #42 / run `37954852679` | `@azure/static-web-apps-cli@2.0.10` の 374 public tarballs / clean install / 実 CLI version は成功。zero-advisory audit は **high 5 / low 1、計 6 package-level findings** で失敗 |
| Historical design boundaries | #43 | MaterialsValidationStrategy、IaaS-to-PaaS-Migration-Changes、LocalDevelopmentEnvironmentDesign に現行 contract / acceptance gates を設け、旧例を非実行・参考用途として保持。JA/EN 比較の案内も同期。Pages / added links 成功 |
| Combined operational source | Draft #44 / native run `37954999882` | 全 **41 native tests** 成功。local Bicep 0.44.1 exact ARM parity、4 actual parameter templates、Pages build 成功 |
| Combined app / workflow / IaC | #44 / quality run `37954999868` | public evidence 2 jobs、application 2 jobs、Bicep parity、GitHub workflow expression validation の 6 jobs 成功。**SWA tooling job だけ audit 6 件で失敗し、overall run は failure** |

combined actual runs の source は `15884ea0770edafe61996308b48285f096f4d42e`。run は reviewed candidate stack の根拠であり、unmerged main / live Azure / workshop-ready の証明ではない。

### Public provenance を実 install まで追跡する

- #39 の生成 artifact と候補 manifest は deepEqual。source merge revision は `58cd42b4666e2917bd0f4c8f0c6820f17faf795c`。#41 は exact npm-generated lock を取り込み、mirror URL だけを書き換えたり未知の integrity を再利用したりしていない。
- public guard は HTTPS npm origin、credential 不在、SHA512、safe package path を確認し、独立 provenance のない entry は verified enclosing tarball の `inBundle` だけ認める。
- #41 の install / audit / ZIP smoke は生成成功とは別の actual checks。DB 未接続の 503 は正しい否定結果であり、DB acceptance と読み替えない。
- #27/#30 は旧 mirror lock を含む単独 PR として portable ではない。review は #39/#41 を含む stack で行い、古い draft を自動 ready / merge にしない。

### 統合で見つかった競合を意味的に解決する

application stack と operational stack は別々に green の部分があっても、そのまま組み合わせられるとは仮定しなかった。#44 の統合では backend/frontend deploy scripts と Day 1 の 3 pages、計 5 files に conflict があった。

新しい JSON state/context・scoped target・owned one-run package・cleanup・token 完全非表示を維持し、古い env execution / `[0]` target selection / token suffix / shared artifact deletion は復活させない。build は explicit public `npm ci --include=dev`、production package は `--omit=dev` を使う。`NODE_ENV=production` でも build tools を復元する native regressions と actual app CI install を追加した。Unicode / draft ownership / public contracts / runtime config も保持する。

#44 は issue-focused slices の review 後に使う **draft integration evidence**。GitHub の元 PR を自動 merge / close したものではない。複数 stack の review/merge 順序は reviewer が判断し、競合解決なしの順次 merge を正常な release とみなさない。

### Tooling の失敗を正しく分類する

#42 初回の job-level runner context は workflow scheduling 前に失敗し、次の誤った `@microsoft` package name は public npm E404 となった。両方を修正し、upstream v2.0.10 manifest の正式名 **`@azure/static-web-apps-cli`** を確認した。誤名 E404 を public release 不在の根拠にしない。checksum-pinned actionlint を追加し、GitHub expression context を恒久 CI で検査する。

正しい package の actual audit は CLI / adm-zip / devcert / selfsigned / node-forge / tmp の tree に 6 package-level findings を報告した。これは unique CVE 数・実 exploitability の判定ではない。audit の fixAvailable は CLI **1.1.3 への semver-major downgrade** を提示するが採用しない。force fix、severity suppression、continue-on-error、非互換 override、tooling の黙示的な対象外扱いで zero 条件を変更しない。

## 18. 残る完成条件と次の判断を明示する

| 残る gate | 必要な次の根拠 / 方針 | 現時点で行わないこと |
|---|---|---|
| #15 tooling zero-advisory | supported upstream release で clean public install / CLI behavior / audit=0 を実証する、または別途合意した supported deployment route を検証する | 古い CLI への force downgrade、非互換 override、application green で tooling 完了扱い |
| #16 strict Contributor-only | `roleAssignments/write` が必要な fresh MI/Key Vault RBAC deployment と Contributor 権限の非両立を解消する、明示的な architecture/permission 方針の意思決定 | organizer preparation、受講者自動昇格、RBAC/access-policy 置換、必要 role assignment の省略 |
| #13 real identity | policy が許可する owned registration / browser self-consent / Principal grant / token/API の実証 | tenant-wide policy / AllPrincipals grant / 共有 grant の削除 |
| #22 live platform | exact subscription の quota / capacity / tier eligibility / parameter validation と progress 成功 | unsupported quota lookup を 0 に変換、自動 region/SKU 変更 |
| #14 / #18 / #20 / #21 live learner path | Fresh Cloud Shell と途中再接続、release completion、Unicode CRUD/drafts/既存 URL、private DB/KV effective path、telemetry と owned cleanup | mock / healthy public response / private endpoint 存在だけを完了証拠にする |
| #17 / #23 live operations | measured restart/redeploy/known-revision rebuild、stable dual-path health と content integrity、IaC redeploy/idempotence、actual baseline に一致する説明 | paid HA/secondary-region/DB destructive exercise の無承認実行、未観測 downtime=0 |

最後に実行した read-only permission / RG 検査では、必要な `roleAssignments/write` は許可として報告されず、指定 RG は未作成だった。こちらから Azure resources / app registrations / provider registrations / quota increases / paid optional resilience は作成・実行していない。これまでの成果は local / credential-free CI の改善であり、Milestone A/B のチェックを完了にはしない。

Contributor-only / organizer preparation なし / MI と Key Vault RBAC の維持は、現行の fresh deployment では同時に満たせない platform constraint である。コードで権限を生み出す解決策はない。tooling にも supported zero-advisory release の外部条件が残る。この 2 つを意思決定・upstream remediation の gate として保持し、許可や条件の変更なしに Azure rehearsal を開始しない。

Review の入口は #24（saved strategy）、#41（public application evidence）、#42（tooling の正しい failure）、#43（historical proposal boundaries）、#44（combined source / conflict resolution）。自動 GitHub merge / issue close / branch protection 変更はせず、実 cloud と人間のブラウザー操作が必要な acceptance を勝手に承認しない。

## 19. 既存の任意 Actions 経路を安全な supported alternative に整える

「ブロックを報告して止まる」だけでなく、Microsoft Learn と upstream source を確認し、CLI を使わない supported interface を検討した。低レベル StaticSitesClient を直接起動する内部 interface の独自 wrapper は、公開・サポート契約が確認できないため採用しない。Microsoft の公式 `Azure/static-web-apps-deploy` と documented prebuilt configuration を使う **既存の任意経路**を #45 で修正した。Cloud Shell baseline や Contributor-only 条件は変更しない。

### 追加で見つかった gap と実装

| Gap | #45 の修正 |
|---|---|
| Frontend template の unsafe expression interpolation / sed、runtime writer の重複 | shared `configure-frontend.cjs` を Cloud Shell / Actions で使う。3 UUID、1 個だけの placeholder、公開 `/api` contract を検証。追加の token 環境値を artifact に含めない |
| profile の SWA CLI silly verbosity で token を表示し得る | CLI の debug / explicit verbose を log に固定し、token は当該 process の env にだけ渡す。inherited silly の regression を追加 |
| Backend template の secret fallback / install と OIDC credentials の混在 | build job は credentials/OIDC mint 権限なし。isolated production ZIP だけを別 deploy job に渡し、OIDC-only とする。旧 AZURE_CREDENTIALS は使用しない |
| ZIP / startup が Cloud Shell と不一致、constructed hostname、HTTP 200 のみの成功 | `dist/src/app.js` と production-only deps、explicit subscription/target、actual hostname、shared bounded healthy-JSON checker に統一 |
| public OIDC IDs を setup helper が Secrets に保存し、template は Variables を参照 | 3 IDs を public Variables に設定。GitHub failure は停止。target Variables は実 baseline の値を別途設定 |
| guide の無条件 role grant と token stdout、古い README fallback | frontend-only は新規 Entra identity/grant 不要と分離。backend OIDC は追加権限が必要な任意経路。saved context / owned repository / token stdin transfer / no overwrite を説明し、README entry と旧 fallback 説明を同期 |
| copied templates が active workflow lint の対象外 | actionlint / path filters に templates を含める。main-only、serial deployment、timeouts、immutable action SHA、missing config の明示的な failure を検査 |

Frontend の公式 action は prebuilt dist を扱い、SWA npm CLI はインストールしない。ただし、upstream Dockerfile は `mcr.microsoft.com/appsvc/staticappsclient:stable` を使う。**action commit の固定だけで native client の完全な immutable inventory / audit=0 を実証したことにはならない**。正式な deployment alternative を実装したことと、#15 の全 release 条件の変更・達成は別である。

### 追加の actual evidence と継続する停止条件

#45 source `65437f393899cbef741e3e3fe654836f1d96804a` の actual native run `37958746897` は **47 tests / success**。quality run `37958746932` は public evidence / application / Bicep / workflow-expression の 6 jobs が成功した。実 frontend build に共通 helper を適用して runtime/routing config shape を確認し、実 isolated outDir backend ZIP の compiled sanitizer/app loading と production audit=0 も成功した。**SWA CLI job は audit 6 件で失敗し、overall は failure** のまま。

README 同期と token-shaped input が public HTML に混入しない regression を追加した source `19270a756e4c42577119730ed22b186f902801d7` も、native run `37959558713` は **47 tests / success**、quality run `37959558766` は同じ 6 jobs 成功 / SWA CLI audit のみ failure だった。latest runner artifact の audit JSON は high 5 / low 1、計 6 package-level findings を確認した。全体 green や実 cloud release と読み替えない。

Changed learner Bash / links / Pages build、active/copied template actionlint、targeted regressions は成功。README は旧 OIDC samples を reference と明記して保持し、現在使わない client-secret 作成・JSON stdout の fallback 手順を除いた。旧 Secret を自動削除・移行はしない。

追加の authorized read-only permission check でも exit 3、required `roleAssignments/write` は許可として報告されず、対象 RG は未作成だった。新しい実 deploy / app registration / grant / tenant policy / provider / quota / paid resilience の操作は実行していない。isolated Contributor-only principal、real OIDC / upload / browser / DB / telemetry / recovery / cleanup の実証は残る。Frontend の任意経路ができても、存在しない baseline や不足権限を自動で生み出すものではない。

## 20. Mock の成功から独立した database HTTP contract を追加する

外部 gate を報告するだけでなく、#14 / #19 / #21 の repository 内で改善可能な検証 gap を調べた。従来の HTTP regression は query/create を mock しており、本物の persistence、unique index、所有者別 CRUD を証明しない。#46（base: #45）で **独立した credential-free database job** を追加した。別 test framework、production auth bypass、Cloud Shell の Docker 必須化は導入しない。

### Fixture と実証範囲

official MongoDB 8 image を multi-architecture digest に固定し、health readiness / random local port / memory bound を設定する。test preload は explicit numeric port を要求し、接続先を loopback と新しい `workshop-integration-<UUID>` DB に固定する。inherited cloud URI は使わず、missing / invalid port を接続前に拒否し、skip / success-shaped fallback はしない。2 native regressions でこの境界を確認する。

7 scenarios（Node summary は parent を含め **8 tests**）は本物の Express application / Mongoose / MongoDB を使う。identity middleware だけ fixture actors で置き換え、DB / model / health は mock しない。

- 日本語・中国語・韓国語・accented / mixed title の作成・URL encoding・詳細取得、日本語本文・要約・tags の保存／再取得。
- Draft を public / 別 author に公開せず、author の `/my` と詳細にだけ返す。
- 同名 Unicode title の同時作成が distinct URLs になることと、本物の unique index が duplicate slug を E11000 で拒否すること。
- exact public / private pagination shape、unauthenticated / 他 author / sanitized-empty edit の拒否と内容維持。
- Historical ASCII permalink の title/content edit で URL を変更しないこと。
- DB disconnect で両 health=503、reconnect で両 health=200、publish/content の persistence、author-only deletion と DB 上の absence。
- First-time profile の保存と emoji-only title の URL-safe fallback。

### テストで見つかった production contract の修正

未知の author を指定した public list の early return は `totalPages` を欠いていた。新しい integration は修正前に exact-shape assertion で失敗し、`totalPages: 0` の補完後に成功した。通常の DB-free suite にも page/limit を含めた regression を追加した。既存 slug / routing / owner semantics は変更しない。

Local backend type/lint/build、**9 DB-free tests / 8 integration tests / 49 native tests**、active/template actionlint は成功。developer guide の exact Docker recipe を実行し、readiness、dynamic port、test success、当該 container だけの owned teardown を確認した。使用した local fixtures は停止・自動削除済みで、既存 container / DB / global prune を操作していない。

| Actual public source | Evidence | 結果 |
|---|---|---|
| `b5b864c8d5dd9e8e197290e17c7acb5e91f18855` | quality `37961964564` / native `37961964393` | 新しい Database HTTP contracts を含む 7 jobs 成功。backend unit9 / database8 / native49 成功。CLI audit のみ failure |
| `1075d325652d0aaceb1d886aef6ab4b6b4804663` | quality `37962658482` / native `37962658457` | multilingual fields を含め、同じ 7 jobs / unit9 / database8 / native49 成功。CLI audit のみ failure、overall failure |

**MongoDB fixture actors は actual Entra/JWT/consent、Azure DocumentDB compatibility/TLS、Key Vault/private networking、SWA routing、browser、telemetry、live recovery の実証ではない。** Release gates を消さず、これらは第 18 節の停止条件として残す。公開 version を再確認しても official SWA CLI latest は v2.0.10。current official `az staticwebapp` command reference に content upload/deploy command はなく、未文書化 native interface を Cloud Shell の supported solution として追加しない。

## 21. 署名付き API token で audience と delegated permission を検証する

#47（base: #46）は #13 / #19 の authentication gap を扱う。従来の HTTP identity mock から独立して ephemeral RSA key / public JWK を作り、本物の JWT signature / issuer / audience / expiry 検証を通す。mock は JWKS key retrieval だけで、middleware / JWT verifier は置き換えない。新規 dependency、production bypass、再利用できる signing secret は導入しない。

回帰テストは、正しい Backend API GUID audience が拒否される問題と、必要な delegated permission がない token が受理される問題を再現した。

| Contract | 修正と維持する境界 |
|---|---|
| v1 resource token | 当該 tenant の v1 issuer と Backend GUID / resource URI audience を受け付ける |
| v2 resource token | 当該 tenant の v2 issuer と Backend GUID audience のみを受け付ける。scope URI と audience を混同しない |
| user permission | 非空の `oid` / `sub` と `scp` 中の exact `access_as_user` を要求する |
| rejection | invalid / ID / app-only / malformed token は 401、有効な user resource token の delegated permission 不足は 403 |
| optional authentication | invalid / insufficient token の anonymous fallback を維持し、private draft ownership は与えない |

source `1ff83418b1a7d55f2124c7cb31a902062a36e129` の actual native run `37965407765` は **49 tests / success**。quality run `37965407777` は **backend15 / database8** と application / public provenance / Bicep / workflow validation の 7 jobs が成功した。SWA CLI の audit artifact は **high5 / low1 / total6 package-level findings**、当該 job と overall は failure。local type/lint/build / Pages build も成功した。

これは locally signed contract と public clean-install CI の証拠であり、Microsoft-issued keys、real tenant registration / browser consent / MSAL interaction の証拠ではない。learner の Day 0 と developer testing guide に audience / scope / 401–403 の区別を反映し、第 18 節の real identity gate は残す。

## 22. Runtime API の接続先と失敗後の再試行を一致させる

#48（base: #47）は #13 / #19 / #21 の実行時設定を扱う。prepared artifact は `API_BASE_URL: "/api"` を注入していたが、Axios は stale build-time `VITE_API_BASE_URL` を使っていた。また production config は validation 前に cache へ代入され、最初の load が拒否されても次の呼出しで不正値を成功として返していた。追加した 6 regressions は修正前に失敗した。

- Request interceptor で loaded `AppConfig.apiBaseUrl` を取得する。module import 時の eager getter と build-time host の優先を除く。
- pathname の terminal `/api` だけを正規化し、same-origin `/api/posts`、localhost backend、gateway prefix、`https://api` hostname、Unicode permalink encoding を維持する。
- API root は HTTP(S) に限定し、credentials / query / fragment を token acquisition / transport 前に拒否する。エラーに URL 値を出さない。
- Inline / JSON / build-env の production candidate は検証後だけ cache に保存する。修正した inline / JSON source を再試行でき、既存 development warning / fallback は維持する。

Tests は real Axios interceptor / URL joining と real Backend scope builder を通す。MSAL response / transport だけ fixture とし、network access は不要。developer guide と Day 1 frontend に exact request destination / saved-state recovery / token を公開しない確認を追加した。

source `9e01ed0d06fca0f9b32bf973d1dbc39081be65fb` の local frontend type/lint/build / **14 tests**、Pages build は成功。actual native run `37966845009` は success、quality run `37966845313` は **frontend14 / backend15 / database8** を含む 7 jobs 成功。CLI audit は **high5 / low1 / total6** のみ失敗し、overall は failure。実ブラウザー、CORS、SWA Linked Backend routing、Azure upload、private data path の acceptance と読み替えない。

## 23. Documented ARM ZIP deployment を supported alternative の候補へ追加する

`az staticwebapp` に upload subcommand がないことは、supported REST operation がないことを意味しない。第 19–20 節の検討を補完し、Microsoft の [Create Zip Deployment For Static Site](https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/create-zip-deployment-for-static-site?view=rest-appservice-2025-05-01) を正式な候補に追加する。公式 Actions だけを唯一の supported alternative としない。

API version `2025-05-01` の `POST .../Microsoft.Web/staticSites/{name}/zipdeploy` は Azure OAuth の ARM interface であり、JSON の `properties.appZipUrl` に **remote ZIP URL** を渡す。未文書化 native client wrapper、inline ZIP / base64 body、SWA deployment token を必須とする operation ではない。ただし文書の存在だけで、Cloud Shell から local dist を直接送れることや actual acceptance を実証したことにはならない。

| 次の設計・検証 | 完成に必要な根拠 |
|---|---|
| Owned hosted artifact | approved owner / target、prepared runtime/routing ZIP、checksum、短い公開期限と owned cleanup。新規有料 Storage・共有 Cloud Shell storage・他者の artifact を無承認で利用しない |
| Authentication / redaction | explicit subscription/tenant、ARM permission、token/SAS を stdout・command trace・reflective error に出さない。GitHub や client secret を Cloud Shell の必須条件へ追加しない |
| Bounded completion | 200 / 202 を区別し、202 単独で成功扱いしない。Location / azure-asyncoperation の destination と subscription を検証し、Retry-After / timeout / terminal failure を扱う |
| Effective release | exact owned SWA への upload、frontend + `/api` readiness、runtime identity、Unicode CRUD、known-revision recovery、artifact expiry / deletion を実測する |
| Tooling decision | used tool inventory / public provenance / audit criteria を合意し、既存 CLI audit failure を削除・skip・suppression で隠さない |

本段階では ARM upload helper / hosted artifact / live trial は未実装・未実行。baseline を自動で変更せず、storage/cost/ownership と第 18 節の permission gate を解決してから end-to-end route を採用する。documented operation の発見を #15 完了や Contributor-only fresh deployment の解決とはしない。

<a id="all-issue-resolution"></a>

## 24. 全 Issue を閉じるための解決戦略を組み直す

### 24.1. 「全件 blocked」から、解決に必要な作業と判断を分ける

2026-10-11 に全 Issues の state と open 11 件の受け入れ条件、全 open PRs、remote main、#48 の実 checks、Microsoft の権限・同意・ZIP deployment 文書を再確認した。#48 final head `04405074b4cd384f0602e209358230d0c4e3e5e0` は application / database / public evidence / Bicep / workflow / native checks が成功し、SWA CLI audit だけ failure。第 21–22 節の件数はその実行時の証拠であり、今回すべての audit や Azure rehearsal を再実行したという意味ではない。official CLI latest release は再確認しても v2.0.10 だった。

従来の進め方には次の問題があった。

| 問題 | 新しい扱い |
|---|---|
| 局所修正の PR が増えても main に届かない | candidate を固定し、レビュー・採用の担当と統合順を決める。新たな全件修正の作り直しはしない |
| 9 つの作業が一律に blocked | repository 内の実装、権限/費用の承認、real acceptance、main への採用を別状態にする。承認不要の契約テスト・文書・証拠整理は進められる |
| Contributor の制約を繰り返し確認するだけ | 解決可能な権限経路を比較して明示的な判断を求める。不可能な条件をコードで回避しない |
| 脆弱な CLI の upstream release 待ちが唯一の出口に見える | ARM route の hosted-artifact / upload / completion を具体的な成果物として実証し、採用失敗時の戻り先も決める |
| 各 Issue が workshop 全体の完了を待つ | original acceptance checklist へ証拠を 1 対 1 で結び付ける。関係ない optional HA・native client・tenant policy は全 Issue の共通前提にしない |
| 計画が original Issue より厳しい条件を追加していた | #19 の required-check 設定方法と release 時の実 enforcement、#23 の文書整合と live platform 実証を区別する。条件の削除・書換えは maintainer の明示的な判断を残す |

#1–#12 は完成済み文書の履歴として closed を維持する。今回見つかった現行文書の regression は #13–#23 に対応付け、古い Issue を機械的に再 open しない。全 Issue 解決は「11 open 件の受け入れ条件を満たし、採用済み source の証拠を maintainer が承認すること」と定義する。

### 24.2. 権限を生み出すのでなく、必要な操作の担当を決める

**推奨提案: 受講者は Contributor のまま、fresh resource は受講者が作り、必要な時点だけ権限担当者へ handoff する。** 事前作成済みアプリ・vault・DB を配る方式ではない。ただし、講師/管理者の関与そのものは発生するため、従来の「講師準備・関与なし」と同じ条件ではない。承認されなければ採用しない。

| 経路 | 実現可能性・代償 | 判定 |
|---|---|---|
| A: strict Contributor のみ、支援なし、現行 security を維持 | MI の Key Vault role assignment を作れず、fresh deployment は完了不可。Entra consent も Azure Contributor では保証されない | 従来条件を維持する場合の正確な結果。全件完了ではなく、#13/#16 と依存する acceptance が未達 |
| B: 必要時だけの権限担当者 handoff | 受講者は Contributor を維持。group-owned app / vault / MI を対象に必要な grant を担当者が実施し、受講者が起動・CRUD を検証する | **全件解決へ進む推奨案、未承認**。運営の小さな実行責務は必要 |
| C: 条件付きの role assignment delegation | 対象 vault / role / exact MI principal と add/delete を制限した追加 RBAC を使う。最初の delegation 自体には権限担当者が必要 | 支援回数を減らす代替。Contributor「のみ」ではなく、追加権限と初期承認を明記する |
| D: Key Vault RBAC を外す、secret を env/文書に直書き、全員 Owner | 見かけ上 unblock できても security と学習目的を損なう | 採用しない |

B を採用する場合の実装は、既存 `keyvault-rbac.bicep` の責務分離を利用した **create → handoff → verify → deploy** の明示的な段階にする。main は現在この role assignment を無条件に呼ぶため、document だけでは Contributor deployment に変わらない。

| 段階 | 担当・成果物 | 次へ進む条件 |
|---|---|---|
| Azure / Entra prerequisites | 環境担当が tenant/subscription、provider、region/SKU、registration/consent policy と実効権限を確認 | learner と権限担当者の操作範囲・費用上限・実施時間が確定。不明な policy を許可とみなさない |
| Resource creation | learner が owned app registration を policy の許可範囲で作り、core infrastructure と MI を作成。必要な RBAC stage は未完として state に残す | exact RG / vault / MI ID を確認。stage が pending のまま healthy/deployment-ready と表示しない |
| Scoped Azure handoff | 権限担当者が exact vault 上で exact App Service MI へ Key Vault Secrets User を割り当てる | role / principal / scope を照合し、propagation と Key Vault reference resolution を実測する |
| Entra handoff（必要時だけ） | 自己同意が許可されない場合、Entra 担当者が owned Backend scope / Frontend app の同意を審査・実施 | Azure role と同意権限を混同せず、resource / scope / consentType / principalId を確認。共有 grant を削除・置換しない |
| Resume / replay | learner が save/load を経て backend/frontend deployment と CRUD を継続 | 再実行で既存 grant を変更しない。権限不足・handoff 未完・伝播待ちを区別する |

権限担当者へ渡す値は公開の resource / principal IDs と scope に限定し、secret、DB connection string、access token は渡さない。cleanup の resource 削除と owned Entra registration/grant の扱いも別にする。Core / RBAC stage は compiler parity、fresh/resume/redeploy、negative permission tests まで実装してから本線へ採用する。

Microsoft の [constrained delegation](https://learn.microsoft.com/en-us/azure/role-based-access-control/delegate-role-assignments-overview) は対象 role / principal と add/delete の制限を認めるが、最初の role assignment を無権限で作れる仕組みではない。Key Vault Data Access Administrator も追加権限であり、それだけを「Contributor-only の解決」としない。[User consent](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent) は app と permission policy に依存するため、owned custom API を作っただけで自己同意可能とは断定しない。Tenant-wide policy 変更は本計画でも行わない。

### 24.3. SWA tooling の出口を、実行可能な成果物にする

**推奨提案: Cloud Shell 本線で ARM ZIP route を実証し、合格すれば vulnerable npm SWA CLI を受講者の必須ツールから外す。** Backend App Service ZIP、SWA Standard / Linked Backend、runtime `/api`、MSAL は維持する。GitHub Actions を必須にしたり、ホスティング先を無関係なサービスへ変えたりしない。

先に approval 不要の local fixture で request / polling / redaction contracts を実装できる。実 upload は approved artifact hosting / cost / Azure target が決まってから行う。既存 baseline に artifact Storage module はなく、利用可能な専用 Storage が存在すると仮定しない。

| 成果物 | 実装・検証内容 |
|---|---|
| Prepared ZIP | shared runtime config writer / routing file を使い、秘密値不在、entry files、source SHA、checksum を検証。backend の ZIP と混同しない |
| Owned hosting | 利用許可済みの専用 HTTPS artifact host、または別途承認した disposable Blob Storage を選ぶ。新規 Storage の費用・network reachability・upload 権限・短い read-only URL 期限・cleanup を明記 |
| ARM transport | documented `properties.appZipUrl` を使う。explicit subscription/tenant/resource target、ARM OAuth、safe body handling を実装。URL query / token / raw reflective error をログへ出さない |
| Bounded LRO | 200 と 202、Location / azure-asyncoperation、Retry-After、timeout、Failed/Canceled、malformed/untrusted polling destination を fixture と実 platform で検証する |
| Release / rollback | terminal completion 後に UI + direct backend + SWA `/api` を検証。既知 revision の再 upload で復旧し、記事を保持し、owned archive を削除・失効する |
| Supply chain / audit | 使用する Node/npm/Azure CLI/helper/hosted artifact の version と provenance を記録。両 app の全依存・production・lockfile・backend ZIP の audit=0 を再確認し、new helper dependency があれば同じ gate へ追加する |

`appZipUrl` を service が取得できること、private artifact host の可否、実 completion / propagation は文書だけでは確定しない。試験が失敗したら runtime / auth / data architecture を変更して取り繕わず、contract mismatch と実 error の安全な分類を残す。戻り先は reviewed upstream CLI 修正版の実証、または inventory が確認できた公式 deployment route の別審査とする。期限のない force downgrade / fork 固定 / mutable native image を「安全な代替」として採用しない。

採用時は #15 の「SWA CLI 導入」条件を、**選択した supported Cloud Shell deployment tool と全使用 dependency の検証**へ明示的に更新する審査が必要。CLI audit 6 件が直ったとは記載しない。まず本線・導入手順・scripts・reference・CI を一緒に変更し、それから obsolete CLI の upstream audit を別の追跡へ移す。必須 path に残る CLI を使いながら required audit を削除すること、`continue-on-error` / severity threshold で隠すことは不可。

公式 Actions の native `stable` image は別の supply-chain 審査対象として保持する。ARM 本線の採用だけでその任意経路が検証済みになるわけではない。未実証の optional path は reference / unsupported-for-this-release と明記し、正式にサポートする経路へ昇格する場合は別途 acceptance を行う。

### 24.4. 全 11 open Issues の残作業・担当・閉じる証拠を固定する

担当は役割で示す。実際の実施者・日程・環境・予算が未確定の項目を、担当済み・承認済みとしない。Source / CI は #48 の候補があり、main には未採用という共通状態から始める。

| Issue | 既存候補・残作業 | 主担当 | 閉じるための証拠・依存 |
|---|---|---|---|
| #13 | #28/#47 の権限分離・signed token を採用。自己同意の実成否と、必要時の限定 admin handoff を検証 | Entra 担当 + app 担当 | R0/R2 で実 user sign-in、Backend scope、resource/consentType/principalId、401/403 と authenticated API を確認。原 Issue の admin 手順も検証し、B 方針は別途承認 |
| #14 | #26/#46/#48 の Unicode・persistence・routing を採用。Azure/browser で同じ入力を確認 | app 担当 | R2 で JA/ZH/KO draft/published 201、emoji/symbol fallback、同名/他 author、URL encoding、既存 URL、本文/要約/tags、edit/delete。DB fixture を Azure compatibility の代用にしない |
| #15 | #41 の public locks / production ZIP を採用。ARM route か supported CLI remediation を実証し、採用 route の導入・監査を更新 | app/tooling 担当 + maintainer | R1/R2 で public clean install、全 audit scopes=0、実 build/upload/routing/MSAL/CRUD。旧 CLI audit failure は履歴に保持し、条件変更は承認後だけ |
| #16 | #29/#36 の preflight/single writer を採用。core → RBAC handoff → verified resume を追加 | IaC 担当 + Azure 権限担当 | R0/R2/R3 で Contributor denial と必要時支援による起動/CRUD、exact role/scope/MI、再 deploy の不変性。A 維持なら本項は未達 |
| #17 | #37 の観測/recovery を採用。B1/M25/HA=false の baseline restart/redeploy/known-revision を実行 | operations 担当 | R3 で障害前後の記事・auth CRUD、UTC/monotonic duration、429/transport/5xx の分類、stable dual-path health。採用していない paid HA/DR の実行は前提にしない |
| #18 | #32/#45 の error/redaction/cleanup を採用。現物の failed deploy と owned cleanup を確認 | scripts/operations 担当 | R1 の fixture negatives と R2/R4 の実 success/failure/no-existence、非 0 exit、secret-safe output。共有・空・foreign target を拒否する |
| #19 | #25/#30/#33/#39–#42/#44/#46 の最終 CI を採用。現行 selected-tool gate と required-check 手順を整える | CI 担当 + maintainer | R1 の credential-free positive/intentional failure、public source/audit/API error、Bicep parity、Pages/learner contract。設定方法の文書を Issue 証拠とし、実 ruleset enforcement は release gate で別確認 |
| #20 | #31 の versioned JSON state を採用。新規・途中再接続・A 以外の group を実行 | learner-flow 担当 | R2/R3/R4 で tenant/subscription/RG/cwd/params の復元、wrong target 拒否、clone/using path、owned cleanup。他 group は別 state/owned RG を使う |
| #21 | #35/#46–#48 の healthy/API/config を採用。real logs/KV/DB/telemetry を実測 | app + operations 担当 | R2/R3 で direct と SWA path、startup、login/CRUD、private DNS/KV resolution/DB connectivity、telemetry delay と recovery 後 smoke。raw connection/token を記録しない |
| #22 | #34 の catalog/quota/progress を採用。実 subscription の quota/capacity と deployment を確認 | Azure 環境 + IaC 担当 | R0/R2 で region/SKU/quota/担当、Running/Failed/Succeeded、Succeeded 前の outputs 未保存、approved alternate parameter の費用/機能差。preflight を capacity 保証にしない |
| #23 | #36/#38/#40/#43/#45 の JA/EN baseline/optional を採用。選択した handoff/tool を図/費用/entry に同期 | docs 担当 | R1 の build/links/diagram/compiled ARM、R2 の実 baseline との照合、R5 の portal navigation。無条件 HA/production-ready 表現を外し、closed #1–#12 の有用内容を保持 |

Issue を閉じる前に original checklist の各項目へ、採用 commit、結果、safe evidence link、検証者、残る optional 制約を追記する。必要条件を満たしていない項目は unchecked のまま。local test のみで足りる項目にまで real tenant の待ち時間を増やさず、real environment が必要な項目は mock で閉じない。

### 24.5. 深い PR stack を、レビュー可能な release candidate に変える

#24–#48 を番号順に merge する計画は採用しない。独立 track の途中 PR、mirror candidate、後段で解消した conflict、candidate provenance を持つため、途中 source を一時的に main へ入れると失敗や旧契約が戻り得る。

推奨する統合手順は次のとおり。

1. `origin/main` と #48 final head を固定し、issue → acceptance → final files/commits の map を作る。#27/#30 の古い mirror source を final locks で置き換えたことを明記する。
2. 新しく **main 向けの統合 candidate PR** を、reviewed final source と今回承認された追加成果物から作る。既存 issue-focused PR/commit は traceability と review の材料として保持し、同じ修正を再実装しない。
3. App・IaC/security・scripts・docs の coherent commit groups で diff をレビューする。既存 PR の superseded / incorporated 関係は説明するが、自動 close / merge / rebase はしない。古い draft candidate を個別に先行 merge しない。
4. exact candidate SHA で clean CI と rehearsal を実行する。source を変更したら影響する checks / rehearsal を再実行し、以前の SHA の成功を新しい source の成功へ転用しない。
5. Maintainer が安全なまとまりの採用、必要な required checks、release revision、Issue closure を承認する。先に独立して採用可能な docs/test がある場合も、動かない中間 manifest/lockfile を main に入れない。

統合 PR を作ること自体は GitHub merge の承認ではない。現時点では既存 PRs を変更・閉鎖・merge していない。#24 は plan の更新入口として維持する。

### 24.6. 共通 rehearsal で複数 Issue の acceptance を一度に集める

Run ID、UTC、source SHA、公開 tool versions、実効 role/scope、選択 parameter、safe result summaries を同じ証拠系列へまとめる。HAR / token / secret / connection string / SAS / 他受講者情報は公開しない。Private environment IDs は session 内で保持し、公開教材の既定値へ流用しない。

| Run | 手順と measurable outcome | 対象 |
|---|---|---|
| R0: Readiness / negative permissions | learner の role と registration/consent を確認。権限不足、wrong tenant、unavailable SKU、quota 未確認を明確に止める。権限担当者・許可範囲・予算を確定 | #13/#16/#18/#20/#22 |
| R1: Exact candidate / credential-free CI | public `npm ci`、全 audit scopes/ZIP、unit + indexed DB + exact runtime request、native、Bicep artifact、intentional failures、Pages/links を実行 | #14/#15/#18/#19/#23 |
| R2: Fresh Cloud Shell / real app | Day 0→core/handoff→backend/frontend→login/CRUD。保存後に別 Cloud Shell session から復元。direct/SWA health と JA/ZH/KO/emoji/symbol/legacy article を確認 | #13–#16/#18/#20–#23 |
| R3: Reconnect / idempotence / recovery | 再 deploy で role/state/URL/data を保持。owned App Service restart/redeploy/known revision 復旧、stable health と同じ記事を検証。A 以外の group の別 state を使う | #14/#16–#18/#20/#21 |
| R4: Failure / owned cleanup | 空/foreign target 拒否、実失敗の非 0、dedicated RG の deletion/no-existence、owned artifact の削除/失効、必要時の owned Entra cleanup を担当別に確認 | #13/#15/#18/#20 |
| R5: Independent learner / teaching fit | 別実施者が documented permissions と handoff だけで実行。日本語 portal/navigation、copy/progress/mobile を確認し、各段階の実 elapsed time を記録 | #19–#23 と workshop release |

R2/R3 は private endpoint の存在や public health だけでは合格にしない。App Service 側の private DNS・Key Vault reference resolution・実 DB connection/CRUD を確認し、public DB connectivity が意図せず有効になっていないことを service の supported controls と実 behavior で検証する。telemetry は operation/time と実流入を対応付け、未流入・遅延を区別する。

R4 の cleanup は approved dedicated targets だけで行う。soft-delete / retained artifact / Entra objects など残存するものの owner と処理方針を記録し、RG 不在を「すべて消去」と同義にしない。最初の rehearsal が自グループで成功しても、別実施者の成功まで workshop-wide release を承認しない。

### 24.7. 実行順、費用、学習時間を gate で管理する

以下の期間は **担当者・権限・環境・予算が確保された後の作業量の目安**。承認待ち、tenant consent、service provisioning、quota/capacity 待ち、学習者日程を含む納期の保証ではない。

P0 の意思決定と P1 の credential-free 作業は並行して進める。P2 は該当する権限・tool/host・費用方針の承認を実際の前提とし、P3 は合格した candidate と authorized environment、P4 は rehearsal evidence を前提とする。

| 順序 | 作業・目安 | 開始条件 / 終了条件 |
|---|---|---|
| P0: 決定と受け入れ map・1–2 人日 | A/B/C の権限方式、ARM/CLI の tool route、host/budget/cleanup、検証者を決める | Original checklist と proposed changes を承認し、実施者・scope・費用上限が確定 |
| P1: 承認不要の契約作業・2–3 人日 | candidate map、ARM fixture contracts、handoff/state/replay の設計、docs/CI acceptance を整理 | R1 の候補が再現可能。cloud writes なしで実施でき、P0 の実承認を待って全作業を止めない |
| P2: 承認した経路の実装・2–4 人日 | core/RBAC phase、selected frontend deployment、hosting/expiry、required tool gate、文書を一貫して接続 | R1 合格、unapproved fallback なし、rollback と cleanup 手順あり |
| P3: 統合 / cloud rehearsal・2–4 人日 | main 向け candidate review、R0/R2/R3/R4、発見した blocker の修正 | exact SHA の acceptance map を満たす。新たな capacity 不足は環境担当へ戻す |
| P4: Independent pilot / release・1–2 人日と実施枠 | R5、real teaching-time feedback、safe final evidence、maintainer adoption | Issue ごとの承認と採用済み revision。自動 merge / close は行わない |

4 時間 classroom の教材では、readiness/権限依頼、platform provisioning、CRUD、recovery、cleanup の実時間を分けて記録する。Provisioning や handoff 待ちが枠を超えるなら、Day 0 readiness を受講者自身の事前課題として明記するか、exercise scope / time allocation を調整する。講師が resource を事前作成したことを「準備なし」に見せたり、未観測の作業時間を約束したりしない。

新たな blog 機能、Container Apps/Functions/database 置換、VM ベースの迂回、paid HA/secondary region はこの critical path に追加しない。B1/M25/HA=false の baseline に固定し、artifact host の費用を明示的に追加承認する。利用可能な region/SKU の変更は環境担当が top-level parameters、機能、費用を確認して採用し、自動 fallback にしない。

### 24.8. 完了判定と、承認されない場合の正確な結論

**Issue acceptance、main adoption、workshop release は別の gate**。受け入れ可能な成果物は staged review に進め、採用済み source の checks と safe evidence を整えて maintainer が Issue を閉じる。全 Issue を閉じても、optional 経路の未検証事項・upstream の履歴・tenant policy の違いを消さない。

全件解決へ進むための最初の意思決定は、(1) restricted privilege handoff / constrained delegation を許容するか、(2) hosted ARM ZIP route と必要な費用・tool criteria を許容するか、である。GitHub merge/Issue close と paid optional HA は引き続き別承認とする。

**(1) が承認されず strict Contributor-only / 支援なしを維持する場合、現行 fresh MI/Key Vault RBAC architecture の全件完了は実現できない。** その場合も repository 内の修正・テスト・文書・review は進められるが、#16 と依存する real acceptance を「解決済み」としない。(2) が承認されない場合は supported upstream CLI remediation を審査し、audit failure と live acceptance を保持する。条件の矛盾を unchecked のまま隠すより、解決経路の選択と責任分界を明確にする。

<a id="arm-implementation-decision"></a>

## 25. ① A / ② B の決定を反映し、ARM 経路を実装する

2026-10-11 に① A（Contributor のみ・管理者支援なし）が選択され、2026-10-12 の「今回は②はBで進めてください」で ARM ZIP implementation を進める方針が確定した。第 24 節の handoff / constrained delegation の推奨は採用しない。②の実装承認を、①の条件変更、新規有料 Storage、追加権限、tenant policy、GitHub merge/close の承認に広げない。

### 25.1. #49 の実装と学習する手順

#49（base: #48）の implementation source は `aea1192371773d3bacf3319d70cd4117319ea77a`。後段 candidate の read-only/CI/ZIP/runtime helpers を再利用し、新しい npm dependency、SWA deployment token、native CLI wrapper は追加しない。

| 段階 | 実装 |
|---|---|
| Prepare | `deploy-frontend-arm.sh <saved-RG> prepare <new.zip>` が public `npm ci` / production build / shared config writer を使う。Root routing/assets、private ZIP/receipt、source SHA/dirty flag、bytes/SHA-256 を検証。既存 artifact は上書きしない |
| Owned host | 利用許可済みの HTTPS host へ exact ZIP だけを immutable object 名で置く。保管先・費用・upload/read・期限・削除が未確定なら停止。Storage の作成・共有 clouddrive の公開は行わない |
| Deploy | 同じ wrapper の `deploy <prepared.zip>` に temporary URL を非表示 stdin で入力する。Local receipt / current target と hosted checksum を照合してから matching ARM OAuth で documented `properties.appZipUrl` を送る |
| Completion | 200/202 を区別。Selected site / subscription の trusted ARM operation のみを最大 15 分 / 120 polls、1 request 最大 30 秒で確認。Failed/Canceled、unknown/malformed state、unsafe polling/redirect、timeout は非 0。POST を自動再送しない |
| Readiness | ARM completion 後、最大 3 分 / 6 attempts。既存 shared helper で direct/SWA health、published list、runtime IDs を確認し、配信 index が exact prepared ZIP と一致することを追加検証 |
| Cleanup / rollback | Host owner が今回の object だけを削除し temporary URL を失効する。Generic host を勝手に削除できないため未実施なら明記。Known-good local ZIP/receipt は必要期間だけ保持し、再 upload 時は新しい短期 URL を使う |

Token / SAS / reflected response / transport error は表示せず、Bearer は artifact host へ送らない。新しい route から legacy CLI に自動 fallback しない。公開 readiness の成功でも `workshopReady: false`、browser/consent/authenticated CRUD/private data/telemetry/owned artifact cleanup は `notVerified` に残す。

Day 1 の frontend、Day 2 の redeploy、troubleshooting、quick reference、JA/EN entry、developer testing、quality path filters を同期した。Legacy `deploy-frontend.sh` と CLI audit は履歴・互換性/未解消の追跡として保持し、本 route の導入を「CLI の 6 findings が直った」とは説明しない。実 upload が未確認のまま zero-advisory release を承認しない。

### 25.2. Local evidence と live acceptance の境界

- **68 native tests** が成功。17 ARM regressions は本物の ZIP/receipt、production state machine、loopback HTTP server を使う native fetch、redirect refusal、token context/CLI-error redaction、exact HTML/public readiness の成功と失敗を扱う。既存 49 tests と wrapper の 2 tests を維持する。
- Real production frontend build を shared runtime writer と routing copy で処理し、ZIP/receipt/checksum の生成と再検証が成功。検証用 public IDs だけを使い、`sourceDirty: true` の fixture artifact を real release の証拠にはしない。
- Changed learner/reference の **36 Bash fences / 21 internal links**、actionlint、Pages build が成功。先に routing file をコピーしなかった artifact probe は拒否され、wrapper と同じ copy 後に成功した。欠落を success-shaped fallback で補わない。
- Authorized read-only Azure preflight は再び **exit 3 / RG absent / required roleAssignments/write not reported allowed**。Isolated Contributor principal の実証ではなく現在の caller の結果。Azure resources / app registrations / grants / hosted object の作成・変更は行っていない。

Actual public runner も source `aea1192371773d3bacf3319d70cd4117319ea77a` で確認した。Native run `38207260390` は **68 tests / success**、quality run `38207260391` は **backend15 / database8** と frontend/application/public provenance/Bicep/workflow validation の 7 jobs が成功。取得した CLI audit artifact は **high5 / low1 / total6 package-level findings** で、当該 job と overall は failure。現在の CI の成功/失敗を旧日付の証拠で代用せず、ARM candidate の追加で legacy audit を隠さない。

### 25.3. 次に必要な入力と停止条件

実 Azure acceptance の前に、owned HTTPS host、費用/期限/cleanup、exact deployed SWA と healthy backend、許可された registration/consent を確定する必要がある。現在は authorized RG が未作成で、① A のまま fresh Key Vault RBAC を完了できない。既存の許可済み完成環境があると仮定して勝手に他の RG/SWA へ upload しない。

実装・credential-free verification と公開 PR は進められるが、上記の不足を隠して #15/#16/#21 を閉じない。Host を指定することは resource/permission 作成の承認ではなく、① A を変更する場合も別の明示的な決定が必要である。

<a id="pr-merge-strategy"></a>

## 26. #24–#49 の merge 計画を、採用単位と gate で管理する

2026-10-12 時点の調査に基づく提案。**今回実施するのは計画の保存・共有まで**であり、新しい統合 PR の作成、既存 PR の retarget / ready 化、merge / close、repository settings の変更、Azure 操作は行わない。第 24.5 節の単一統合案を、先行採用できる改善と保留すべき運用改善に分けて具体化する。

### 26.1. 現在の source、checks、保護設定を固定する

| 対象 | 確認結果 |
|---|---|
| main | `005cc191d970b7ee3374ad73452270ebacb98eef`。26 PRs はいずれも未マージ |
| 計画 PR #24 | 更新前 head `5b975176e7c512876513f9954157556e22d229fd`。main 向け・non-draft・check run なし |
| 最終実装 PR #49 | head `b5d578891bb641d5618e17c770564bc35ed69b66`、base は #48 の branch。main 向けの PR ではない |
| main → #49 | 109 files、8,741 additions / 4,002 deletions。小さい ARM-only 変更ではなく、全 track の累積差分 |
| 履歴の包含 | `git merge-base --is-ancestor` で #25–#49 の全 head が #49 に含まれることを確認。#24 の上記 head は含まれないが、今回の更新前の計画文書 blob は同一 |
| #49 final CI | [native run 38207418201](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38207418201) は 68 tests / success。[quality run 38207418631](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38207418631) は非 CLI の 7 jobs が success、旧 CLI audit と overall が failure |
| Review / mergeability | 全 PR に recorded approval はなく、`reviewDecision` は空。全 PR の `MERGEABLE` は Git の技術的判定にすぎず、採用許可ではない |
| main の保護 | Branch API は `protected: false`、classic protection API は `404 Branch not protected`、repository rulesets と main の effective rules はともに 0 件。権限不足による取得失敗ではない |
| Merge 方法 / branch 削除 | merge commit / squash / rebase はすべて許可。`delete_branch_on_merge: false`。設定は変更していない |
| main の workflow source | `.github/workflows/` に存在するのは Pages のみ。Quality / script quality の workflow 登録と branch 上の実行実績があっても、main にその workflow source が採用済みとはいえない |

保護設定がないことは赤い CI を通してよい理由にならない。設定変更が未承認でも、maintainer の merge checklist で review / exact-source checks を必須にする。実行時には remote main、PR head/base、check runs、review、rules を再取得する。

### 26.2. 推奨順序は「計画 → アプリ改善 → 運用統合 → workshop release」

全 PR を番号順に merge することも、#49 の base だけを main に変更して即 merge することも推奨しない。後者は差分を 109 files に広げ、旧 CLI audit failure と Azure 未検証事項を解消しない。**全件の live acceptance を待たずに、独立して正しく検証できるアプリ改善を先に採用する**。

| Wave | 採用単位と source | Merge 前の条件 / 採用後の扱い |
|---|---|---|
| M0: 計画 | #24 を main 向けの独立 docs PR として review | 最新 A/B 決定・本節・内部リンク・docs-only diff を確認して別途 merge 承認。計画文書だけの採用で、アプリ修正や Issue 解決を主張しない |
| M1: アプリ改善 | 最新 main から新しい main 向け PR を作り、#49 の最終アプリ・必要な helpers / tests・対応する credential-free CI を選択移植 | Public locks、Unicode、署名付き JWT、runtime config、実 DB persistence を同じ PR で検証。関連 checks はすべて green。採用は development / maintenance 改善で、旧 deploy route や workshop を承認しない |
| M2: 運用・IaC・ARM 統合 | M1 採用後の main から、#49 の残りの state / preflight / deployment / diagnostics / recovery / Bicep / optional Actions / JA-EN docs を一貫した PR にする | 全 native / application / Bicep / workflow / docs checks を再実行。現状の旧 CLI audit failure を引き継ぐなら draft のまま保留。ARM 実送信の未検証・① A の制約は消さない |
| M3: Workshop release | 採用 source に対する R0–R5 と Issue ごとの original acceptance | 正しい権限・host・環境・独立 learner evidence が必要。① A の fresh RBAC 制約が残る限り「全員が Day 0–Cleanup を完了できる release」は承認しない |

M1 は #25 や #41 をそのまま単独 merge する案ではない。古い head には後続の auth / runtime 修正がなく、#27/#30 の mirror candidate を含む中間状態もある。**最終 source の必要な一式から、新しい standalone candidate を作る**。既存 main の deployment に残る未解消事項は README / developer entry に明示し、「M1 の CI が green だから Azure deploy も安全」と解釈させない。

M1 の選択範囲は `materials/backend/`、`materials/frontend/` の最終 tracked changes と、`scripts/check-public-lock.cjs`、`scripts/configure-frontend.cjs`、対応する helper tests、`scripts/test/backend-integration.test.cjs`。CI は最終 application / public provenance / production ZIP / fixture DB / runtime writer の契約を保持する。必要な imports / fixture / configuration を差分で確かめ、関連コードだけ移して test や validation を落とさない。統合候補向け `docs/application-testing.md` を丸ごと移して未採用 scripts を案内せず、採用範囲に合う説明を添える。

M2 の移植では M0 の最新計画を保持し、#49 に保存された古い版で上書きしない。Source は共通でも新 candidate の tree は移植後の main との組合せになるため、以前の integrated run をそのまま採用証拠にしない。

M1 で deployment-tool / operational jobs を未採用とするのは **PR scope の分離**であり、既存の #42–#49 の audit job を削除・skip・`continue-on-error` にして green 化することではない。M1 は CLI を install / deploy せず、application audits は全 scope / ZIP で zero を要求する。#15 の tooling acceptance は open のまま、M2 の blocker として引き継ぐ。この境界自体も maintainer が review し、承認しなければ M1 を含む merge を保留する。

依存関係を安全に分離できないことが新 candidate の CI / review で判明したら、M1 の強行採用はしない。代替は **main 向けの単一統合 candidate** にまとめ、全 gate が合格するまで保留すること。既存 stack の base を順次変えて、重複 diff / conflicts を増やす方式へ戻らない。

### 26.3. 全 26 PR の disposition を明示する

「包含」は最終 source の履歴にあるという意味で、レビュー済み・main 採用済み・自動 closure 可能という意味ではない。下表は proposed disposition であり、いずれの PR も現在は open のまま維持する。

| PR | 成果物 | 推奨 disposition |
|---|---|---|
| #24 | 改善戦略 | M0 の独立採用候補。計画の最新版を他 candidate と同期する |
| #25 | Application test foundation | M1 に最終形を包含。旧 test-only head を先行 merge しない |
| #26 | Unicode slug / URL / collisions | M1 に tests と together。既存 URL と auth 境界を保持 |
| #27 | 初期 dependency remediation | Historical / superseded candidate。Mirror source の単独採用は禁止、#41 の public locks を使う |
| #28 | Self-service consent docs | M2 の identity / learner docs に包含。Non-draft / main base でも自己同意の実証ではない |
| #29 | Permission preflight | M2 に包含。Contributor の denial を成功へ置換しない |
| #30 | 初期 application CI | Historical / superseded candidate。App failures を後段で解消した最終契約へ置換 |
| #31 | Cloud Shell state | M2 の deployment / docs と atomic に包含 |
| #32 | Explicit errors / cleanup | M2 に包含。旧 scripts と新 state の混在を避ける |
| #33 | Native script CI | M2 に包含。M1 の helper tests も scope に応じて別途実行する |
| #34 | PaaS preflight | M2 に包含。Quota / regional capacity の保証とはしない |
| #35 | Smoke / diagnostics | M2 に包含。Public health と authenticated CRUD を区別 |
| #36 | IaC / baseline alignment | M2 に Bicep source / compiled artifact / docs を together |
| #37 | Measurable recovery | M2 に probe / learner steps を包含。Real recovery acceptance は別 gate |
| #38 | Component baselines | M2 の JA/EN baseline / optional 整合に包含 |
| #39 | Public package evidence CI | M1 に最終 verifier / evidence 契約を採用。旧 failing locks とは切り離す |
| #40 | Operational references | M2 に包含。採用した scripts / architecture と一致させる |
| #41 | Public lockfiles / production ZIP | M1 の最終 public dependency source。旧 head 単体を完成形としない |
| #42 | Deployment-tool evidence | M2 の unresolved audit を可視化。歴史を保持し、失敗を隠さない |
| #43 | Validation / documentation contract | M2 に包含。Workshop-ready の誤表示を避ける |
| #44 | Integrated tracks / conflict fixes | 最終 source の統合根拠として保存。Conflict resolution を M1/M2 の移植時に落とさない |
| #45 | Optional Actions corrections | M2 の templates に包含。Cloud Shell 本線と別の承認・実証 |
| #46 | Real persisted database tests | M1 に application / fixture / CI を together。Azure DB の実証とは区別 |
| #47 | Signed Backend API token | M1 に audience / delegated scope / negative tests を together |
| #48 | Runtime API/config | M1 に runtime dispatch / validation / retry tests を together |
| #49 | ARM ZIP route | M2 の final operational source。Host / live acceptance /旧 audit のため現状は hold |

M1 採用後も、複数の採用範囲や中間 source を含む #27/#30/#39/#41 などは機械的に一括 close しない。採用済み・未採用の hunk / acceptance を確認する。M2 または単一統合 candidate の採用後、maintainer の承認で incorporated / superseded PR を整理し、新 PR と採用 commit をリンクする。`gh pr close` で閉じた PR を「merged」と報告しない。

### 26.4. Review と exact-source CI を merge の必須条件にする

| Review surface | 確認する契約 |
|---|---|
| Application | Unicode / encoded routes / preserved URLs / sanitization、draft / ownership、署名付き API audience / scope、runtime config の再読込・invalid-root 拒否、actual fixture persistence。実 build の browser routing / style smoke で Tailwind 移行の表示互換性を確認し、real consent / Azure CRUD と混同しない |
| Supply chain / CI | Public npm provenance、clean Node 24 installs、all / production / lockfile / extracted ZIP audits、pinned Actions、実行された tests、秘密値不要の CI |
| Scripts / IaC | Validated state / target、bounded failure / cleanup、single Key Vault writer、RBAC 保持、Bicep 0.44.1 artifact parity、ARM remote ZIP / checksum / trusted LRO / no fallback |
| Learner docs | Day 0–Cleanup の continuity、① A / ② B、SKU / costs / private networking、blocked / not-run 表示、JA/EN / links / Pages |

担当者の氏名はここで仮定しない。Maintainer が上記の review 担当を割り当て、実装者による self-check と別の recorded review を用意する。#49 の「68 tests / 非 CLI 7 jobs success」は参照証拠であり、新しい main 向け PR の合格証ではない。

Merge 前には、PR の **head SHA、最新 base main SHA、CI が実行した synthetic merge SHA または checkout SHA** と実際の tree を記録する。Base 更新、source 移植、conflict resolution、workflow / dependency 変更後は必要な checks を再実行する。新 candidate でも backend / database / frontend の現行 15 / 8 / 14 tests の契約を維持するが、件数だけで合格にせず、test names / failures / artifacts を確認する。

現行 workflows は top-level `pull_request.paths` を使う。これをそのまま required checks にすると、docs-only PR などで workflow が起動せず pending のままになることがある。Required にする workflow は **PR では path filter を外し、毎回実行する**案を基本とする。Push の絞り込みは別に扱う。設定時には workflow title でなく実際の check-run 名を取得し、app / helper / docs-only の各 PR で checks が生成されることを確認する。

Branch protection / ruleset 設定の追加は別承認。M1 では採用する application / public-source / database / helper / workflow checks、M2 ではそれに native / Bicep / relevant tool checks を加えて、すべて成功させる。Admin bypass、force merge、audit threshold 緩和、registry error の success 化を解決手段にしない。

### 26.5. 旧 CLI audit と実 Azure acceptance の扱いを分ける

M2 の現状は **merge-ready ではない**。公式 `@azure/static-web-apps-cli@2.0.10` の actual public audit は high 5 / low 1 / total 6 package-level findings。ARM implementation が CLI を呼ばなくても、final workflow が旧 CLI zero-audit を要求している以上、overall failure は残る。

M2 の tool gate を満たす経路は次のどちらかを別途 review する。

| 経路 | 必要な根拠 |
|---|---|
| Upstream CLI を修正済み版へ更新 | 公開 release / tree / integrity、clean audit zero、CLI loading / 実 deployment、互換性と docs の確認。単なる version 置換や未公開 fix の推測では不可 |
| 承認済み B を検証して旧 route を正式退役 | ARM の real prepare / host upload / POST / completion / readiness / rollback / object expiry-deletion、採用する他の deployment tools の inventory / audit、learner / optional docs の整合。旧 CLI support と gate の対象変更を maintainer が明示的に承認 |

② B の実装承認だけでは、旧 route の退役や #15 の original zero-audit criteria 変更は承認されていない。現状では host / real target / acceptance が不足し、① A の fresh RBAC blocker も残るため、退役済み・実証済みとは扱わない。基準変更が必要なら original checklist の変更理由と evidence を Issue に記録し、過去の CLI findings を「修正済み」と言い換えない。

Credential-free code acceptance と workshop release も別である。Live 未検証コードを development-only として採用する提案は可能だが、該当 checks を失敗のまま merge する許可にはならない。採用する場合、README だけでなく実際の learner entry / Day 0 / 該当手順に blocker と not-verified を表示する。① A を維持したまま全件が解決するという新しい約束を追加しない。

### 26.6. Merge 方法、branch 整理、rollback を先に決める

M0 / M1 / M2 を新しい standalone 採用単位として扱う場合は **squash merge** を基本提案とする。各 wave の最終 tree を一つの commit にし、PR body に元 PR / source SHA / 採用範囲を記録する。既存 stack を一件ずつ squash して、child branches がそのままつながると仮定しない。

単一統合 candidate を #49 の履歴から作る代替案では **merge commit** を提案する。元 PR heads の ancestry を保存できるが、旧 mirror / failing CI を含む中間履歴も入ることを review する。Final tree が正しいことが gate であり、履歴に過去の failure があることと現行 source の failure は区別する。Stack 全体の rebase / force-push は証拠 SHA を変えるため標準手順にしない。

どちらでも GitHub の indirect merge 判定・stacked base の挙動を仮定して一括 close しない。採用後に各 PR の実際の status / base / head を再取得する。自動判定で閉じた PR があっても、それを Issue acceptance と混同しない。既存 branch は incorporation map と rollback source の確認まで保持し、削除は別承認とする。

Rollback は **新しい revert PR** で行う。Squash の採用 commit は `git revert <adoption-commit>`、通常の main-targeted merge commit は first parent が main であることを確認して `git revert -m 1 <merge-commit>`。Revert tree も必要な CI / docs review を通す。`reset --hard` / force-push で main や evidence を消さない。

Revert は main の source を戻すだけで、Azure / Entra / database / artifact host を戻さない。App の既存記事や slug を書き換えず、runtime / artifacts / DB compatibility を確認する。Known-good backend ZIP、frontend ZIP/receipt、public runtime IDs と revision、parameter versions を秘密値なしで別に記録し、cloud rollback / cleanup は承認済み target と実行権限がある場合だけ実施する。旧 main へ戻すと古い dependency / auth defect も戻るため、security review と必要な forward fix を検討する。

### 26.7. 採用後の確認と Issue closure は別の承認にする

Merge 直後に main の exact commit、CI、Pages publication と internal navigation を確認する。現在の Pages workflow は `materials/docs/**` 等の main push で公開されるため、M2 の merge は learner content の自動公開を伴う。Workshop release 未承認なら、その公開内容が development / blocked の状態を正確に示すことを **merge 前** に review する。M0 の `design/` 文書だけの merge は現在の Pages path filter を起動しない。

Root の application deploy は optional workflow templates であり、merge を実 Azure deployment と扱わない。新 candidate で root active deploy workflow を追加するなら、別の approval / OIDC / environment guard の review が必要。今回の計画はその追加を要求しない。

| Adoption point | Issue の扱い |
|---|---|
| M0 | #23 の計画成果物を採用したことだけを記録。Issue 全体は open |
| M1 | #14 の app contract、#15 の application dependencies、#19 の app CI、#13 の API token、#21 の runtime config の進捗を追記。Original checklist と採用 exact SHA を照合し、条件を満たした Issue だけ別途 closure review |
| M2 | #16/#18/#20/#22/#23 と operational parts の採用 evidence を追記。Permission / host / real Azure / recovery の未達項目は unchecked |
| M3 | R0–R5 と Issue 別 acceptance / maintainer approval に基づく release と closure。① A の未解消 blocker があれば blocked のまま |

PR body は未達 Issue に `Refs #N` を使い、`Fixes` / `Closes` による premature closure を避ける。Issue を閉じる場合は採用 SHA、実際の検証者、safe run links、original checklist の充足を記録する。

**第26節の初期計画では M0 の review と M1 の main 向け candidate 作成を次の実行単位とした。** 2026-10-13 の承認に基づく実際の採用結果は第27節に記録する。未達の M2/M3 は追加の evidence / 必要な承認を待ち、CI failure や Contributor-only の矛盾を自動 bypass して backlog を減らさない。

<a id="merge-execution-evidence"></a>

## 27. 承認済み merge の実行と Owner 実環境の確認を記録する

2026-10-13 のユーザー指示で第26節の merge 戦略の実行と、指定 Azure 環境での learner steps 検証が承認された。ログイン済み Owner の正例検証は、Contributor-only の learner 条件を変更した証拠ではない。環境識別子は session-local に保存し、教材の既定値へ流用しない。

### 27.1. M0 の採用と M1 の main 向け candidate

#24 の exact head `f9222cb7f0340695c64bf548f54c224c89d1aade` を squash merge し、main の採用 commit `fe12f12a50e1595d35e7799a9e656e9ef1404d3b` を確認した。Docs-only の採用で branch は保持、Issue closure / settings 変更 / admin bypass は行わない。

#50 はこの main を base に、#49 の最終 application source と coupled helpers/tests を移植した新しい standalone candidate。Implementation commit `d8a4cc1237dab6a91415c4148fc93e8da64ce88a` の [actual runner 38330469358](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38330469358) は **7 jobs success**。Backend15 / frontend14 / fixture database8 / helper7、public provenance、application all/production/lock scopes と extracted backend ZIP の zero findings、build/type/lint、active workflow validation を確認した。

Separate-context の read-only code review は significant issues なし。これは independent human learner rehearsal や real Azure consent/CRUD の代替ではない。Local clean installs は public npm transport の `ENOTCONN` で失敗しており、local application tests/build 成功とは記録しない。

この candidate 準備時点では、browser acceptance 用に CI が実際に生成・設定した frontend build と source revision を artifact に保存した。Public fixture GUIDs のみを使い、deployment artifact / real sign-in の証拠にしない。Browser smoke と最新 head の全 checks が完了するまで #50 は draft を維持し、Workflow / docs-only 変更後も exact head で checks を再実行した。実際の採用は27.3に記録する。

### 27.2. 実 Azure で確認できた learner steps と新しい停止条件

ここで実行したのは **#49 の learner candidate と production helpers** であり、現在公開中の main / Pages に operational 手順を採用済みという意味ではない。CLI 実行環境は local Bash/macOS/Node24 で、Cloud Shell / Azure Files 自体の実機検証とは区別する。

| 確認 | 実際の結果 / 境界 |
|---|---|
| CLI context / target | ユーザー指定 tenant/subscription と一致。専用検証 RG は未作成、既存 resource を変更していない |
| Learner role preflight | 教材の production helper を実 CLI で実行し **exit0**。Parent subscription の permissions は roleAssignments/write を allowed と報告。Owner の結果であり isolated Contributor negative test ではない |
| Provider / region / Linux B1 catalog | 教材の production helper が **18 checks success**、`deploymentReady: false`。登録状態や advertised region と quota / capacity は区別 |
| App Service B1 quota | `az quota list` と個別 `az quota show` が primary region の **B1 limit 0 / applicable true / Instances** を報告 |
| Quota usage | 同 scope の B1 usage は **-1 / applicable false**。Usage 不明を 0 / 無制限に読み替えず、available capacity を計算しない |
| Bicep | Exact #49 source を Bicep0.44.1 で compile し、distributed `main.json` と byte parity 成功。既存 unused-param warnings は可視化 |
| Real deployment / app | 未実施。Validation/what-if、実 resource / private DNS / Key Vault / DocumentDB / Entra / browser CRUD / telemetry / recovery は未合格 |

**Owner で role assignment が許可されても、B1 の作成枠が確保されたとはいえない。** 現在の quota response は baseline 1 instance の readiness を満たす根拠にならないため、費用が発生する provisioning 前に停止する。必要なのは対象 region / Linux B1 の quota/support 確認と、その解消後の actual usage / validate / what-if。B1 quota increase、別 region、上位 SKU は自動で選択・実行しない。

M25 tier / SWA Standard eligibility、許可済み HTTPS artifact host / expiry / cleanup も未確定。Storage を勝手に作成せず、前の CLI audit failure を隠して deployment に進まない。実 Cloud Shell / Azure Files 上の state persistence と独立受講者の完走は引き続き別の acceptance。

### 27.3. M1 の実採用と M2 の保留条件

#50 final head `373775a00ef21bf4c69da15278068004b661bc28` の [actual run 38330949972](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38330949972) は全7 jobs success。CI frontend artifact の source `dbdc8b6a2d8211b767bed559bbe3f00aeef8bb89` は GitHub の synthetic merge ref と一致した。

この実 build を private-profile Chrome と loopback fixture API で検証した。Desktop1280 は3 columns、actual mobile390 は1 column、両方で document width が viewport と一致し overflow なし。Heading30px / white cards / radius8px / Azure button/tag styling を computed style と screenshot で確認。Production React router と encoded Japanese API URL で記事本文を表示した。CLI window-size だけでは actual viewport500だったため、390 と誤記せず CDP device metrics で測り直した。

Browser/public acceptance と exact CI を記録後、#50 を guarded squash merge。Main adoption commit は `73cd103580a4f4b28cb6ec2caedb6cdc2fec695d`。Fixture server は停止済み。これは real MSAL login / Azure CRUD / learner 完走の合格ではなく、Issue closure はしていない。

Local Bash の別 process で base state の init / atomic save / restore を実 CLI context と照合し、state mode600を確認した。Azure Files 上の検証と同一視しない。

M2 はこの採用済み main を base に、#49 の残る operational source を移植する。M1 の最新 plan / application / browser artifact evidence と新 helper tests を保持し、quality と native の PR path filter は外す。旧 CLI audit と Bicep parity を明示的に gate へ加え、helper checks と full native checks を区別する。旧 CLI findings、B1 quota、host/live acceptance が未達なら draft を維持する。

### 27.4. Main の持続的 checks と再確認時の context drift

Main `73cd103580a4f4b28cb6ec2caedb6cdc2fec695d` の [post-merge run 38331324319](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38331324319) も全7 jobs success。M2 local の full native は **70 tests success**、active/optional workflow actionlint と GitHub Pages build が成功した。M1 の2つの standalone runtime-writer tests を削除せず、#49 の68 testsに加えて保持する。

検証途中で CLI の **default subscription / tenant が別の context に変わった**ことを検知した。指定 subscription の `az account show --subscription` は引き続き指定 tenant と一致するが、default を使う production catalog helper は expected exit1 / context mismatch で停止した。共有環境の default を勝手に戻していない。個別 quota usage show は explicit subscription で再実行し、`usage -1 / applicable true` を報告した。以前の usage list の flag と区別し、どちらも usage が不明であることを保持する。

Dedicated RG の absence は explicit subscription で再確認した。Azure resources / registrations / grants / host objects / quota updates を作成・変更していない。教材の quota commands に explicit subscription と tenant-error の停止条件を追加し、context drift を成功・quota量へ読み替えない。

### 27.5. 公開入口の注意書きと App Service 自身の quota を再確認する

独立した docs-only #52 を main `e2325084fdccea11e075387f238e4f1a66a43ee1` に guarded squash merge。PR [38333534673](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38333534673) は全7 checks success、Pages [38333671950](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38333671950) は build/deploy success。公開ポータルを HTTP 取得し、未完走・Contributor 制約・無断 SKU/region/権限変更をしない注意書きの反映を確認した。CSS/JS/デプロイコードは不変。隔離 Chrome で20 links / iframe / progress reload / actual clipboard / storage unavailable fallback / 実測1280+390表示を確認した。

M2 #51 はこの main を取り込み、検証 snapshot `b55b6c22ab0163b0b27941dcabfd82407096cbe2` の [quality38333735296](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38333735296) は9 jobs中8 success、legacy CLI audit failure。実 artifact は high5 / low1 / total6（npm package-level 集計）。[native38333735364](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38333735364) は70 tests / 70 pass / 0 fail。古い stack を一括 merge/closeせず、M2 draft / hold を維持する。追補後は新 head の CI が必要で、この snapshot を新 head の合格証に流用しない。

追加の read-only 調査では、[App Service 自身の Get Usages In Location API](https://learn.microsoft.com/rest/api/appservice/get-usages-in-location/list?view=rest-appservice-2026-07-15) も primary region の **B1 currentValue0 / limit0 / Instances** を報告した。Quota API の usage-1 と別の観測として保持し、unknown を0へ読み替えていない。B1作成枠を確認できない理由は catalog metadata だけではなく、App Service 側の上限にも残る。他 SKU の上限が表示されても、承認済み baseline とその瞬間の容量の根拠にはしない。

Explicit selected account は指定 tenant/subscription と一致する一方、既定 context は再確認時も不一致。共有 default は変更しない。B1増枠と一時 artifact host の追加費用・所有範囲について確認を求めたが、この時点ではユーザー不在で未承認。自動申請や新規 Storage 作成はせず、実 provisioning / consent / CRUD / telemetry / recovery / independent learner acceptance を未達のまま保持する。

### 27.6. Entra policy の読み取りと Contributor の実定義を切り分ける

指定 subscription を明示して Graph 用 token を取得し、CLI 応答の tenant が指定 target と一致することを確認したうえで、公式 [Get authorizationPolicy](https://learn.microsoft.com/graph/api/authorizationpolicy-get?view=graph-rest-1.0) を GET。実応答は **HTTP200** で、default registration permission と assigned consent-policy の shape を確認した。Tokenやtenant固有のpolicy値は公開・commitせず、private session artifactに必要最小限を保存した。Azure CLIはtoken取得でsubscriptionとtenantの同時指定を受け付けなかったため、subscription指定と返却tenantの照合へ修正し、実際の成功応答を採用した。

Policyを読めたことは、全受講者のアプリ登録権限、実際のpermission grant、workshop SPAのhuman MSAL consent/sign-inを証明しない。App registrations / grants / tenant policy を変更せず、#13の未達条件を保持する。Azure Owner とGraph/Entraの権限を同一視しない。

対象subscriptionから取得した実際のbuilt-in Contributor定義でも、`Microsoft.Authorization/*/Write` が除外されていることを確認した。これはplatform定義の照合であり、isolated Contributor principalによるnegative deployment testではない。現在のKey Vault RBAC構成でfresh role assignmentが必要なことと、① AのContributor-only/no-preparation条件の矛盾は、Owner正例やquota増枠では解消しない。自動elevation・access policyへの置換・秘密値の露出で回避せず、workshop-ready/Issue closureを未達のまま保持する。

### 27.7. 最新の運用候補と今回の実行結果を確定する

#51 の検証 head `c36ab6d15ffb96b5a48546d3371157f1dc8be528` / base `e2325084fdccea11e075387f238e4f1a66a43ee1` / synthetic `f44da9c1df8da3d4b59d3b65146f343f5b6796c8` の [quality38335898167](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38335898167) は9 jobs中8 success、[native38335899806](https://github.com/hironariy/Azure-PaaS-Workshop/actions/runs/38335899806) は70 tests / 70 pass / 0 fail。実際の同runのCLI audit artifactはhigh5 / low1 / total6。#51はdraft / holdのまま、過去の結果を将来headの合格証に流用しない。

今回の実行で採用したのは計画・アプリ・入口の注意書きであり、実Azureでは作成前の必要権限 / catalog / quota / Entra policyを照合した。停止条件を確認した結果、Azure resources / app registrations / grants / tenant policy / host upload / quota requestを作成・変更していない。M2のoperational sourceや新しいDay0診断手順は、この記録文書だけの採用ではmainへ入らない。

全Issue解決・workshop-ready・Cloud Shell/Azure Files完走は未達。再開にはB1 quota/support、許可済みartifact host、対象context、実validate/what-if・デプロイ・human consent/CRUD・private data・telemetry/recovery・独立受講者のevidenceが必要。① Aと現行Key Vault構成の矛盾は別途解決が必要で、追加権限や別architectureを無断採用しない。計画・採用記録をmainで読めることと、これらの完成条件の充足を区別する。
