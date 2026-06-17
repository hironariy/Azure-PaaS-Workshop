# GitHub Copilot Instructions - Azure PaaS Workshop

This repository contains materials for an Azure PaaS workshop. Treat the repository itself as the source of truth: inspect `README*`, `WorkshopPlan*`, `design/`, `materials/docs/`, application folders, infrastructure folders, and existing workflows before making assumptions.

## Project Purpose

- Help AWS-experienced engineers learn Azure PaaS patterns through hands-on workshop material.
- Prefer clear, teachable, repeatable steps over clever automation that hides learning value.
- Explain Azure concepts with AWS comparisons when it helps the learner build a mental model.
- Keep learner-facing content practical: prerequisites, exact commands, expected outputs, validation checks, and troubleshooting.

## PaaS-First Assumptions

Use Azure PaaS services as the default design vocabulary unless the repository explicitly says otherwise:

- App hosting: Azure App Service, Azure Container Apps, Azure Functions, Azure Static Web Apps.
- Data: Azure SQL Database, Azure Cosmos DB, Azure Storage, managed cache or messaging services where applicable.
- Identity and secrets: Microsoft Entra ID, Managed Identity, Azure Key Vault, RBAC.
- Observability: Application Insights, Azure Monitor, Log Analytics, diagnostic settings, KQL.
- Reliability: zone redundancy where supported, deployment slots, health checks, autoscale, backup/restore, failover, retry patterns.

Do not drift into IaaS-specific defaults such as VM-based application tiers, Azure Site Recovery for VMs, MongoDB replica sets on Azure VMs, or Azure Monitor Agent for VMs unless those are explicit requirements in this repository.

## Documentation Standards

- Japanese is the default for learner-facing content unless the repository already defines a bilingual workflow.
- Keep headings task-oriented and scannable.
- Write commands so learners can copy and run them safely from Azure Cloud Shell whenever possible.
- Show where values come from before asking learners to set variables.
- Include verification steps after each major action.
- Include troubleshooting for likely workshop blockers: subscription permissions, provider registration, quota, region availability, identity/RBAC, deployment failures, application startup, and telemetry delay.
- Avoid unexplained placeholders. If screenshots or values are pending, use a consistent TODO with owner/context.

## Learner Portal Standards

When building or editing the learner portal, prefer the lightweight GitHub Pages pattern used by the IaaS workshop:

- `materials/docs/index.md` as a self-contained portal page with inline CSS and JavaScript.
- Jekyll/GitHub Pages compatibility without custom plugins beyond supported GitHub Pages plugins.
- Left navigation plus content iframe for learner pages, with responsive collapse on narrow screens.
- localStorage-based progress tracking with a versioned storage key.
- Dark, readable code blocks and copy buttons for commands.
- Clear separation between learner path, operations guides, reference material, and development-only notes.
- Preserve individual Markdown pages as normal standalone documents where possible.

## Code And Infrastructure Standards

- Follow the existing language, framework, linting, and formatting conventions in the repository.
- For TypeScript, prefer strict typing, explicit public function return types, and clear interfaces.
- For infrastructure, prefer modular Bicep or Terraform consistent with existing repo patterns.
- Use secure parameters for secrets. Never hardcode credentials, tokens, keys, or connection strings.
- Prefer Managed Identity and RBAC over client secrets for Azure resource access.
- Keep changes focused on the requested workshop or portal outcome.

## Work Process

- Start with repository discovery and a short plan before broad edits.
- For large documentation reorganizations, produce a gap analysis and proposed target structure first.
- Preserve useful existing content. Move or rewrite content deliberately; do not delete material just because it is rough.
- Keep learner workflow continuity in mind: Day 0 prerequisites should support Day 1 deployment, which should support Day 2 reliability/operations exercises.
- Validate documentation changes with preview/build commands when the repository provides them.

## Verification Expectations

Before considering portal or documentation work complete, verify as much as the local environment allows:

- Markdown/Jekyll preview or build succeeds.
- Internal links resolve.
- Portal navigation loads the intended pages.
- Progress checkboxes persist and degrade safely if localStorage is unavailable.
- Code block copy buttons work in the preview browser.
- Mobile layout remains readable.
- The output does not accidentally teach IaaS-only patterns for a PaaS workshop.
