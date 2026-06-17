---
name: "PaaS Documentation Gap Review"
description: "Azure-PaaS-Workshop の既存ドキュメントを読み、受講者導線、PaaS 前提、重複、欠落、優先改善点をレビューする。"
argument-hint: "レビュー対象や優先観点があれば入力"
agent: "paas-consultant-agent"
---

Azure-PaaS-Workshop の既存ドキュメントをレビューしてください。原則としてファイル編集はしないでください。

## 観点

- 受講者が Day 0 から最終演習まで迷わず進めるか。
- PaaS workshop として、App Service、Container Apps、Functions、Static Web Apps、Azure SQL/Cosmos DB、Storage、Key Vault、Managed Identity、Application Insights、Azure Monitor などの扱いが適切か。
- IaaS 前提や VM 管理手順が不必要に混ざっていないか。
- learner / operations / reference / development / design の分類が明確か。
- 日本語と英語のファイル方針が一貫しているか。
- コマンド、前提条件、検証、トラブルシューティング、cleanup が十分か。
- 受講者ポータルに載せるべきページと、参照資料に留めるべきページが分かれているか。

## 出力

日本語で次を出力してください。

```markdown
# Documentation Gap Review

## Summary

## Strengths

## Critical Issues

## High Priority Improvements

## Medium Priority Improvements

## Proposed Information Architecture

## Candidate Portal Navigation

## Files To Edit First

## Validation Checklist
```
