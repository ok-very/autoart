---
trigger: always_on
description: Frontend component naming and placement conventions
---

# Frontend Component Conventions

## Directory Structure

```
frontend/src/
├── api/hooks/        # TanStack Query hooks organized by domain
├── components/       # Reusable, feature-specific components
│   ├── inspector/    # Inspector panel subviews
│   ├── layout/       # Page structure (Header, Footer)
│   └── common/       # Generic widgets (ResizeHandle)
│
├── hooks/            # Custom React hooks (useDragHotZones, etc.)
│
├── ui/
│   ├── atoms/        # Pure presentational primitives (Badge, Button)
│   ├── molecules/    # Composed atoms (FieldRenderer, Menu)
│   ├── composites/   # Composite views (CalendarView, ProjectView)
│   ├── layout/       # Layout components (MainLayout, Header)
│   ├── panels/       # Panel components (ProjectPanel)
│   └── workspace/    # Workspace system (CenterContentRouter, adapters)
│
├── stores/           # Zustand stores (uiStore, workspaceStore)
├── workspace/        # Workspace registry and presets
├── pages/            # Route entry points
└── styles/           # CSS files (calendar.css, etc.)
```

## Workspace System

### Center Content Routing
The workspace system routes center content based on workspace type:

```typescript
// CenterContentRouter.tsx dispatches to content adapters
workspace.type === 'collect' → ArtCollectorContent
workspace.type === 'plan'    → CalendarContent
workspace.type === 'mail'    → MailContent
```

### Content Adapters
- `ui/workspace/content/*.tsx` - Domain-specific center content
- `ui/workspace/*Adapter.tsx` - Adapters that transform workspace state

### Panel Registry
- `workspace/panelRegistry.ts` - Maps panel types to components
- Panels can be bound to projects via `workspaceStore.bindProjectToPanel()`

## Naming Conventions

### Prefixes for Disambiguation
- **Import-specific**: Prefix with `Import` (e.g., `ImportRecordInspector`)
- **Action-specific**: Prefix with `Action` (e.g., `ActionDetailsPanel`)
- **Content adapters**: Suffix with `Content` (e.g., `CalendarContent`)

### File Naming
| Type | Location | Example |
|------|----------|---------|
| Content adapter | `ui/workspace/content/` | CalendarContent.tsx |
| Panel component | `ui/panels/` | ProjectPanel.tsx |
| Composite view | `ui/composites/` | CalendarView.tsx |
| Custom hook | `hooks/` | useDragHotZones.ts |
| Page wrapper | `pages/` | ProjectPage.tsx |

## Placement Rules

### When to extract vs inline:
- **Extract** if used in 2+ places or > 100 lines
- **Inline** if tightly coupled to one parent and < 50 lines
- Content adapters always go in `ui/workspace/content/`

## Import Order

1. React/framework
2. Third-party (lucide-react, clsx)
3. Stores (`@/stores/`)
4. API hooks (`@/api/hooks`)
5. Components (relative paths)
6. Types (type-only imports)

## Zustand Store Conventions

### Adding Persisted State
1. Add property to state interface
2. Add setter action
3. Add initial value
4. Add to `partialize` whitelist
5. Increment `version` if removing/renaming fields

### Workspace Store Pattern
```typescript
// workspaceStore.ts manages:
- activeWorkspace
- panelParams (dynamic panel configuration)
- boundPanels (project-panel bindings)
```

## UI Component Library

**Do NOT use Mantine.** Use bespoke components:

### Atoms (`ui/atoms/`)
- `Button` - variants: primary, secondary, ghost, danger, light, subtle
- `Badge` - variants: project, process, task, warning, success, error
- `Text` - size: xs/sm/md/lg, color: default/muted/error
- `TextInput`, `Select`, `Checkbox`, `RadioGroup`
- `Card`, `Stack`, `Inline`, `Spinner`, `Alert`

### Molecules (`ui/molecules/`)
- `Menu` - Dropdown with Menu.Target, Menu.Dropdown, Menu.Item
- `SegmentedControl` - Button group toggle
