# Implementation Plan: ComposerView Migration

## Summary

Migrate `ComposerView` from self-contained 829-line component with custom CSS to a dual-surface-compatible panel using `useComposerForm`, `@autoart/ui` atoms, and `--ws-*` tokens. The popout (`ComposerPopoutContent`) is the reference pattern.

**Reference files:**
- `frontend/src/ui/composer/ComposerPopoutContent.tsx` (310 lines) — THE pattern to follow
- `frontend/src/ui/composer/useComposerForm.ts` (267 lines) — shared hook
- `frontend/src/ui/composer/ComposerView.tsx` (829 lines) — target of migration
- `frontend/src/styles/composer.css` (519 lines) — to be deleted

---

## Phase 1: Hook Migration + Dead Code Removal

**Goal:** Replace all inline `useState`/handler logic in ComposerView with `useComposerForm`. Remove dead exports. App remains working — UI is unchanged visually.

### Hook Gap Analysis

`useComposerForm` already provides everything ComposerView needs, with these adjustments:

| ComposerView State | useComposerForm Equivalent | Gap? |
|--------------------|-----------------------------|------|
| `userArrangementId` / `setUserArrangementId` | `setArrangementId` | No |
| `title` / `setTitle` | `title` / `setTitle` | No |
| `description` / `setDescription` | `description` / `setDescription` | No |
| `fieldValues` / `handleFieldChange` | `fieldValues` (Map) / `setFieldValue` | No — but ComposerView uses `Array<{key, value}>` while hook uses `Map<string, unknown>`. UI code that reads field values needs to switch from `.find(f => f.key === key)?.value` to `.get(key)` |
| `linkedRecords` / `handleAddRecord` / `handleRemoveRecord` | `references` / `addReference` / `removeReference` | Partial — hook stores `{sourceRecordId, targetFieldKey, mode}` but ComposerView stores `{record: DataRecord, targetFieldKey}`. Hook doesn't store the full record object. Maintain a local Map of record objects keyed by index. Hook owns the reference IDs, view owns the display names. |
| `showRecordPicker` / `currentSlot` | Not in hook | Expected — picker state is UI-only, stays in ComposerView as local `useState` |
| `successMessage` | Not in hook — hook calls `onSuccess` callback | ComposerView can use the `onSuccess` callback to set a local flash. Keep one `useState<string \| null>` for flash message. |
| `selectedSubprocessId` / `userSubprocessId` | `resolvedContextId` | Gap — hook resolves context from `options.contextId` or first subprocess. ComposerView needs the user to select a subprocess. ComposerView manages its own `subprocessId` state and passes it as `contextId` to hook. |
| `activeProjectId` / `setActiveProject` | Not in hook — hook receives `projectId` as option | ComposerView manages project selection locally, passes to hook. |
| `useProjectTree` preload | Not in hook | Keep as-is in ComposerView — panel-only side-effect. |
| `useRecords` (for record picker) | Not in hook | Keep as-is in ComposerView — picker is panel-only. |
| Keyboard shortcut (Ctrl+Enter) | Already in hook (lines 220-231) | No gap — remove duplicate from ComposerView |

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/ui/composer/ComposerView.tsx` | Remove: 10 useState calls (lines 96-109), all useMemo/useCallback for arrangement/subprocess derivation (lines 125-213), handleFieldChange/handleAddRecord/handleRemoveRecord/handleSubmit (lines 216-303), keyboard shortcut effect (lines 309-322), FieldValue interface, LinkedRecord interface, ReferenceSlot interface. Add: `useComposerForm(...)` call. Keep: `useState` for `showRecordPicker`, `currentSlot`, `successMessage`, `userProjectId`, `userSubprocessId`. Keep: `useProjects`, `useSubprocesses`, `useRecords`, `useProjectTree` hooks (panel-only data). |
| `frontend/src/ui/composer/ComposerView.tsx` | Remove: `InlineComposer` component and `InlineComposerProps` interface (lines 789-827). |
| `frontend/src/ui/composer/index.ts` | Remove: `InlineComposer` and `InlineComposerProps` exports (lines 32-33). |

### Hook Integration Pattern

```tsx
// ComposerView after Phase 1 (state section)

// Panel-only UI state
const [userProjectId, setUserProjectId] = useState<string | null>(initialProjectId || null);
const [userSubprocessId, setUserSubprocessId] = useState<string | null>(initialContextId || null);
const [showRecordPicker, setShowRecordPicker] = useState(false);
const [currentSlot, setCurrentSlot] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
const [recordDisplayNames, setRecordDisplayNames] = useState<Map<number, { id: string; name: string }>>(new Map());

