# Frontend Workspace & Surfaces

**Part of:** [Architecture Documentation Series](./ARCHITECTURE-00-INDEX.md)  
**Last Updated:** 2026-01-17

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

A registry mapping stable panel IDs → lazy-loaded Surface components.

**Structure:**
```typescript
const PANEL_REGISTRY = {
  'workbench': {
    id: 'workbench',
    title: 'Workbench',
    loader: () => import('./surfaces/WorkbenchSurface'),
    icon: WorkbenchIcon,
  },
  'mail.inbox': {
    id: 'mail.inbox',
    title: 'Mail',
    loader: () => import('./surfaces/MailSurface'),
    icon: MailIcon,
  },
  // ...
};
```

**Responsibilities:**
- Lazy-load surface components
- Provide surface metadata (title, icon)
- Support surface-level routing/state

---

### OverlayRegistry (Refactor of DrawerRegistry)

A registry mapping overlay IDs → overlay definitions + view loaders.

**Overlay definitions should be the single source of truth for:**
- title
- size (sm/md/lg/xl/full)
- dismissibility / close behavior
- declared side effects (for auditability)
- runtime contracts (context schema; optionally result schema)

**Structure:**
```typescript
const OVERLAY_REGISTRY = {
  'create-record': {
    id: 'create-record',
    title: 'Create Record',
    size: 'md',
    contextSchema: CreateRecordContextSchema,
    resultSchema: CreateRecordResultSchema,
    loader: () => import('./overlays/CreateRecordOverlay'),
    sideEffects: [{ type: 'create', entityType: 'record' }],
    dismissible: true,
    showClose: true,
  },
  // ...
};
```

**Key improvements over legacy DrawerRegistry:**
- No duplicated switch statement
- Runtime validation via Zod schemas
- Unified mapping (definitions + loaders in one place)
- Type-safe context and result types

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
- [#63 Dockview workspace layout](https://github.com/ok-very/autoart/issues/63)
- [#64 Electron SPA shell](https://github.com/ok-very/autoart/issues/64)
- [#65 SelectionInspector surface](https://github.com/ok-very/autoart/issues/65)
- [#66 Mail surface](https://github.com/ok-very/autoart/issues/66)
- [#67 OverlayRegistry refactor](https://github.com/ok-very/autoart/issues/67)

---

## Related Reading

- [Foundational Model](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md) - The four first-class objects
- [Backend Architecture](./ARCHITECTURE-01-BACKEND.md) - Module structure and communication
