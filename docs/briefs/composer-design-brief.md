# Composer Design Brief: Dual-Surface Migration

## Current State

`ComposerView` at `frontend/src/ui/composer/ComposerView.tsx` (829 lines) is the expanded panel composer. It is:

- **Deprecated** (line 7: `@deprecated For new usage, prefer InspectorFooterComposer`)
- **Self-contained state** — 10 `useState` calls (lines 96-104, 108-109) duplicating logic already extracted to `useComposerForm`
- **Custom CSS dependent** — consumes 519 lines of `composer.css` with its own `--composer-*` variable namespace (28 custom properties)
- **Raw HTML** — `<select>`, `<input>`, `<textarea>`, `<button>` elements with no `@autoart/ui` atoms
- **Contains dead code** — `InlineComposer` (lines 799-827) is exported but imported nowhere
- **Record picker modal** (lines 551-589) is an inline `fixed inset-0` div, not using the `Modal` atom

### Current Sections (5)

| # | Section | Lines | Description |
|---|---------|-------|-------------|
| 1 | Project Context | 359-404 | Project + subprocess `<select>` dropdowns |
| 2 | Action Definition | 407-471 | Arrangement grid, title input, description textarea |
| 3 | Referenced Records | 474-590 | Linked records list, reference slot buttons, inline record picker modal |
| 4 | Action Inputs | 593-673 | Schema-driven fields from arrangement config |
| 5 | Action Preview | 676-732 | Dark terminal-style event preview (`#0f172a` background) |

Plus: success banner (lines 735-740), error banner (743-747), submit footer (750-780).

### Problems

1. State duplication: `useComposerForm` exists (267 lines, proven in popout) but ComposerView doesn't use it
2. Two CSS variable namespaces: `--composer-*` (composer.css) and `--ws-*` (variables.css) — only `--ws-*` is valid
3. Hardcoded Tailwind colors (`blue-500`, `green-50`, `red-500`, `slate-100`) instead of `--ws-*` tokens
4. Animations exceed DESIGN.md limits: `300ms` fade-in, `250ms` slide-up (max is `160ms`)
5. Section cards have hover shadow lift (`translateY(-2px)`) — violates "motion replaces color where possible"
6. Gradient backgrounds on icon badge and buttons — violates palette (no gradients in design system)
7. Success message uses emoji spinner and exclamation marks — violates copy rules

---

## Target State

Migrated `ComposerView` becomes the **expanded panel** surface of the composer dual-surface model:

- Uses `useComposerForm` for all state management (zero inline `useState` for form data)
- Uses `@autoart/ui` atoms exclusively (no raw `<select>`, `<input>`, `<button>`)
- Uses `--ws-*` tokens exclusively (zero `--composer-*` variables, zero hardcoded colors)
- Shares sub-components with popout where possible (`ContextIndicator`, `EventPreview`)
- Keeps panel-only features: project/subprocess selection, reference slots, schema fields expanded by default

---

## Dual-Surface Model

```
                     Shared Layer
                 ┌──────────────────┐
                 │  useComposerForm │  State: arrangements, title, description,
                 │                  │  fieldValues, references, submit, reset
                 ├──────────────────┤
                 │ ContextIndicator │  Derived context breadcrumb
                 │   EventPreview   │  Pending event preview
                 │ buildPendingEvents│ Event list builder
                 └────────┬─────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
   ComposerPopoutContent        ComposerView (migrated)
   ─────────────────────        ──────────────────────
   Quick compose overlay        Expanded panel surface
   480×520 fixed popout         Full panel, scrollable
   Ctrl+Shift+N toggle         Dockview panel tab
   3-col arrangement grid      Auto-fill arrangement grid
   Schema fields collapsed     Schema fields expanded
   No project selection        Project + subprocess Select
   No reference slots          Full reference slot UI
   No agent routing slot       Agent routing slot (future)
   3 event preview limit       Full event preview
```

### Shared hook contract

Both surfaces call `useComposerForm(options)` and consume the returned `ComposerFormState`. The hook owns:
- Arrangement selection (fetch, filter, select)
- Form fields (title, description, dynamic fields)
- References (add, remove)
- Submit (compose mutation, field bindings, reset)
- Keyboard shortcut (Ctrl+Enter)
- Derived state (`canSubmit`, `hasContent`)

### What differs per surface

