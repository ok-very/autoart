---
name: design
description: AutoArt design system — color palette, typography, layout rules, interaction patterns, CSS variables, dark mode, and the non-negotiable principle for cognitive safety.
user-invocable: false
---

# AutoArt Design System

## Philosophy

This palette says: *"You can put heavy things here. They won't be judged or lost."*

- **Sensitivity to cognitive overload** - Colors never compete with structure
- **Systems that hold complexity without shouting** - Muted, archival aesthetic
- **Distrust of trend-driven aesthetics** - Durable tools over fashionable ones
- **Tools that feel durable enough to trust emotionally** - Material metaphors

### Core Principles

1. Color never competes with structure
2. No color for decoration alone
3. Motion replaces color where possible
4. Dark mode is material inversion, not rebrand

---

## Typography

### Primary Typeface: Source Serif 4

Body text, table content, metadata, form labels.

- Weights: Regular (400), Semibold (600) for headings
- No bold body copy ever

```css
font-family: "Source Serif 4", serif;
font-optical-sizing: auto;
```

### Secondary Typeface: Source Sans 3 (UI-only)

Buttons, small UI chrome, dropdowns, toggles, system messages.

- Never for content - if text represents user data, it's serif

### Console Font: IBM Plex Mono

System-generated IDs, schema keys, hashes, audit logs, readonly output.

- Never for user-entered text, buttons, tooltips, or emotional content
- Ligatures off always

```css
font-family: "IBM Plex Mono", monospace;
font-feature-settings: "liga" 0;
```

### Type Scale (hard limits)

| Role | Size | Weight |
|------|------|--------|
| H1 (page title) | 20px | 600 |
| H2 (section) | 16px | 600 |
| Body / Table | 14px | 400 |
| Metadata | 12px | 400 |
| Microcopy | 11px | 400 |

- Line-height: 1.45-1.55
- Letter-spacing: normal (no tightening)

---

## Layout (Ledger Logic)

- Left-aligned everything
- No centered content blocks
- No cards unless data is ephemeral
- Tables are first-class citizens
- Spacing: 4px base, vertical rhythm > horizontal symmetry
- Whitespace communicates permission to stop

### Row Behavior

- **Collapsed:** identifier, phase, completion state only
- **Expanded:** fields inline, no modal interruptions
- If something needs a modal, the system is lying

---

## Core Palette

### Foundation Neutrals

| Name | Hex | Purpose |
|------|-----|---------|
| Parchment | `#F5F2ED` | Primary background |
| Ash Taupe | `#D6D2CB` | Secondary surfaces, borders |
| Charcoal Ink | `#2E2E2C` | Primary text |

### Structural Accents

| Name | Hex | Purpose |
|------|-----|---------|
| Oxide Blue | `#3F5C6E` | Active/focused elements, primary accent |
| Burnt Umber | `#8A5A3C` | Metadata emphasis, secondary accent |

### System Feedback

| Name | Hex | Purpose |
|------|-----|---------|
| Moss Green | `#6F7F5C` | Success / complete / stable |
| Desaturated Amber | `#B89B5E` | Warning / attention / incomplete |
| Iron Red | `#8C4A4A` | Error / risk (use sparingly) |

---

## Color Application

### Backgrounds

- App: `#F5F2ED`
- Table: transparent
- Expanded row: `rgba(63, 92, 110, 0.04)`
- If you can see the color, it's too much

### Text

| Role | Hex |
|------|-----|
| Primary | `#2E2E2C` |
| Secondary | `#5A5A57` |
| Disabled | `#8C8C88` |

No pure black. No opacity hacks.

### Accents (Strict Rules)

- **Oxide Blue `#3F5C6E`:** active row, focused input border, single primary action button
- **Burnt Umber `#8A5A3C`:** phase labels, schema categories, archival metadata (communicates time)

### Status Colors

- **Moss Green `#6F7F5C`:** completion dot only
- **Amber `#B89B5E`:** incomplete-but-acknowledged
- **Iron Red `#8C4A4A`:** data conflict, not absence
- No banners. No alerts. No exclamation marks.

---

## Interaction Rules

1. **Tables, rows, hierarchy come first.** Color only clarifies.
2. **Every accent maps to:** state, selection, status, or meaning.
3. **Soft expansion, opacity shifts > color changes.**
4. **Dark mode:** Charcoal->bg, Parchment->text, accents stay muted.

