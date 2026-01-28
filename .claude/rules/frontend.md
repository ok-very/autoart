---
paths:
  - "frontend/**"
  - "packages/ui/**"
---

# Frontend Rules

- NO Mantine — use bespoke atoms/molecules from `ui/atoms/` and `ui/molecules/`
- No inline styles or inline components — add to component library if needed
- Extract if used 2+ places or >100 lines; inline if <50 lines and tightly coupled
- Content adapters go in `ui/workspace/content/`
- Import order: React/framework, third-party, stores, API hooks, components, types