| Concern | Popout | Panel |
|---------|--------|-------|
| Context resolution | Derived from workspace context | User-selectable (project + subprocess dropdowns) |
| Arrangement layout | `grid-cols-3` compact | `auto-fill, minmax(140px, 1fr)` |
| Schema fields | Collapsible, default closed | Visible by default |
| References | Not shown | Full slot UI with record picker |
| Event preview | Collapsed limit 3 | Full list |
| Agent routing | Not shown | Slot reserved (future) |

---

## Component Architecture (Migrated ComposerView)

```
ComposerView
├── Header (mode !== 'inline')
│   └── Text (h1) + close IconButton
│
├── ContextIndicator (shared, reused)
│   └── Shows project → subprocess breadcrumb
│
├── Section: Project Context
│   ├── Select (project)
│   └── Select (subprocess)
│
├── Section: Action Definition
│   ├── ArrangementGrid (extracted sub-component)
│   ├── TextInput (title, required)
│   └── textarea (description, raw — no Textarea atom exists)
│
├── Section: Referenced Records
│   ├── LinkedRecordsList (grouped by slot)
│   │   └── Card per record with remove IconButton
│   ├── Slot buttons (Button variant="secondary")
│   └── RecordPickerModal (Modal atom)
│
├── Section: Action Inputs (schema-driven)
│   ├── TextInput per text/number field
│   ├── textarea per textarea field
│   └── input[type=date] per date field
│
├── Section: Agent Routing (future slot)
│   └── Empty placeholder div, no implementation
│
├── EventPreview (shared, reused)
│   └── Full event list, no collapsed limit
│
├── Alert (success/error feedback)
│
└── Submit Footer
    ├── Text (context summary)
    └── Button (submit)
```

### Atom/Molecule Mapping

| ComposerView Element | Current Implementation | Target `@autoart/ui` Component |
|----------------------|----------------------|-------------------------------|
| Project dropdown | `<select class="composer-select">` | `Select` atom |
| Subprocess dropdown | `<select class="composer-select">` | `Select` atom |
| Title input | `<input class="composer-input">` | `TextInput` atom (required) |
| Description | `<textarea class="composer-textarea">` | Raw `<textarea>` with `--ws-*` classes (no atom exists) |
| Schema text fields | `<input class="composer-input">` | `TextInput` atom |
| Schema textareas | `<textarea class="composer-textarea">` | Raw `<textarea>` with `--ws-*` classes |
| Schema date fields | `<input type="date" class="composer-input">` | Raw `<input type="date">` with `--ws-*` classes |
| Schema number fields | `<input type="number" class="composer-input">` | `TextInput` atom (`type="number"`) |
| Section cards | `.composer-section` | `Card` atom (`shadow="sm"`, `padding="md"`, `radius="md"`) |
| Section badges | `.composer-section-badge` | `Badge` atom (`variant="default"`, `size="sm"`) |
| Arrangement cards | `.composer-arrangement-card` | Custom button with `--ws-*` tokens (same pattern as popout) |
| Linked record cards | `.composer-record-card` | `Card` atom (`padding="sm"`) with `Inline` layout |
| Add record buttons | `.composer-add-btn` | `Button` atom (`variant="secondary"`, dashed border via className) |
| Record picker modal | Inline `fixed inset-0` div | `Modal` atom |
| Submit button | `.composer-btn-success` | `Button` atom (`variant="primary"`) |
| Close button | `.composer-btn-ghost` | `IconButton` atom (`variant="ghost"`) |
| Success message | Inline green div | `Alert` atom (`variant="success"`) |
| Error message | Inline red div | `Alert` atom (`variant="error"`) |
| Event preview | `.composer-events-preview` (dark terminal) | `EventPreview` component (shared) |
| Submit footer context text | Inline `<strong>` | `Text` atom |
| Loading spinner | Emoji | `Spinner` atom |

---

## Token Strategy

### Variables to Delete (composer.css, lines 13-28)

Every `--composer-*` variable maps to an existing `--ws-*` token:

| `--composer-*` Variable | `--ws-*` Replacement |
|------------------------|---------------------|
| `--composer-bg` | `--ws-bg` |
| `--composer-card-bg` | `--ws-panel-bg` |
| `--composer-border` | `--ws-panel-border` |
| `--composer-border-active` | `--ws-accent` |
| `--composer-text` | `--ws-fg` |
| `--composer-text-muted` | `--ws-muted-fg` |
| `--composer-text-label` | `--ws-text-secondary` |
| `--composer-accent-blue` | `--ws-accent` |
| `--composer-accent-green` | `--ws-color-success` |
| `--composer-accent-purple` | Not needed (section accent removed) |
| `--composer-accent-amber` | `--ws-color-warning` |
| `--composer-shadow-sm` | Tailwind `shadow-sm` |
| `--composer-shadow-md` | Tailwind `shadow` |
| `--composer-radius` | Tailwind `rounded-xl` |
| `--composer-radius-sm` | Tailwind `rounded-lg` |

