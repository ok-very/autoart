# Unified Theme System Migration Plan

## Overview

Enforce the workspace theme system as the single source of truth for all UI styling. Make legacy code (dockview, panels, header) inherit from theme variables. Export formatters remain autonomous.

**Scope:**
- ✅ Dockview styling → workspace theme variables
- ✅ Panel components → theme-aware Tailwind
- ✅ Header bar → theme variables
- ❌ Export formatters (PDF/Gantt) → stay autonomous (independent presentation layer)

---

## Current Theme Architecture

### What Exists (Good Foundation)
| File | Purpose |
|------|---------|
| `frontend/src/workspace/themes/variables.css` | 136 CSS variables (colors, spacing, motion) |
| `frontend/src/workspace/themes/types.ts` | `WorkspaceThemeModule` interface |
| `frontend/src/workspace/themes/registry.ts` | Self-registering theme pattern |
| `frontend/src/workspace/themes/useWorkspaceTheme.ts` | React hooks for theme consumption |
| `frontend/src/workspace/themes/presets/` | 4 themes: default, compact, floating, minimal |

### What's Broken (Needs Migration)
| File | Issue |
|------|-------|
| `frontend/src/styles/dockview-theme.css` | Hardcoded colors, not using `--ws-*` variables |
| `frontend/src/ui/layout/Header.tsx` | Inline Tailwind colors, not theme-aware |
| Panel components | Mixed hardcoded Tailwind + inline styles |
| `frontend/tailwind.config.js` | No theme variable integration |

---

## Implementation Steps

### Step 1: Extend Tailwind Config with Theme Variables

**File:** `frontend/tailwind.config.js`

Add theme-aware color utilities that reference CSS variables:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        ws: {
          bg: 'var(--ws-bg)',
          fg: 'var(--ws-fg)',
          muted: 'var(--ws-muted-fg)',
          accent: 'var(--ws-accent)',
          'accent-fg': 'var(--ws-accent-fg)',
          border: 'var(--ws-group-border)',
          // Panel colors
          panel: {
            bg: 'var(--ws-panel-bg)',
            fg: 'var(--ws-panel-fg)',
            border: 'var(--ws-panel-border)',
          },
          // Tab colors
          tab: {
            bg: 'var(--ws-tab-bg)',
            fg: 'var(--ws-tab-fg)',
            'bg-active': 'var(--ws-tab-bg-active)',
            'fg-active': 'var(--ws-tab-fg-active)',
          },
        },
      },
      backgroundColor: {
        'ws-tabstrip': 'var(--ws-tabstrip-bg)',
        'ws-group': 'var(--ws-group-bg)',
      },
      borderColor: {
        'ws-tabstrip': 'var(--ws-tabstrip-border)',
        'ws-group': 'var(--ws-group-border)',
      },
      boxShadow: {
        'ws-group': 'var(--ws-group-shadow)',
      },
      borderRadius: {
        'ws-group': 'var(--ws-group-radius)',
        'ws-tab': 'var(--ws-tab-radius)',
      },
    },
  },
};
```

**Usage after migration:**
```tsx
// Before (hardcoded)
<div className="bg-slate-50 text-slate-800 border-slate-200">

// After (theme-aware)
<div className="bg-ws-bg text-ws-fg border-ws-border">
```

---

### Step 2: Migrate dockview-theme.css to Workspace Variables

**File:** `frontend/src/styles/dockview-theme.css`

Replace all hardcoded colors with `--ws-*` references:

```css
/* Before */
.dockview-theme-light {
  --dv-activegroup-visiblepanel-tab-background-color: #ffffff;
  --dv-activegroup-visiblepanel-tab-color: #1e293b;
  --dv-separator-border: #e2e8f0;
}