### Focus

- Ring: 1px oxide blue
- No glow, no animation longer than 120ms
- Focus should feel like attention, not excitement

### Motion

- Expand/collapse: opacity + height
- Easing: ease-out only
- Duration: 120-160ms
- If motion is noticeable, it's indulgent

### Empty States

- There are no empty states
- Fields exist but are blank
- Labels remain visible
- System does not comment
- Silence is a feature

### Copy Rules

- Declarative, not encouraging
- No second-person hype ("you can...")
- No jokes, no apology language
- Example: "3 fields unfilled" NOT "You still need to complete..."

---

## Console Font Treatment

- Size: 13px
- Weight: 400 only
- Line-height: 1.4
- Color: `#3A3A38` (lighter than body)
- Dark mode: `#D0CDC7`

### Background Options

Option A: Subtle wash
```css
background: rgba(63, 92, 110, 0.035);
```

Option B: Left border
```css
border-left: 2px solid rgba(63, 92, 110, 0.2);
```

Never animated, never bold/italic.

---

## CSS Variable Mapping

The workspace theme system uses CSS custom properties defined in:
`frontend/src/workspace/themes/variables.css`

### Parchment Theme Variables

```css
/* Foundation Neutrals */
--ws-bg: #F5F2ED;           /* Parchment */
--ws-fg: #2E2E2C;           /* Charcoal Ink */
--ws-muted-fg: #6B6560;     /* Derived muted */

/* Text Hierarchy */
--ws-text-primary: #2E2E2C;
--ws-text-secondary: #5A5A57;
--ws-text-disabled: #8C8C88;

/* Structural Accent */
--ws-accent: #3F5C6E;       /* Oxide Blue */
--ws-accent-fg: #FFFFFF;

/* Secondary Accent */
--ws-accent-secondary: #8A5A3C;  /* Burnt Umber */

/* System Feedback */
--ws-color-success: #6F7F5C;     /* Moss Green */
--ws-color-warning: #B89B5E;     /* Desaturated Amber */
--ws-color-error: #8C4A4A;       /* Iron Red */
--ws-color-info: #3F5C6E;        /* Oxide Blue */

/* Console/Mono */
--ws-mono-fg: #3A3A38;
--ws-mono-bg: rgba(63, 92, 110, 0.035);

/* Expanded Row */
--ws-row-expanded-bg: rgba(63, 92, 110, 0.04);
```

---

## Dark Mode (Material Inversion)

Dark mode inverts the foundation while keeping accents muted:

| Light | Dark | Role |
|-------|------|------|
| Parchment `#F5F2ED` | `#1F1F1D` | Background |
| Charcoal Ink `#2E2E2C` | `#EAE7E2` | Text |
| Ash Taupe `#D6D2CB` | `#4A4845` | Borders |
| Oxide Blue `#3F5C6E` | `#5B7A8C` | Accent (lightened) |

- Reduced contrast overall
- For late, tired cognition, not aesthetics

---

## Usage Guidelines

### When to Use Each Color

| Color | Use For | Don't Use For |
|-------|---------|---------------|
| Parchment | Page backgrounds, panel backgrounds | Text, icons |
| Ash Taupe | Borders, dividers, secondary backgrounds | Primary actions |
| Charcoal Ink | Body text, headings, icons | Backgrounds |
| Oxide Blue | Selected items, focused inputs, primary buttons | Decorative elements |
| Burnt Umber | Metadata labels, secondary emphasis | Primary actions |
| Moss Green | Success states, completed items | Warnings |
| Desaturated Amber | Incomplete items, attention needed | Errors |
| Iron Red | Errors, destructive actions | Warnings, info |

### Feedback Color Saturation

Our feedback colors are intentionally desaturated compared to typical "traffic light" palettes:

- **Standard palette:** `#22c55e` (green), `#eab308` (yellow), `#ef4444` (red)
- **Our palette:** `#6F7F5C` (moss), `#B89B5E` (amber), `#8C4A4A` (iron)

This reduces visual noise and cognitive load while still providing clear status indication.

---

## The Non-Negotiable Principle

> If someone opens AutoArt at 2:14am with their stomach tight and their brain fried, the interface must say — without words:
>
> **"Nothing bad will happen if you stop here."**
>
> Everything above serves that sentence.
