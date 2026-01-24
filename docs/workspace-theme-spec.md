# Workspace Theme Specification

> **Instructions for Designer**: Fill out each section below. Leave blank any values you want to inherit from the default theme. Use CSS color values (hex, rgb, hsl) and standard CSS units (px, rem, %).

---

## Theme Identity

| Field | Value |
|-------|-------|
| **Theme ID** | *(lowercase-kebab-case, e.g., `glass-dark`)* |
| **Display Name** | |
| **Description** | *(one sentence)* |
| **Density** | ☐ compact · ☐ default · ☐ comfortable |
| **Variant** | ☐ solid · ☐ floating · ☐ minimal · ☐ glass |

---

## 1. Workspace Container

The background area behind all panels.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-bg` | `#f8fafc` | |
| `--ws-fg` | `#1e293b` | |
| `--ws-muted-fg` | `#64748b` | |
| `--ws-accent` | `#3b82f6` | |
| `--ws-accent-fg` | `#ffffff` | |

---

## 2. Panel Group / Frame

The container around each group of tabs.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-group-bg` | `#ffffff` | |
| `--ws-group-border` | `#e2e8f0` | |
| `--ws-group-radius` | `0px` | |
| `--ws-group-shadow` | `none` | |
| `--ws-group-padding` | `0px` | |

### Active Group Highlight

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-group-active-ring` | `0px` | |
| `--ws-group-active-ring-color` | `var(--ws-accent)` | |

---

## 3. Tab Strip

The horizontal bar containing tabs.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tabstrip-bg` | `#f1f5f9` | |
| `--ws-tabstrip-border` | `#e2e8f0` | |
| `--ws-tabstrip-height` | `36px` | |

---

## 4. Individual Tabs

### Dimensions

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tab-height` | `32px` | |
| `--ws-tab-padding-x` | `12px` | |
| `--ws-tab-padding-y` | `6px` | |
| `--ws-tab-gap` | `2px` | |
| `--ws-tab-radius` | `0px` | |

### Colors — Default State

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tab-fg` | `#64748b` | |
| `--ws-tab-bg` | `transparent` | |
| `--ws-tab-border` | `transparent` | |

### Colors — Hover State

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tab-fg-hover` | `#475569` | |
| `--ws-tab-bg-hover` | `#e2e8f0` | |

### Colors — Active State

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tab-fg-active` | `#1e293b` | |
| `--ws-tab-bg-active` | `#ffffff` | |
| `--ws-tab-border-active` | `var(--ws-accent)` | |

### Active Indicator (underline/pill)

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tab-indicator-height` | `2px` | |
| `--ws-tab-indicator-color` | `var(--ws-accent)` | |
| `--ws-tab-indicator-radius` | `1px` | |

### Tab Icon

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tab-icon-size` | `14px` | |
| `--ws-tab-icon-gap` | `6px` | |

### Close Button

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-tab-close-size` | `16px` | |
| `--ws-tab-close-hover-bg` | `#cbd5e1` | |
| `--ws-tab-close-hover-fg` | `#1e293b` | |

---

## 5. Panel Content Area

The main content region inside each panel.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-panel-bg` | `#ffffff` | |
| `--ws-panel-fg` | `#1e293b` | |
| `--ws-panel-padding` | `0px` | |
| `--ws-panel-border` | `#e2e8f0` | |

### Scrollbars

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-scrollbar-width` | `8px` | |
| `--ws-scrollbar-track` | `#f1f5f9` | |
| `--ws-scrollbar-thumb` | `#cbd5e1` | |
| `--ws-scrollbar-thumb-hover` | `#94a3b8` | |

---

## 6. Splitters / Resize Handles

The draggable dividers between panels.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-sash-size` | `4px` | |
| `--ws-sash-hit-size` | `8px` | |
| `--ws-sash-bg` | `transparent` | |
| `--ws-sash-bg-hover` | `var(--ws-accent)` | |
| `--ws-sash-bg-active` | `var(--ws-accent)` | |
| `--ws-sash-opacity-hover` | `0.5` | |
| `--ws-sash-opacity-active` | `0.8` | |

---

## 7. Drag & Drop

Visual feedback during panel dragging.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-drop-target-bg` | `rgba(59, 130, 246, 0.1)` | |
| `--ws-drop-target-border` | `var(--ws-accent)` | |
| `--ws-drop-target-radius` | `4px` | |
| `--ws-drag-ghost-opacity` | `0.8` | |
| `--ws-drag-ghost-scale` | `0.95` | |

---

## 8. Motion / Animation

Timing for all transitions.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-motion-duration-fast` | `100ms` | |
| `--ws-motion-duration` | `150ms` | |
| `--ws-motion-duration-slow` | `300ms` | |
| `--ws-motion-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | |
| `--ws-motion-ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | |

---

## 9. Focus States

Keyboard navigation and accessibility.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-focus-ring-width` | `2px` | |
| `--ws-focus-ring-color` | `var(--ws-accent)` | |
| `--ws-focus-ring-offset` | `2px` | |

---

## 10. Empty State / Watermark

Shown when workspace has no panels.

| Token | Default | Your Value |
|-------|---------|------------|
| `--ws-watermark-bg` | `#f8fafc` | |
| `--ws-watermark-fg` | `#94a3b8` | |
| `--ws-watermark-icon-size` | `48px` | |

---

## 11. Custom CSS Overrides (Optional)

Add any additional CSS rules needed for this theme. These will be scoped to `[data-workspace-theme="your-theme-id"]`.

```css
/* Example: */
/* [data-workspace-theme="your-theme-id"] .groupview { ... } */
```

---

## 12. Behavior Specifications (Optional)

Describe any interactive behaviors this theme should have.

### Panel Open Animation
- [ ] Fade in
- [ ] Slide from direction: ___________
- [ ] Scale up
- [ ] None
- Duration: ___________

### Panel Close Animation
- [ ] Fade out
- [ ] Slide to direction: ___________
- [ ] Scale down
- [ ] None
- Duration: ___________

### Tab Strip Visibility
- [ ] Always visible
- [ ] Hide when single tab
- [ ] Hide until hover
- [ ] Hide until group is focused

### Sash (Resize Handle) Visibility
- [ ] Always visible
- [ ] Show on hover only
- [ ] Show with grab indicator

### Active Group Feedback
- [ ] Ring/outline
- [ ] Shadow increase
- [ ] Background tint
- [ ] Border color change
- [ ] None

---

## 13. Mockups / References

Attach or link any visual references:

| Item | Link/Filename |
|------|---------------|
| Tab strip mockup | |
| Active state mockup | |
| Full layout mockup | |
| Inspiration/reference | |

---

## 14. Accessibility Notes

| Requirement | Confirmed |
|-------------|-----------|
| Color contrast ratio ≥ 4.5:1 for text | ☐ |
| Focus states clearly visible | ☐ |
| No motion for `prefers-reduced-motion` | ☐ |

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Designer | | |
| Engineer | | |

---

*Once complete, hand this document to engineering. They will create a theme file at:*
`frontend/src/workspace/themes/presets/{theme-id}.ts`
