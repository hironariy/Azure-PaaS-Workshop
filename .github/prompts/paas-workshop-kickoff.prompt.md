---
name: "PaaS Workshop Kickoff"
description: "Azure-PaaS-Workshop の現状調査、IaaS 参考パターンとの差分分析、ドキュメント整理と受講者ポータル作成の計画を作る初回プロンプト。"
argument-hint: "重視するサービス、日英方針、作業範囲があれば入力"
agent: "agent"
---

Azure-PaaS-Workshop のドキュメント整理と受講者向けポータル作成を進めたいです。GPT-5.5 が利用できる場合は GPT-5.5 を使ってください。

まず実装や大規模編集はせず、リポジトリ調査と計画作成に集中してください。

## 調査してください

1. `README*`, `WorkshopPlan*`, `design/`, `materials/docs/`, application folders, infrastructure folders, `.github/` を確認してください。
2. 既存の GitHub Pages / Jekyll / docs preview / workflow があるか確認してください。
3. 既存の Copilot instructions, agents, prompts がある場合は、今回追加した `.github/` 配下の設定と衝突しないか確認してください。
4. PaaS workshop の主な Azure サービス、受講者レベル、日英ドキュメント方針、学習日程、既存教材の完成度を整理してください。

## 判断してください

1. IaaS workshop (リモートリポジトリは [https://github.com/hironariy/Azure-IaaS-Workshop](https://github.com/hironariy/Azure-IaaS-Workshop)。ローカルリポジトリは `../Azure-IaaS-Workshop`) から再利用できる考え方と、PaaS 向けに作り直すべき部分を分けてください。
2. VM、SSH、Bastion、Azure Site Recovery、MongoDB replica set on VMs などの IaaS 前提が混ざっていないか確認してください。
3. PaaS 側では App Service、Container Apps、Functions、Static Web Apps、Azure SQL/Cosmos DB、Storage、Key Vault、Managed Identity、Application Insights、Azure Monitor、deployment slots、autoscale、backup/restore、zone redundancy などを中心に考えてください。

## 出力してください

日本語で、次の形で出力してください。

```markdown
# Azure-PaaS-Workshop 初回調査レポート

## 現状構造

## 想定される学習導線

## IaaS から再利用できるパターン

## PaaS 向けに置換・再設計すべき点

## ドキュメント整理方針

## 受講者ポータル方針

## 実装フェーズ案

## 検証手順

## 未確定事項
```

計画を提示したらそこで止まり、編集に進む前に確認を求めてください。
