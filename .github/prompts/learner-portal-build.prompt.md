---
name: "PaaS Learner Portal Build"
description: "Azure-PaaS-Workshop の GitHub Pages learner portal を設計・実装・検証するための段階的プロンプト。"
argument-hint: "対象範囲、既存 portal の有無、先に載せたいページがあれば入力"
agent: "learner-portal-agent"
---

Azure-PaaS-Workshop の受講者向け GitHub Pages portal を作成または改善してください。

最初に `README*`, `WorkshopPlan*`, `design/`, `materials/docs/`, `materials/docs/_config.yml`, `.github/workflows/`, `scripts/` を確認してください。既存 portal がある場合は破壊的に置き換えず、構造と意図を理解してから作業してください。

## 実装方針

- `materials/docs/index.md` を portal entry とする GitHub Pages/Jekyll 互換の軽量実装を優先してください。
- learner path、operations、reference、development-only notes を明確に分けてください。
- 進捗チェックは versioned localStorage key で保存し、storage が使えない環境でも壊れないようにしてください。
- Markdown pages は iframe や navigation から開けるだけでなく、単体でも読めるようにしてください。
- コードブロックは読みやすく、copy button でコピーできるようにしてください。
- モバイル表示でテキストやボタンが重ならないようにしてください。
- 見た目は実務的で、受講者が演習中に素早く参照できる密度にしてください。

## 作業順

1. 既存 docs と GitHub Pages 設定を調査する。
2. portal navigation 案を出す。
3. 変更対象ファイルを提示する。
4. 小さく実装する。
5. preview/build コマンドがあれば実行する。
6. navigation、progress、copy buttons、mobile layout の確認結果を報告する。

実装前に大きな不明点がある場合は、短く質問してください。明らかな範囲は自律的に進めてください。