/* After */
.dockview-theme-light {
  --dv-activegroup-visiblepanel-tab-background-color: var(--ws-tab-bg-active);
  --dv-activegroup-visiblepanel-tab-color: var(--ws-tab-fg-active);
  --dv-separator-border: var(--ws-group-border);
}
```

**Variable mapping table:**
| Dockview Variable | Workspace Variable |
|-------------------|-------------------|
| `--dv-*-tab-background-color` | `--ws-tab-bg` / `--ws-tab-bg-active` |
| `--dv-*-tab-color` | `--ws-tab-fg` / `--ws-tab-fg-active` |
| `--dv-separator-border` | `--ws-group-border` |
| `--dv-background-color` | `--ws-group-bg` |
| `--dv-paneview-header-*` | `--ws-tabstrip-*` |

---

### Step 3: Migrate Header Component

**File:** `frontend/src/ui/layout/Header.tsx`

Replace hardcoded Tailwind classes with theme-aware versions:

```tsx
// Before
<header className="h-12 bg-white border-b border-slate-200 px-4">
  <span className="text-slate-600">...</span>
</header>

// After
<header className="h-12 bg-ws-panel-bg border-b border-ws-border px-4">
  <span className="text-ws-muted">...</span>
</header>
```

---

### Step 4: Add Theme CSS Variables Root Injection

Ensure variables are always injected at document root. Update `useThemeCSS()`:

**File:** `frontend/src/workspace/themes/useWorkspaceTheme.ts`

```ts
export function useThemeCSS() {
  const theme = useWorkspaceTheme();

  useEffect(() => {
    // Always inject base variables (from variables.css)
    // Then overlay theme-specific overrides
    const root = document.documentElement;

    // Apply theme variables
    if (theme?.css?.variables) {
      Object.entries(theme.css.variables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }

    return () => {
      // Cleanup on theme change
    };
  }, [theme]);
}
```

---

### Step 5: Migrate Panel Components (Incremental)

Create a migration pattern for panels:

```tsx
// Pattern: Replace slate-* with ws-* equivalents
// frontend/src/ui/panels/*.tsx

// Before
<div className="p-4 bg-white border-b border-slate-200">
  <h2 className="text-lg font-medium text-slate-900">Title</h2>
  <p className="text-sm text-slate-500">Description</p>
</div>

// After
<div className="p-4 bg-ws-panel-bg border-b border-ws-panel-border">
  <h2 className="text-lg font-medium text-ws-fg">Title</h2>
  <p className="text-sm text-ws-muted">Description</p>
</div>
```

**Priority panels to migrate:**
1. `InspectorPanel.tsx`
2. `HierarchyPanel.tsx`
3. `FieldsPanel.tsx`
4. Panel headers/toolbars

---

### Step 6: Fix Build Errors (Prerequisite)

Before theming work, fix remaining TypeScript errors:

| File | Fix |
|------|-----|
| `MainLayout.tsx:522-523` | Cast components to `FunctionComponent` type |
| `floating.ts:94-95` | Add optional chaining for event.group |

```ts
// MainLayout.tsx
tabComponents={tabComponents as Record<string, FunctionComponent<IDockviewPanelHeaderProps>>}
watermarkComponent={watermark as FunctionComponent<IWatermarkPanelProps>}

// floating.ts
if (event?.group) {
  const groupEl = document.querySelector(`[data-group-id="${event.group.id}"]`);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/tailwind.config.js` | Add `ws` color palette mapping to CSS vars |
| `frontend/src/styles/dockview-theme.css` | Replace hardcoded colors with `--ws-*` vars |
| `frontend/src/ui/layout/Header.tsx` | Use `bg-ws-*`, `text-ws-*` classes |
| `frontend/src/ui/layout/MainLayout.tsx` | Fix component type casts |
| `frontend/src/workspace/themes/presets/floating.ts` | Fix event?.group optional chaining |
| `frontend/src/workspace/themes/useWorkspaceTheme.ts` | Ensure root variable injection |
| Panel components (incremental) | Replace `slate-*` with `ws-*` |

---

## Verification

1. `pnpm build` - No compile errors
2. Open app → Default theme renders correctly
3. Switch themes via ThemePicker → All UI elements update
4. Dockview tabs/panels respect theme colors
5. Header updates with theme
6. No visual regressions in existing panels

---

## Future: Presentation Theme System (Separate)

Export formatters (PDF, Gantt) will maintain independent styling. When needed:

```
frontend/src/exports/themes/  (future)
├── types.ts              // ExportThemeModule
├── registry.ts           // exportThemeRegistry
└── presets/
    ├── pdf-default.ts
    └── gantt-default.ts
```

This is intentionally separate from workspace themes - client presentations have different requirements than software UI.
