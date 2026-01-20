# Long-term Workspace Schema (SPA)

This document defines the long-term UI/UX *schema* for AutoArt’s single-page application (SPA) workspace: how “apps” (Mail, Composer, Registry, etc.) present as dockable panels, how transient workflows are shown, and how multi-window popouts stay synchronized.

## Core primitives

### Surface (aka Panel)
A **Surface** is a long-lived user workspace area rendered as a Dockview panel (tab) and/or Dockview group (split). Surfaces represent “applications” (Mail, Projects, Registry, Composer, Workbench, SelectionInspector, etc.).

**Surface characteristics**
- Long-lived; can remain open for an entire session.
- Can be moved, docked, split, and (when supported) popped out into its own OS/browser window.
- Owns its own view-specific navigation and may include its own **left sidebar**.

### Left drawers (view-owned)
“Left drawers” are **view-specific sidebars** owned by a Surface. They remain local UI concerns and are *not* managed by the global overlay system.

### Overlay (global bottom drawer)
An **Overlay** is a global, transient workflow host (historically “bottom drawer”) used for actions like create/confirm/picker flows.

Overlays are:
- Short-lived.
- Global (can be opened from any Surface).
- Declarative (metadata + contracts in an OverlayRegistry).

## Registries (single sources of truth)

### PanelRegistry (Dockview)
A registry mapping stable panel IDs → lazy-loaded Surface components.

Examples of stable IDs:
- `workbench`
- `composer`
- `projects`
- `registry`
- `mail.inbox`
- `inspector.selection`

### OverlayRegistry (refactor of DrawerRegistry)
A registry mapping overlay IDs → overlay definitions + view loaders.

Overlay definitions should remain the single source of truth for:
- title
- size
- dismissibility / close behavior
- declared side effects (for auditability)
- runtime contracts (context schema; optionally result schema)

## Workspace lifecycle

### Default boot
- The app boots into a “Workbench” route/shell.
- If the Dockview layout is empty/unavailable, the Workbench renders an **App Launch Menu** (empty state) that can open at least one Surface and/or restore the default layout.

### Persistence
- Workspace layout is persisted per browser profile via Zustand `persist` and explicitly whitelisted via the store’s `partialize`.
- Overlay preferences should be persisted only if needed (minimal).

## Multi-window: popouts + synchronization

### One abstraction, two transports
Implement a single “Context Bus” abstraction that supports:
- **Web transport**: BroadcastChannel (for multiple tabs/windows under the same origin).
- **Electron transport**: IPC (main-process hub).

This allows shipping the same UX in web hosting first and swapping transports later without rewriting Surface logic.

### SelectionContext (global)
A shared SelectionContext represents the user’s current focus, allowing Surfaces (and SelectionInspector) to coordinate.

Minimum supported kinds:
- hierarchy node selection (Project/Process/Stage/Subprocess/Task)
- record selection
- email selection

Surfaces publish selection updates; other surfaces subscribe.

## Email ↔ Record/Action mappings
Mappings between emails and AutoArt entities should be visible and editable in:
- SelectionInspector (primary)
- Mail surface (secondary)

Transient flows (pick record, confirm unlink, etc.) should be implemented via Overlays, not embedded bespoke modals.

## Related issues
- #62 Multi-window popouts + context sync
- #63 Dockview workspace layout
- #64 Electron SPA shell
- #65 SelectionInspector surface
- #66 Mail surface
- #67 OverlayRegistry refactor
