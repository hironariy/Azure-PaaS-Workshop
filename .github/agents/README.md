# Azure PaaS Workshop Agents

These agents divide the Azure-PaaS-Workshop documentation and portal work into focused roles.

## Recommended Workflow

1. Use `paas-consultant-agent` to review the current repository and identify gaps.
2. Use `paas-architecture-agent` to verify PaaS architecture assumptions and service mappings.
3. Use `paas-docs-agent` to edit learner, operations, and reference documentation.
4. Use `learner-portal-agent` to implement or refine the GitHub Pages learner portal.
5. Run `paas-consultant-agent` again for a final quality and consistency review.

## Agents

- `paas-consultant-agent`: Read-only strategic review, gap analysis, prioritization.
- `paas-docs-agent`: Documentation creation, reorganization, and editing.
- `paas-architecture-agent`: Azure PaaS architecture, IaC, reliability, security, and AWS comparison review.
- `learner-portal-agent`: GitHub Pages/Jekyll learner portal implementation and validation.

Keep root-level project instructions in `.github/copilot-instructions.md`. Do not add a root `AGENTS.md` unless you intentionally replace the Copilot instructions strategy.
