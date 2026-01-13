---
description: Frontend component naming and placement conventions
---

# Frontend Component Conventions

## Directory Structure

```
frontend/src/
├── components/       # Reusable, feature-specific components
│   ├── inspector/    # Inspector panel subviews (ActionDetailsPanel, etc.)
│   ├── drawer/       # Bottom drawer views and registry
│   ├── layout/       # Page structure (Header, Footer, etc.)
│   ├── common/       # Truly generic widgets (ResizeHandle, etc.)
│   └── [feature]/    # Feature-specific (registry/, records/, etc.)
│
├── ui/
│   ├── atoms/        # Pure presentational primitives (Badge, Button)
│   ├── molecules/    # Composed atoms (FieldRenderer, DataFieldWidget)
│   └── composites/   # Composite views with API hooks (SelectionInspector)
│
├── surfaces/         # Context-specific surfaces (import/, workflow/)
│   └── import/       # Import-specific components prefixed with Import-
│
├── pages/            # Route entry points (layout shells)
└── stores/           # Zustand stores (uiStore, projectionStore)
```

## Naming Conventions

### Prefixes for Disambiguation
- **Import-specific**: Prefix with `Import` (e.g., `ImportRecordInspector`, `ImportWorkbench`)
- **Action-specific**: Prefix with `Action` (e.g., `ActionDetailsPanel`, `ActionEventsPanel`)
- **Drawer views**: Suffix with `Drawer` or place in drawer/views/

### Canonical Components
When one canonical component exists, avoid duplicate names:
- `SelectionInspector` is THE unified inspector - don't create new `*Inspector` exports
- Use specific names for specialized versions (e.g., `ImportRecordInspector` not `RecordInspector`)

## Placement Rules

### Where to put new components:

| Type | Location | Example |
|------|----------|---------|
| Inspector subview | `components/inspector/` | ActionDetailsPanel.tsx |
| Drawer view | `components/drawer/views/` | ComposerDrawer.tsx |
| Surface-specific | `surfaces/[surface]/` | surfaces/import/ImportRecordInspector.tsx |
| Generic composite | `ui/composites/` | SelectionInspector.tsx |
| Page wrapper | `pages/` | ProjectPage.tsx |

### When to extract vs inline:
- **Extract** if used in 2+ places or > 100 lines
- **Inline** if tightly coupled to one parent and < 50 lines
- When extracting from a surface, prefix with surface name

## Import Order

1. React/framework
2. Third-party (lucide-react, clsx)
3. Stores (`../stores/`)
4. API hooks (`../api/hooks`)
5. Components (relative paths)
6. Types (type-only imports)

## Adding to Zustand Persist

When adding new persisted UI state:
1. Add property to `UIState` interface in `uiStore.ts`
2. Add setter action
3. Add initial value in store creator
4. **Add to `partialize` whitelist** (line ~190)
5. Increment `version` if removing or renaming existing fields

## Deprecation Pattern

When replacing a component:
1. Add `@deprecated` JSDoc with migration path
2. Keep backward-compatible export for 1 release
3. Update all internal usages to new component
4. Remove deprecated file after verification

## Sidebar Conventions

### Placement Rules
- **Page-specific sidebars**: Co-locate with their page in `surfaces/{pageName}/`
  - Example: `surfaces/import/ImportSidebar.tsx`
- **Reusable sidebars**: Export from `ui/sidebars/index.ts`
  - Example: `ui/hierarchy/HierarchySidebar.tsx`

### Naming
- All sidebars end with `Sidebar` suffix
- Name after domain/purpose, not appearance

