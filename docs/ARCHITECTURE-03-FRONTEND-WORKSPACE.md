# Frontend Workspace & Surfaces

**Part of:** [Architecture Documentation Series](./ARCHITECTURE-00-INDEX.md)  
**Last Updated:** 2026-01-29

## Overview

This document defines the long-term UI/UX architecture for AutoArt's single-page application (SPA) workspace: how "apps" (Mail, Composer, Registry, etc.) present as dockable panels, how transient workflows are shown, and how multi-window popouts stay synchronized.

---

## Core Primitives

### Surface (aka Panel)

A **Surface** is a long-lived user workspace area rendered as a Dockview panel (tab) and/or Dockview group (split). Surfaces represent "applications" (Mail, Projects, Registry, Composer, Workbench, SelectionInspector, etc.).

**Surface characteristics:**
- Long-lived; can remain open for an entire session
- Can be moved, docked, split, and (when supported) popped out into its own OS/browser window
- Owns its own view-specific navigation and may include its own **left sidebar**
- Registered in the **PanelRegistry**

**Examples:**
- `workbench` - Main working surface
- `composer` - Action creation surface
- `projects` - Project browser
- `registry` - Definition/template registry
- `mail.inbox` - Mail inbox surface
- `inspector.selection` - Selection inspector

---

### Left Drawers (View-Owned)

"Left drawers" are **view-specific sidebars** owned by a Surface. They remain local UI concerns and are *not* managed by the global overlay system.

**Characteristics:**
- Owned and controlled by individual surfaces
- Surface-specific navigation, filters, or tools
- Not shared across surfaces
- Not persisted globally (only within surface state)

**Examples:**
- Mail surface left sidebar: folder tree, filters
- Projects surface left sidebar: hierarchy navigation
- Composer surface left sidebar: action templates, recent actions

---

### Overlay (Global Bottom Drawer)

An **Overlay** is a global, transient workflow host (historically "bottom drawer") used for actions like create/confirm/picker flows.

**Overlay characteristics:**
- Short-lived (modal-like but docked)
- Global (can be opened from any Surface)
- Declarative (metadata + contracts in an OverlayRegistry)
- Dismissible

**Examples:**
- `create-record` - Create new record
- `assign-records` - Assign records to a node
- `confirm-delete` - Deletion confirmation
- `view-record` - Quick record view/edit

**Usage:**
```typescript
const overlay = useOverlay();

overlay.open('create-record', {
  definitionId: 'abc-123',
  projectId: 'xyz-789'
});
```

---

## Registries (Single Sources of Truth)

### PanelRegistry (Dockview)

A registry mapping stable panel IDs → lazy-loaded Surface components. Defined in `frontend/src/workspace/panelRegistry.ts`.

**Panel Taxonomy (16 panels):**

| Category | Panel ID | Purpose |
|---|---|---|
| **Core** | `center-workspace` | Main workspace container (permanent, always visible) |
| **Tool** | `selection-inspector` | Details for selected records/definitions/actions/nodes |
| | `classification` | Classification panel for import sessions |
| | `search-results` | Global search results display |
| | `mail-panel` | Mail interface |
| **Registry** | `records-list` | Database records listing |
| | `fields-list` | Schema fields listing |
| | `actions-list` | Actions registry listing |
| | `events-list` | Events log listing |
| **Workbench** | `import-workbench` | Import workflow interface |
| | `export-workbench` | Export workflow interface |
| | `composer-workbench` | Action/event composition interface |
| | `intake-workbench` | Intake form processing |
| | `artcollector-workbench` | Image/asset collection interface |
| **Project** | `project-panel` | Project management and metadata |

Each panel definition includes metadata for title, icon, default placement area (center/right/bottom/left), a visibility predicate (`shouldShow`), and action capability (`canActOn`).

**Responsibilities:**
- Lazy-load surface components
- Provide surface metadata (title, icon, placement)
- Context-aware visibility via `shouldShow()` predicates
- Support Zod-validated context schemas per panel

---

### OverlayRegistry

A registry mapping overlay IDs → overlay definitions + view loaders. Defined in `frontend/src/ui/registry/OverlayRegistry.tsx`.

**Registered overlay types (20):**

| Overlay ID | Purpose |
|---|---|
| `create-node` | Create hierarchy node |
| `create-record` | Create new record |
| `create-project` | Create new project |
| `create-definition` | Create record definition |
| `create-link` | Create record link |
| `add-field` | Add field to definition |
| `assign-records` | Assign records to a node |
| `classify-records` | Legacy alias for `assign-records` |
| `clone-definition` | Clone a definition |
| `clone-project` | Clone a project |
| `confirm-delete` | Deletion confirmation |
| `confirm-unlink` | Unlink confirmation |
| `view-definition` | View/edit definition |
| `project-library` | Browse project library |
| `template-library` | Alias for `project-library` |
| `monday-boards` | Monday.com board import |
| `integrations` | External integrations |
| `start-collection` | Start art collection session |
| `classification` | Record classification |
| `amend-action` | Amend an existing action |