### CSS Classes to Delete

All 519 lines of `composer.css` are eliminated. Every class is either:
1. Replaced by an `@autoart/ui` atom (which uses `--ws-*` internally)
2. Replaced by Tailwind utilities using `--ws-*` token classes (e.g., `bg-ws-panel-bg`, `border-ws-panel-border`)
3. Removed entirely (animations exceeding 160ms, hover transforms, gradient backgrounds)

### Hardcoded Colors to Replace

| Hardcoded Value | Location | Replacement |
|----------------|----------|-------------|
| `from-violet-500 to-purple-600` | Header icon gradient (line 337) | Removed — use Wand2 icon with `text-ws-accent` |
| `text-red-500` | Required markers (lines 449, 504, 531, 614) | `text-ws-color-error` |
| `bg-green-50 border-green-200 text-green-700` | Success banner (line 737) | `Alert variant="success"` |
| `bg-red-50 border-red-200 text-red-700` | Error banner (line 744) | `Alert variant="error"` |
| `border-blue-300 hover:bg-blue-50` | Record picker hover (line 570) | `hover:border-ws-accent hover:bg-ws-row-expanded-bg` |
| `#0f172a` | Event preview bg (composer.css line 391) | Replaced by `EventPreview` component (uses `--ws-*`) |
| `#22c55e` | Event type color (composer.css line 412) | Replaced by `EventPreview` component |
| `linear-gradient(135deg, #3b82f6, #2563eb)` | Selected arrangement (line 432) | `bg-ws-accent text-ws-accent-fg` |
| `linear-gradient(135deg, #22c55e, #16a34a)` | Submit button (composer.css line 321) | `Button variant="primary"` |
| `hover:bg-slate-100` | Record picker close (line 559) | `hover:bg-ws-row-expanded-bg` |

---

## Agent Routing (Future Slot)

The expanded panel reserves a UI slot for agent routing — selecting which AI agent processes the declared action. This is architecture only; no implementation in this migration.

**What it means:** After the user selects an arrangement and fills fields, they can optionally route the action to a specific agent (e.g., "assign to design review agent" or "auto-classify via ML pipeline").

**Slot location:** Between Section 4 (Action Inputs) and the Event Preview.

**Slot implementation:** An empty `<div>` with a data attribute (`data-slot="agent-routing"`). No UI, no state, no API calls. The slot exists so the section ordering is established and future work doesn't require layout restructuring.

---

## What Gets Deleted

| Item | Path/Location | Reason |
|------|--------------|--------|
| `composer.css` (entire file) | `frontend/src/styles/composer.css` | All 519 lines replaced by atoms + `--ws-*` tokens |
| `composer.css` import | `frontend/src/main.tsx` (line 39) | No longer needed |
| 10 `useState` calls | `ComposerView.tsx` lines 96-109 | Replaced by `useComposerForm` |
| All `useCallback`/`useMemo` for form logic | `ComposerView.tsx` lines 125-226 | Lives in `useComposerForm` |
| Inline `handleSubmit` | `ComposerView.tsx` lines 245-303 | Lives in `useComposerForm.handleSubmit` |
| Keyboard shortcut effect | `ComposerView.tsx` lines 309-322 | Lives in `useComposerForm` (line 220-231) |
| `InlineComposer` component | `ComposerView.tsx` lines 789-827 | Dead code, exported but never imported |
| `InlineComposer` barrel export | `index.ts` lines 32-33 | Dead code |
| `ReferenceSlot` interface | `ComposerView.tsx` lines 35-42 | Duplicate; use `SchemaConfig` from shared |
| `LinkedRecord` interface | `ComposerView.tsx` lines 74-77 | Replaced by `useComposerForm.references` |
| `FieldValue` interface | `ComposerView.tsx` lines 79-82 | Replaced by `useComposerForm.fieldValues` (Map) |
| `successMessage` state | `ComposerView.tsx` line 104 | Use mutation status from hook |
| Section accent classes | composer.css lines 97-107 | Replaced by `Card` border tokens |
| Dark terminal event preview | composer.css lines 389-419 | Replaced by `EventPreview` shared component |
| All `composer-*` animation keyframes | composer.css lines 425-455 | Removed (exceed 160ms limit) |
