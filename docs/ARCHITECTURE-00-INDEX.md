# AutoArt Architecture Documentation

**Status:** Living documentation series
**Last Updated:** 2026-01-29

## Navigation

This documentation series describes AutoArt's architecture across multiple dimensions. Read in order for a complete understanding, or jump to specific topics.

### Core Architecture Documents

1. **[Backend Architecture](./ARCHITECTURE-01-BACKEND.md)**  
   Module structure, import rules, path aliases, and backend module boundaries.

2. **[Foundational Model: Actions & Events](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md)**  
   The four first-class objects (Record, Field, Action, Event) and the interpretive model. This is the **north star constraint** for the entire system.

3. **[Frontend Workspace & Surfaces](./ARCHITECTURE-03-FRONTEND-WORKSPACE.md)**  
   SPA workspace model: Surfaces (panels), Overlays, left drawers, registries, persistence, and multi-window synchronization.

### Supplementary Documents

- **[Architecture Inventory & Deprecation Plan](./architecture-inventory.md)**  
  Living inventory of active vs deprecated modules, migration status, and cleanup proposals.

- **[Composer Documentation](./composer/composer-guide.md)**
  Deep dive into the Composer module (action creation, quick endpoints, event emission).

- **[Execution Log Implementation](./plan-project-log-implementation.md)**
  Technical plan for context-scoped event log views.

- **Exports Architecture** (`backend/src/modules/exports/`)
  Export session orchestration with sub-architecture: projectors, targets, formatters, connectors.

- **Interpreter Mappings** (`backend/src/modules/interpreter/mappings/`)
  11 domain-specific rule files for data interpretation (artwork, budget, communication, etc.).

- **Workspace Themes** (`frontend/src/workspace/themes/`)
  Theme presets (parchment, default, minimal, compact, floating) and CSS variable contract.

## Quick Reference

### The Four First-Class Objects

AutoArt recognizes exactly **four first-class objects** that store independent truth:

1. **Record** – Context container ("What is this about?")
2. **Field** – Declarative data surface ("What information exists?")
3. **Action** – Intent declaration ("What should occur?")
4. **Event** – Historical fact ("What actually occurred?")

Everything else is **interpretation** (derived views, projections, UI constructs).

### System Invariants (Non-Negotiable)

1. No stored status fields
2. No mutable truth
3. No implicit transitions
4. No fifth first-class object
5. No UI construct may own data

### Frontend Workspace Primitives

- **Surface (Panel)**: Long-lived workspace area (Mail, Composer, Projects, Inspector)
- **Overlay**: Global, transient workflow host (create/confirm/picker flows)
- **Left drawers**: View-specific sidebars (stay local to Surface)

### Backend Module Communication

Modules communicate through `@autoart/shared`, not direct imports.

```
✅ import { ActionSchema } from '@autoart/shared';
❌ import { createRecord } from '../records/service.js';
```

## Architecture Principles

### Backend
- **Action-Event architecture**: All mutations flow through Composer → Actions → Events
- **Shared schemas**: End-to-end type safety via `@autoart/shared` (Zod)
- **Module isolation**: No cross-module imports; use service layer or shared package

### Frontend
- **Panel-based workspace**: Dockview for tabs/splits/docking
- **Overlay for transient workflows**: Global registry for create/confirm/picker flows
- **Selection context**: Shared bus for cross-surface coordination
- **Persistence via Zustand**: Whitelisted fields in `partialize`

### Data Model
- **No stored state**: All status/progress/completion are derived views
- **Append-only events**: Events are immutable historical facts
- **Actions declare intent**: Actions never track execution outcomes

## Contributing to Architecture Docs

When adding new architectural decisions:

1. Update the relevant `ARCHITECTURE-##-*.md` document
2. Add entry to this index if creating a new doc
3. Update "Last Updated" timestamp
4. Ensure consistency with the four first-class objects and system invariants
5. If proposing a new stored entity, verify it fits the foundational model

## Related Issues

- [#62 Multi-window popouts + context sync](https://github.com/ok-very/autoart/issues/62)
- [#64 Electron SPA shell](https://github.com/ok-very/autoart/issues/64)
- [#66 Mail surface](https://github.com/ok-very/autoart/issues/66)