**Overlay definitions are the single source of truth for:**
- title
- size (sm/md/lg/xl/full)
- dismissibility / close behavior
- declared side effects (for auditability)
- runtime contracts (context schema; optionally result schema)

**Design properties:**
- No duplicated switch statement
- Runtime validation via Zod schemas
- Unified mapping (definitions + loaders in one place)
- Type-safe context and result types

---

## Workspace Presets

Defined in `frontend/src/workspace/workspacePresets.ts`. Each preset configures panel layout and content routing for a specific workflow stage.

**7 built-in presets:**

| ID | Label | Scope | Panels | Purpose |
|---|---|---|---|---|
| `collect` | 0. Collect | global | center-workspace (artcollector), selection-inspector | Import wizard & classification |
| `intake` | 1. Intake | global | center-workspace (intake) | Form intake & dashboard |
| `plan` | 2. Plan | project | center-workspace (projects/workflow), selection-inspector | Hierarchy view for task planning |
| `act` | 3. Act | project | center-workspace (projects/workflow), selection-inspector, composer-workbench | Registry view with composer execution |
| `review` | 4. Review | subprocess | center-workspace (projects/log), selection-inspector | Log view for reviewing completed work |
| `deliver` | 5. Deliver | project | center-workspace (export) | Export workbench for final output |
| `desk` | Desk | global | project-panel (×3), mail-panel | Multi-project dashboard view |

**Scope types:** `global` (no project context), `project` (single project), `subprocess` (single subprocess within project).

---

## Workspace Theme System

Defined in `frontend/src/workspace/themes/`. Self-registering theme modules that provide CSS variables, inline styles, component overrides, and behavior hooks.

**Theme architecture:**
- CSS variable contract: `frontend/src/workspace/themes/variables.css` (70+ variables)
- Registry: `workspaceThemeRegistry` singleton with subscribe support
- Hook: `useWorkspaceTheme` for component-level theme access
- Types: `ThemeDensity` (compact | default | comfortable), `ThemeVariant` (solid | floating | minimal | glass)

**5 built-in theme presets** (in `themes/presets/`):

| ID | Density | Variant | Purpose |
|---|---|---|---|
| `default` | default | solid | Clean, professional workspace layout |
| `compact` | compact | solid | Dense layout (smaller tabs, reduced padding) |
| `floating` | default | floating | Elevated panels with shadows & rounded corners |
| `minimal` | comfortable | minimal | Hidden chrome, maximum content (hide on hover) |
| `parchment` | default | solid | Warm archival aesthetic (AutoArt Design System) |

---

## Content Routing

Defined in `frontend/src/ui/workspace/CenterContentRouter.tsx` + `content/` adapters.

**Pattern:** `CenterContentRouter` → Content Adapter → Composite View

The `CenterContentRouter` is the permanent component inside `center-workspace`. It reads `useUIStore((s) => s.centerContentType)` and dispatches to the appropriate content adapter.

**6 content types:**

| Type | Adapter | Source View |
|---|---|---|
| `projects` | `ProjectContentAdapter` | Projects domain |
| `artcollector` | `ArtCollectorContent` | ArtCollectorWizardView |
| `intake` | `IntakeContent` | IntakeDashboard / IntakeEditorView |
| `export` | `ExportContent` | Export workflow |
| `mail` | `MailContent` | Mail workflow |
| `calendar` | `CalendarContent` | Calendar view |

Content adapters are thin wrappers (`ui/workspace/content/`) that embed existing composite views as center content, maintaining internal state as needed (e.g., `IntakeContent` tracks `editingFormId`).

---

## Workspace Lifecycle

### Default Boot

1. App boots into a "Workbench" route/shell
2. Zustand workspace store attempts to restore persisted layout
3. If layout is empty/invalid:
   - Workbench renders an **App Launch Menu** (empty state)
   - Launch menu offers:
     - "Open Mail"
     - "Open Inspector"
     - "Restore default layout"

### Default Layout

A stable default layout config provides:
- One main content group (Workbench)
- SelectionInspector docked to the right
- Sensible split proportions

```typescript
const DEFAULT_LAYOUT = {
  orientation: 'horizontal',
  groups: [
    {
      panels: [{ id: 'workbench' }],
      size: 70,
    },
    {
      panels: [{ id: 'inspector.selection' }],
      size: 30,
    },
  ],
};
```

### Persistence

- Workspace layout is persisted per browser profile via Zustand `persist`
- Explicitly whitelisted via the store's `partialize` function
- Overlay preferences are minimally persisted (e.g., last size if needed)

**Zustand persistence pattern:**
```typescript
interface WorkspaceState {
  layout: DockviewLayout | null;
  lastActiveSurface: string | null;
  // ... other persisted fields
}

const useWorkspaceStore = create<WorkspaceState>()((
  persist(
    (set) => ({
      layout: null,
      lastActiveSurface: null,
      // ...
    }),
    {
      name: 'autoart-workspace',
      partialize: (state) => ({
        layout: state.layout,
        lastActiveSurface: state.lastActiveSurface,
        // Only persist whitelisted fields
      }),
    }
  )
));
```