// Context resolution (panel-only)
const { activeProjectId, setActiveProject } = useUIStore();
const currentProjectId = userProjectId || activeProjectId;
const { data: projects } = useProjects();
const { data: containerSubprocesses } = useSubprocesses(currentProjectId);
useProjectTree(currentProjectId);
const { data: allRecords } = useRecords();

const subprocesses = containerSubprocesses || [];
const defaultSubprocessId = subprocesses[0]?.id ?? null;
const selectedSubprocessId = userSubprocessId ?? defaultSubprocessId;

// Shared form state
const form = useComposerForm({
  projectId: currentProjectId || undefined,
  contextId: selectedSubprocessId || undefined,
  contextType,
  defaultArrangement,
  onSuccess: (actionId) => {
    setRecordDisplayNames(new Map());
    const actionType = form.selectedArrangement?.name || 'Action';
    setSuccessMessage(`${actionType} created`);
    setTimeout(() => setSuccessMessage(null), 4000);
    onSuccess?.(actionId);
  },
});
```

### Acceptance Criteria

- [ ] `ComposerView` renders identically in `ComposerPanel` (visual parity)
- [ ] Creating an action via the panel form works end-to-end (click to database and back)
- [ ] Ctrl+Enter submits from panel
- [ ] `InlineComposer` export removed; `pnpm typecheck` passes
- [ ] No `useComposerForm`-equivalent state remains inline in ComposerView

---

## Phase 2: Atom Replacement + CSS Elimination

**Goal:** Replace all raw HTML form elements with `@autoart/ui` atoms. Replace all `composer-*` CSS classes with atom styling + Tailwind `--ws-*` utilities. Delete `composer.css`.

### Section-by-Section Component Mapping

#### Header (lines 334-353)

**Current:** Gradient icon div, raw `<h1>`, raw close `<button>`

**Target:**
```tsx
<div className="flex items-center justify-between h-16 px-6 bg-ws-panel-bg border-b border-ws-panel-border shrink-0">
  <Inline gap="sm" align="center">
    <div className="w-10 h-10 rounded-lg bg-ws-accent flex items-center justify-center text-ws-accent-fg">
      <Wand2 size={20} />
    </div>
    <div>
      <Text size="sm" weight="semibold" className="text-ws-fg">Composer</Text>
      <Text size="xs" className="text-ws-text-secondary">Declare intent with Actions + Events</Text>
    </div>
  </Inline>
  {mode === 'drawer' && onClose && (
    <IconButton icon={X} onClick={onClose} variant="ghost" size="md" label="Close" />
  )}
</div>
```

Changes: Gradient removed (solid `bg-ws-accent`). `<h1>` replaced by `Text` atom. Close button replaced by `IconButton` atom.

#### Section 1: Project Context (lines 359-404)

**Current:** `.composer-section` card, raw `<select>` elements

**Target:**
```tsx
<Card shadow="sm" padding="md" radius="md">
  <Inline gap="sm" align="center" className="mb-4">
    <Badge variant="default" size="sm">1</Badge>
    <Text size="sm" weight="semibold" className="text-ws-fg">Project Context</Text>
  </Inline>
  <div className="grid grid-cols-2 gap-4">
    <Select
      label="Project"
      value={currentProjectId}
      onChange={(v) => { setUserProjectId(v); setUserSubprocessId(null); }}
      data={projectOptions}
      placeholder="Select a project..."
    />
    <Select
      label="Subprocess"
      value={selectedSubprocessId}
      onChange={setUserSubprocessId}
      data={subprocessOptions}
      placeholder="Select a subprocess..."
      disabled={!currentProjectId}
    />
  </div>
