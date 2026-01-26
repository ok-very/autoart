# Frontend Component Conventions

## Directory Structure

```
frontend/src/
├── api/hooks/     # TanStack Query hooks
├── components/    # Feature-specific components
├── hooks/         # Custom React hooks
├── pages/         # Route entry points
├── stores/        # Zustand stores
├── ui/
│   ├── atoms/     # Primitives (Button, Badge, Text)
│   ├── molecules/ # Composed (Menu, SegmentedControl)
│   ├── composites/# Views (CalendarView, ProjectView)
│   ├── panels/    # Panel components
│   └── workspace/ # Content routing
└── styles/        # CSS files
```

## Naming

| Pattern | Location | Example |
|---------|----------|---------|
| `{Domain}Page.tsx` | `/pages/` | ProjectPage.tsx |
| `{Domain}View.tsx` | `/ui/composites/` | CalendarView.tsx |
| `{Domain}Sidebar.tsx` | `/surfaces/` | ImportSidebar.tsx |
| `{Domain}Content.tsx` | `/ui/workspace/content/` | MailContent.tsx |

**Prefixes:** `Import*`, `Action*` for disambiguation

## Placement

- **Extract** if used 2+ places or >100 lines
- **Inline** if <50 lines and tightly coupled
- Content adapters → `ui/workspace/content/`

## Import Order

1. React/framework
2. Third-party (lucide-react, clsx)
3. Stores (`@/stores/`)
4. API hooks (`@/api/hooks`)
5. Components
6. Types

## Zustand Persisted State

1. Add to state interface
2. Add setter action
3. Add initial value
4. Add to `partialize` whitelist
5. Increment `version` if renaming/removing

## UI Components

**No Mantine.** Use bespoke:

- **Atoms:** Button, Badge, Text, TextInput, Select, Checkbox, Card, Stack, Inline, Spinner
- **Molecules:** Menu, SegmentedControl
