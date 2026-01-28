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

## Interaction Rules

1. **Tables, rows, hierarchy come first.** Color only clarifies.
2. **Every accent maps to:** state, selection, status, or meaning.
3. **Soft expansion, opacity shifts > color changes.**
4. **Dark mode:** Charcoal→bg, Parchment→text, accents stay muted.

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
```

---

## Dark Mode (Material Inversion)

Dark mode inverts the foundation while keeping accents muted:

| Light | Dark | Role |
|-------|------|------|
| Parchment `#F5F2ED` | Charcoal Ink `#2E2E2C` | Background |
| Charcoal Ink `#2E2E2C` | Parchment `#F5F2ED` | Text |
| Ash Taupe `#D6D2CB` | `#4A4845` | Borders |
| Oxide Blue `#3F5C6E` | `#5B7A8C` | Accent (lightened) |

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