</Card>
```

Changes: `.composer-section` / `.composer-section-header` / `.composer-section-badge` / `.composer-label` / `.composer-select` all eliminated. `Card` + `Badge` + `Select` atoms.

#### Section 2: Action Definition (lines 407-471)

**Current:** `.composer-section-accent-blue` card, `.composer-arrangement-grid`, raw inputs

**Target:**
```tsx
<Card shadow="sm" padding="md" radius="md" className="border-l-2 border-l-ws-accent">
  <Inline gap="sm" align="center" className="mb-4">
    <Badge variant="info" size="sm">2</Badge>
    <Text size="sm" weight="semibold" className="text-ws-fg">Action Definition</Text>
    <Text size="xs" className="text-ws-text-secondary ml-auto">
      {form.arrangements.length} arrangement{form.arrangements.length !== 1 ? 's' : ''}
    </Text>
  </Inline>

  {/* Arrangement grid — same pattern as popout but auto-fill */}
  <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 mb-4">
    {form.arrangements.map((arrangement) => {
      const isSelected = form.selectedArrangement?.id === arrangement.id;
      return (
        <button key={arrangement.id} type="button"
          onClick={() => form.setArrangementId(arrangement.id)}
          className={clsx(
            'flex flex-col items-center gap-2 px-3 py-4 rounded-lg border-2 transition-colors',
            isSelected
              ? 'border-ws-accent bg-ws-row-expanded-bg'
              : 'border-ws-panel-border hover:border-ws-accent/30 hover:bg-ws-bg'
          )}>
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center text-lg',
            isSelected ? 'bg-ws-accent text-ws-accent-fg' : 'bg-ws-bg text-ws-muted-fg'
          )}>
            {styling?.icon || arrangement.name.charAt(0)}
          </div>
          <Text size="xs" weight="medium" className={isSelected ? 'text-ws-fg' : 'text-ws-text-secondary'}>
            {arrangement.name}
          </Text>
        </button>
      );
    })}
  </div>

  <Stack gap="sm">
    <TextInput
      label="Title"
      required
      value={form.title}
      onChange={(e) => form.setTitle(e.target.value)}
      placeholder={`Enter ${form.selectedArrangement?.name || 'action'} title...`}
      autoFocus={mode === 'page'}
    />
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-ws-fg">Description</label>
      <textarea
        value={form.description}
        onChange={(e) => form.setDescription(e.target.value)}
        placeholder="Optional description..."
        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-panel-bg focus:outline-none focus:ring-2 focus:ring-ws-accent focus:border-ws-accent resize-none"
        rows={3}
      />
    </div>
  </Stack>
</Card>
```

Changes: Gradient icon replaced by solid `bg-ws-accent`. All `composer-arrangement-*` classes eliminated. `TextInput` atom for title. Description remains raw textarea with `--ws-*` classes (no Textarea atom exists). Left border accent uses `border-l-ws-accent`.

#### Section 3: Referenced Records (lines 474-590)

**Current:** `.composer-section-accent-green` card, `.composer-record-card`, inline modal

**Target:**
```tsx
<Card shadow="sm" padding="md" radius="md" className="border-l-2 border-l-ws-color-success">
  <Inline gap="sm" align="center" className="mb-4">
    <Badge variant="success" size="sm">3</Badge>
    <Text size="sm" weight="semibold" className="text-ws-fg">Referenced Records</Text>
    <Text size="xs" className="text-ws-text-secondary ml-auto">Link to existing data</Text>
  </Inline>

  {/* Linked records grouped by slot */}
  {form.references.length > 0 && (
    <Stack gap="sm" className="mb-4">
      {/* Group by targetFieldKey, show slot label, Card per record */}
    </Stack>
  )}

  {/* Slot buttons */}
  <Inline gap="sm" className="flex-wrap">
    <Button variant="secondary" size="sm"
      leftSection={<Plus size={14} />}
      className="border-dashed"
      onClick={() => { setCurrentSlot(slotKey); setShowRecordPicker(true); }}>
      {slot.label}
    </Button>
  </Inline>

  {/* Record Picker — Modal atom */}
  <Modal open={showRecordPicker} onOpenChange={setShowRecordPicker} title="Select Record" size="lg">
    <Stack gap="xs" className="max-h-[50vh] overflow-y-auto">
      {allRecords?.slice(0, 20).map((record) => (
        <button key={record.id} type="button"
          onClick={() => handleAddRecord(record)}
          className="w-full text-left p-3 rounded-lg border border-ws-panel-border hover:border-ws-accent hover:bg-ws-row-expanded-bg transition-colors">
          <Text size="sm" weight="medium" className="text-ws-fg">{record.unique_name}</Text>
          <Text size="xs" className="text-ws-text-secondary">ID: {record.id.slice(0, 8)}...</Text>
        </button>
      ))}
    </Stack>
  </Modal>
