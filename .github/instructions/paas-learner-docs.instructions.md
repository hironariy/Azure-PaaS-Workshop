---
description: "Use when editing Azure PaaS workshop learner docs, operations guides, reference pages, README files, or workshop plans. Covers Japanese learner flow, Cloud Shell steps, Azure/AWS comparisons, validation, and troubleshooting."
name: "Azure PaaS Learner Docs"
applyTo: ["materials/docs/**/*.md", "docs/**/*.md", "design/**/*.md", "README*.md", "WorkshopPlan*.md"]
---

# Azure PaaS Learner Documentation Guidelines

- Treat learners as AWS-experienced engineers who are still new to Azure naming, identity, networking, diagnostics, and deployment ergonomics.
- Prefer Japanese for learner-facing pages unless the repository already defines an English-first or bilingual policy.
- Keep each page focused on a clear workshop job: prepare, deploy, validate, observe, troubleshoot, or clean up.
- Use Cloud Shell-first commands when possible. If local tools are required, state why and list exact versions.
- Introduce variables before commands that use them, and show how learners can verify each variable.
- After every major deployment or configuration step, include a short validation command or portal check.
- Keep AWS comparisons concise and relevant. Use them to clarify the Azure mental model, not as a side essay.
- For PaaS reliability, emphasize service-level capabilities: deployment slots, health checks, autoscale, zone redundancy, backup/restore, retry behavior, managed identity, and platform diagnostics.
- Do not introduce VM, SSH, Bastion, Azure Site Recovery, or VM agent workflows unless the PaaS workshop explicitly requires them.
- Use actionable troubleshooting sections with symptoms, likely causes, and checks.
- Preserve educational intent. Avoid replacing hands-on learning steps with opaque scripts unless the workshop design calls for automation.
