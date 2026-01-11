# AutoArt — Semantic UI Refactor Plan

**Purpose**  
Stabilize the frontend by introducing a *semantic UI enforcement layer* that binds reusable UI elements directly to domain logic and persistence rules, eliminating ad‑hoc CRUD wiring and reducing debugging overhead.

This plan assumes the current refactor baseline (shared domain, FieldViewModel, UI layering) is correct and intentionally **builds on it**, not around it.

---

## 1. Diagnosis: Current State (Why Bugs Persist)

The recent refactor successfully established:

- A shared domain layer (`shared/src/domain`)
- A hard `FieldViewModel` boundary
- A formal UI layering model (atoms / molecules / composites)

However, UI breakage persists because:

1. **CRUD logic is still implicit**  
   Persistence and mutation are re‑implemented across composites and drawers.

2. **Reusability is visual, not semantic**  
   Components share appearance but not behavioral guarantees.

3. **Components do not declare domain dependencies**  
   When something fails, the system provides no clear violation signal.

The system is structurally sound but ergonomically fragile.

---

## 2. Core Insight

> A reusable UI system must enforce *meaning*, not just shape.

AutoArt requires UI elements that are *domain‑aware*, *CRUD‑aware*, and *self‑policing*.

This is not a design system.  
This is a **semantic UI runtime**.

---

## 3. Proposal: Introduce a Semantic UI Layer

Add a new top‑level UI layer:

```
frontend/src/ui/
  atoms/
  molecules/
  composites/
  semantic/
```

### Definition

**Semantic components** are the *only* UI elements allowed to:

- Access domain state
- Trigger mutations
- Call APIs
- Perform validation or rollback

All lower layers become **render‑only**.

---

## 4. Design Rules (Hard Constraints)

### 4.1 Import Boundaries

| Layer | May Import | May NOT Import |
|-----|----------|---------------|
| atoms | nothing | domain, API |
| molecules | atoms | domain, API |
| composites | atoms, molecules | API, domain logic |
| semantic | domain, API, composites | nothing above |

Violations should be considered bugs, not style issues.

---

### 4.2 Ownership Rules

| Concern | Owner |
|------|------|
| Field visibility | shared/domain |
| Required/optional | shared/domain |
| Reference resolution | backend + shared/domain |
| Mutation + persistence | semantic UI |
| Rendering | atoms/molecules |

No exceptions.

---

## 5. First‑Class Semantic Primitives

### 5.1 `FieldEditor`

**Purpose:** Single, canonical way to edit any domain field.

```tsx
<FieldEditor
  projectId={projectId}
  recordId={recordId}
  fieldId="budget_estimate"
/>
```

**Responsibilities:**
- Fetch `FieldViewModel`
- Render correct molecule
- Apply validation
- Persist changes
- Handle loading / error / rollback
- Emit UI context metadata

**Explicitly Forbidden:**
- `onChange` props
- Inline API calls
- Schema conditionals in JSX

---

### 5.2 `ReferenceEditor`

Canonical editor for record‑to‑record links.

Responsibilities:
- Display resolved reference state
- Handle broken / dynamic / static references
- Persist reference updates

---

### 5.3 `PhaseGateAction`

Encapsulates phase progression rules.

```tsx
<PhaseGateAction phase="budgeting" />
```

- Calls `canAdvancePhase`
- Displays blocking reasons
- Performs mutation if allowed

---

## 6. Refactor Strategy (Incremental, Low Risk)

### Phase 1 — Create Semantic Layer Skeleton

- [ ] Add `ui/semantic/` directory
- [ ] Add `FieldEditor.tsx` (initial implementation)
- [ ] Enforce import rules manually

No existing components removed yet.

---

### Phase 2 — Replace Two High‑Churn Usages

Refactor exactly **two** existing field editors to use `FieldEditor`:

Suggested targets:
- `RecordPropertiesView`
- `LinkFieldInput`

Goal: validate ergonomic relief, not coverage.

---

### Phase 3 — Remove Manual Wiring Paths

- [ ] Delete duplicated save handlers
- [ ] Remove inline API calls from composites
- [ ] Collapse schema conditionals into domain

This phase reduces bug surface dramatically.

---

## 7. Tooling & Enforcement (Optional but Recommended)

### 7.1 Lint Rules (Future)

- Disallow API imports below `semantic/`
- Disallow `onChange` props on domain fields
- Warn on JSX schema conditionals

### 7.2 Runtime Assertions (Dev‑Only)

- Assert semantic components are mutation source
- Log violations with UI context

---

## 8. Why This Avoids the "Monday.com" Trap

Monday.com:
- Abstracts domain meaning
- Optimizes for generic workflows

AutoArt (with semantic UI):
- Preserves domain specificity
- Makes incorrect usage *hard*
- Optimizes for cognitive continuity

This system is closer to an **internal tool for thinking** than a PM platform.

---

## 9. Success Criteria

This refactor is successful when:

- New UI elements rarely require debugging
- CRUD wiring is invisible to most components
- Broken behavior points to one of two layers (domain or semantic UI)
- Adding a field feels boring, not stressful

---

## 10. Non‑Goals (Explicit)

- Not a public component library
- Not pixel‑perfect theming
- Not supporting arbitrary schemas

The goal is *stability and meaning*, not flexibility.

---

## 11. Next Action (Single Step)

Implement **`FieldEditor`** fully.

Do not proceed until it feels relieving to use.

If it doesn’t, the abstraction is wrong.