</Card>
```

Changes: Inline fixed modal replaced by `Modal` atom. `.composer-record-card` replaced by `Card` with `Inline`. `.composer-add-btn` replaced by `Button variant="secondary"`. All hardcoded colors eliminated.

#### Section 4: Action Inputs (lines 593-673)

**Current:** `.composer-section-dashed`, `.composer-field-grid`, raw form elements

**Target:**
```tsx
{schemaFields.length > 0 && (
  <Card shadow="sm" padding="md" radius="md" className="border-dashed">
    <Inline gap="sm" align="center" className="mb-4">
      <Badge variant="default" size="sm">4</Badge>
      <Text size="sm" weight="semibold" className="text-ws-fg">Action Inputs</Text>
      <Text size="xs" className="text-ws-text-secondary ml-auto">
        From {form.selectedArrangement?.name} schema
      </Text>
    </Inline>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {schemaFields.map((field) => (
        /* TextInput for text/number, raw textarea/date input for others */
      ))}
    </div>
  </Card>
)}
```

Changes: `Card` atom with `className="border-dashed"`. `TextInput` for text and number fields.

#### Section 5: Event Preview (lines 676-732)

**Current:** Dark terminal-style inline preview with `.composer-events-preview`

**Target:** Replace entirely with shared `EventPreview` component:
```tsx
{form.hasContent && (
  <EventPreview events={pendingEvents} size="md" />
)}
```

Changes: 50+ lines of inline event rendering replaced by `EventPreview` usage. Dark terminal aesthetic eliminated — `EventPreview` uses `--ws-*` tokens.

#### Success/Error Banners (lines 735-747)

**Current:** Inline divs with hardcoded green/red Tailwind classes

**Target:**
```tsx
{successMessage && (
  <Alert variant="success">
    <Inline gap="xs" align="center">
      <CheckCircle2 size={16} />
      {successMessage}
    </Inline>
  </Alert>
)}
{form.submitError && (
  <Alert variant="error">
    {form.submitError.message || 'Failed to create action'}
  </Alert>
)}
```

#### Submit Footer (lines 750-780)

**Current:** Raw divs and button with `.composer-btn-success`

**Target:**
```tsx
<div className="flex items-center justify-between pt-4 border-t border-ws-panel-border">
  <Text size="sm" className="text-ws-text-secondary">
    {form.selectedArrangement && selectedSubprocess ? (
      <>Creating <strong>{form.selectedArrangement.name}</strong> in <strong>{selectedSubprocess.title}</strong></>
    ) : (
      'Select an arrangement and context'
    )}
  </Text>
  <Button
    variant="primary"
    onClick={form.handleSubmit}
    disabled={!form.canSubmit}
    leftSection={form.isSubmitting ? <Spinner size="sm" /> : <CheckCircle2 size={16} />}
  >
    {form.isSubmitting ? 'Creating...' : 'Create Action'}
  </Button>
</div>
```

Changes: `Spinner` atom replaces emoji. `Button variant="primary"` replaces gradient button.

### CSS Deletion

| Step | Action |
|------|--------|
| 1 | Delete `frontend/src/styles/composer.css` (entire file) |
| 2 | Remove `import './styles/composer.css';` from `frontend/src/main.tsx` line 39 |

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/ui/composer/ComposerView.tsx` | Full rewrite of render section. Imports: add `Button, TextInput, Select, Card, Stack, Inline, Text, Badge, Alert, Spinner, IconButton, Modal` from `@autoart/ui`. Add `ContextIndicator`, `EventPreview`, `buildPendingEvents` from sibling files. Remove all `composer-*` class references. |
| `frontend/src/styles/composer.css` | Delete entirely |
| `frontend/src/main.tsx` | Remove `import './styles/composer.css'` |
| `frontend/src/ui/panels/ComposerPanel.tsx` | Simplify wrapper — remove redundant Card-like wrapping if ComposerView now handles its own Card sections |

### Acceptance Criteria

- [ ] Zero `composer-*` CSS class references remain in the codebase
- [ ] `composer.css` file deleted, import removed from `main.tsx`
- [ ] All form elements use `@autoart/ui` atoms
- [ ] All colors reference `--ws-*` tokens (zero hardcoded hex, zero Tailwind color classes like `blue-500`)
- [ ] Record picker uses `Modal` atom
- [ ] Event preview uses shared `EventPreview` component
- [ ] Animations respect DESIGN.md: max 160ms, ease-out only
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] Creating an action works end-to-end

---

## Phase 3: ContextIndicator Integration + Agent Routing Slot

