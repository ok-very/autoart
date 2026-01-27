# Frontend Development

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

---

## Component Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| `{Domain}Page.tsx` | `/pages/` | Route shell, owns state |
| `{Domain}View.tsx` | `/ui/composites/` | Center content |
| `{Domain}Sidebar.tsx` | `/surfaces/` | Left panel |
| `{Domain}Inspector.tsx` | `/surfaces/` | Right panel |
| `{Domain}Content.tsx` | `/ui/workspace/content/` | Content adapter |

**State ownership:** Pages own state, pass down via props. Complex global state → Zustand stores.

---

## UI Components

**NO MANTINE.** Use bespoke atoms/molecules:

- **Atoms:** Button, Badge, Text, TextInput, Select, Checkbox, Card, Stack, Inline, Spinner
- **Molecules:** Menu, SegmentedControl

No inline styles/components - add to component library if needed.

---

## Placement Rules

- **Extract** if used 2+ places or >100 lines
- **Inline** if <50 lines and tightly coupled
- Content adapters → `ui/workspace/content/`

---

## Import Order

1. React/framework
2. Third-party (lucide-react, clsx)
3. Stores (`@/stores/`)
4. API hooks (`@/api/hooks`)
5. Components
6. Types

---

## Zustand Persisted State

When adding persisted state:
1. Add to state interface
2. Add setter action
3. Add initial value
4. Add to `partialize` whitelist
5. Increment `version` if renaming/removing

---

## Workspace System

```
Workspace (type: 'collect' | 'plan' | 'mail')
    ↓
CenterContentRouter → Content Adapter → Composite View
```

- `panelRegistry.ts` maps panel types to components
- `workspaceColors.ts` provides per-workspace theming

---

## Build Targets

| Build | Command | Output |
|-------|---------|--------|
| Dashboard | `pnpm build:frontend` | `frontend/dist/` |
| Intake | `pnpm build:intake` | `dist-intake/` |

Both share same dependencies.

---

## TypeScript Build Validation

**KNOWN ISSUE:** TypeScript output is not captured reliably in Git Bash on Windows.

When fixing TypeScript errors:
1. Fix errors based on user's build output
2. **Ask user to re-run their build** - do not trust agent's tsc output
3. Iterate based on user feedback
