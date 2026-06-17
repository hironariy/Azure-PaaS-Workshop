---
description: "Use when creating or editing the Azure PaaS learner portal, GitHub Pages/Jekyll docs index, navigation, progress tracking, copy buttons, or portal preview workflow."
name: "Azure PaaS Learner Portal"
applyTo: ["materials/docs/index.md", "materials/docs/_config.yml", "scripts/preview-pages.sh", ".github/workflows/pages.yml"]
---

# Azure PaaS Learner Portal Guidelines

- Build the actual learner portal, not a marketing landing page.
- Keep the portal lightweight and GitHub Pages-compatible. Avoid frontend build systems unless the repository already uses one for docs.
- Prefer a self-contained `materials/docs/index.md` with inline CSS/JavaScript, a navigation pane, and an iframe/content pane for Markdown pages.
- Preserve standalone Markdown pages so links remain useful outside the portal.
- Track learner progress with a versioned localStorage key and safe try/catch fallback.
- Keep navigation grouped by learner path, operations, reference, and development-only material.
- Make code blocks readable, dark, copyable, and high contrast.
- Ensure mobile layout is usable: no overlapping text, no fixed-width panels that overflow, and no controls that become too small to tap.
- Avoid decorative complexity. Workshop portals should feel clear, fast, and operational.
- Validate with the repository's GitHub Pages/Jekyll preview command when available.