**Goal:** Add `ContextIndicator` to the panel header area (like popout has). Add the future agent routing slot. Clean up ComposerPanel wrapper.

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/ui/composer/ComposerView.tsx` | Add `ContextIndicator` below header (size="md", context derived from project/subprocess selection). Add agent routing slot div between Section 4 and EventPreview. |
| `frontend/src/ui/panels/ComposerPanel.tsx` | Simplify to minimal wrapper: `<div className="h-full bg-ws-bg overflow-hidden"><ComposerView mode="page" ... /></div>`. Remove redundant padding/Card wrapper since ComposerView sections now use their own Cards. |
| `frontend/src/ui/composer/index.ts` | Verify all exports are clean. Remove any stale type exports. |

### Agent Routing Slot

```tsx
{/* Agent Routing — reserved slot for future implementation */}
<div data-slot="agent-routing" />
```

No state. No UI. No API. Just the position in the DOM.

### Acceptance Criteria

- [ ] `ContextIndicator` shows project + subprocess breadcrumb in panel
- [ ] Agent routing slot exists in DOM (`data-slot="agent-routing"`)
- [ ] `ComposerPanel` is a thin wrapper (under 15 lines)
- [ ] Popout and panel both use `ContextIndicator` (shared component)

---

## Phase 4: Cleanup + Verification

**Goal:** Final pass for dead code, consistency, and end-to-end verification.

### Tasks

| Task | Detail |
|------|--------|
| Dead import scan | Run `pnpm typecheck` and verify no unused imports remain in ComposerView |
| Export audit | Verify `frontend/src/ui/composer/index.ts` exports only live code |
| Props audit | Verify `ComposerViewProps` still makes sense — `mode: 'inline'` is now dead (InlineComposer removed). Consider removing 'inline' from the union if no other consumer uses it. |
| Cross-reference | Grep for any remaining `composer-` prefixed strings in the codebase |
| Visual test | Open ComposerPanel in Dockview, compare against popout for consistency |
| Submit test | Create action from panel, verify it appears in actions list |
| Theme test | Switch workspace theme (e.g., Parchment), verify composer respects theme tokens |
| Keyboard test | Ctrl+Enter from panel submits. Ctrl+Shift+N opens popout. No conflict. |

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/ui/composer/ComposerView.tsx` | Remove `mode: 'inline'` from `ComposerViewProps` if no consumers remain. Final import cleanup. |
| `frontend/src/ui/composer/index.ts` | Final export list: `ComposerPopout`, `ComposerPopoutContent`, `useComposerForm`, `ContextIndicator`, `useDerivedContext`, `EventPreview`, `buildPendingEvents`, `ComposerView` |

### Acceptance Criteria

- [ ] `pnpm typecheck` clean
- [ ] `pnpm build` clean
- [ ] `pnpm lint` clean
- [ ] Zero `--composer-*` variables in codebase
- [ ] Zero `composer-` prefixed CSS classes in codebase
- [ ] Action creation works from both popout and panel
- [ ] Theme switching works without visual breakage

---

## Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| `useComposerForm` context resolution differs from ComposerView's explicit selection | Form submits to wrong subprocess | Phase 1 keeps explicit `contextId` pass-through. Panel manages its own project/subprocess state and passes resolved ID to hook. |
| `fieldValues` type mismatch (Array vs Map) | Runtime errors when reading field values | Phase 1 must update all `.find(f => f.key === key)?.value` to `.get(key)` in one pass. |
| Reference display names lost | Linked records show IDs instead of names | Local `recordDisplayNames` Map in ComposerView stores `{id, name}` keyed by reference index. Populated on `handleAddRecord`, cleared on form reset. |
| Record picker modal behavior change | Radix Dialog traps focus differently than inline div | Test with keyboard navigation. Modal atom uses Radix Dialog which handles focus trap properly — this is an improvement. |
| `composer.css` removal breaks something else | Unexpected visual regression | `composer-*` classes are only used in `ComposerView.tsx` and `composer.css`. No other consumers. |
| `mode='inline'` removal breaks an import | Build failure | `InlineComposer` is only defined and exported, never imported. Safe to remove. |
| Animations removed affect perceived performance | UI feels abrupt | DESIGN.md says 120-160ms ease-out. The new atoms already follow this. The removed 250-300ms animations were violating the design system. |

---

## Out of Scope

- Agent routing implementation (UI, state, API) — only the DOM slot is added
- New features for the composer (file attachments, templates, drafts)
- `InspectorFooterComposer` (the deprecated note references it but it's a separate component)
- `useComposerForm` hook changes beyond what's needed for ComposerView integration
- `ComposerPopoutContent` changes (it's the reference, not the target)
- `Textarea` atom creation (raw `<textarea>` with `--ws-*` classes is acceptable per popout pattern)
- Mobile/responsive considerations (workspace is desktop-only)
- Dark mode testing (tokens handle this automatically via theme system)