---

## Multi-Window: Popouts + Synchronization

### One Abstraction, Two Transports

Implement a single "Context Bus" abstraction that supports:
- **Web transport**: BroadcastChannel (for multiple tabs/windows under the same origin)
- **Electron transport**: IPC (main-process hub)

This allows shipping the same UX in web hosting first and swapping transports later without rewriting Surface logic.

### Context Bus Interface

```typescript
interface ContextBus {
  publish(event: ContextEvent): void;
  subscribe(handler: (event: ContextEvent) => void): () => void;
}

// Web implementation
class BroadcastChannelContextBus implements ContextBus {
  private channel = new BroadcastChannel('autoart-context');
  
  publish(event: ContextEvent) {
    this.channel.postMessage(event);
  }
  
  subscribe(handler: (event: ContextEvent) => void) {
    const listener = (e: MessageEvent) => handler(e.data);
    this.channel.addEventListener('message', listener);
    return () => this.channel.removeEventListener('message', listener);
  }
}

// Electron implementation (future)
class ElectronIPCContextBus implements ContextBus {
  publish(event: ContextEvent) {
    ipcRenderer.send('context-event', event);
  }
  
  subscribe(handler: (event: ContextEvent) => void) {
    ipcRenderer.on('context-event', (_e, event) => handler(event));
    return () => ipcRenderer.removeAllListeners('context-event');
  }
}
```

### SelectionContext (Global)

A shared SelectionContext represents the user's current focus, allowing Surfaces (and SelectionInspector) to coordinate.

**Minimum supported kinds:**
- hierarchy node selection (Project/Process/Stage/Subprocess/Task)
- record selection
- email selection

**SelectionContext structure:**
```typescript
interface SelectionContext {
  kind: 'hierarchy' | 'record' | 'email';
  id: string;
  payload?: Record<string, unknown>;
  surfaceId: string; // Which surface published this
  timestamp: number;
}
```

**Usage:**
```typescript
// In Mail surface
const contextBus = useContextBus();

const handleEmailClick = (emailId: string) => {
  contextBus.publish({
    kind: 'email',
    id: emailId,
    surfaceId: 'mail.inbox',
    timestamp: Date.now(),
  });
};

// In Inspector surface
const contextBus = useContextBus();

useEffect(() => {
  const unsubscribe = contextBus.subscribe((context) => {
    if (context.kind === 'email') {
      loadEmailDetails(context.id);
    }
  });
  return unsubscribe;
}, []);
```

---

## Email ↔ Record/Action Mappings

Mappings between emails and AutoArt entities should be visible and editable in:
- **SelectionInspector** (primary): Shows all links for selected item
- **Mail surface** (secondary): Shows links for selected email

### Mapping Workflows via Overlays

Transient flows (pick record, confirm unlink, create new record then link) should be implemented via Overlays, not embedded bespoke modals.

**Example: Link email to record**
```typescript
const overlay = useOverlay();

const handleLinkEmail = (emailId: string) => {
  overlay.open('assign-records', {
    sourceType: 'email',
    sourceId: emailId,
    linkType: 'email-to-record',
  });
};
```

---

## Surface Development Guidelines

### Creating a New Surface

1. **Define the surface component:**
   ```typescript
   // surfaces/MySurface.tsx
   export function MySurface() {
     return (
       <div className="flex h-full">
         {/* Optional left drawer */}
         <MySurfaceLeftDrawer />
         
         {/* Main content */}
         <div className="flex-1">
           <MySurfaceContent />
         </div>
       </div>
     );
   }
   ```

2. **Register in PanelRegistry:**
   ```typescript
   const PANEL_REGISTRY = {
     'my-surface': {
       id: 'my-surface',
       title: 'My Surface',
       loader: () => import('./surfaces/MySurface'),
       icon: MyIcon,
     },
   };
   ```

3. **Publish selection context when appropriate:**
   ```typescript
   const contextBus = useContextBus();
   
   const handleItemSelect = (itemId: string) => {
     contextBus.publish({
       kind: 'record',
       id: itemId,
       surfaceId: 'my-surface',
       timestamp: Date.now(),
     });
   };
   ```

4. **Use overlays for transient workflows:**
   ```typescript
   const overlay = useOverlay();
   
   const handleCreate = () => {
     overlay.open('create-record', {
       definitionId: currentDefinitionId,
     });
   };
   ```

---

## Related Issues

- [#62 Multi-window popouts + context sync](https://github.com/ok-very/autoart/issues/62)
- [#64 Electron SPA shell](https://github.com/ok-very/autoart/issues/64)
- [#66 Mail surface](https://github.com/ok-very/autoart/issues/66)

---

## Related Reading

- [Foundational Model](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md) - The four first-class objects
- [Backend Architecture](./ARCHITECTURE-01-BACKEND.md) - Module structure and communication
