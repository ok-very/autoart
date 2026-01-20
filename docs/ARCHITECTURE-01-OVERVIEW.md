# Architecture Overview

## What is AutoArt?

AutoArt is a **process management system** with a 5-level hierarchy:

```
Project → Process → Stage → Subprocess → Task
```

The system is transitioning toward an **Action-Event** architecture centered around the **Composer** module, replacing legacy CRUD-era workflows.

## Technology Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Web Framework**: Fastify
- **Database**: PostgreSQL
- **Query Builder**: Kysely (type-safe SQL)
- **Validation**: Zod (via `@autoart/shared`)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand (with `persist` middleware)
- **Data Fetching**: TanStack Query (React Query)
- **Workspace Layout**: Dockview
- **Validation**: Zod (via `@autoart/shared`)

### Shared
- **Package**: `@autoart/shared` (monorepo workspace)
- **Purpose**: End-to-end type safety and validation
- **Contents**: Zod schemas, TypeScript types, domain models

## Core Architectural Principles

### 1. Four First-Class Objects Only
AutoArt recognizes exactly **four first-class objects**:
- **Record**: Context container (projects, cases, artifacts)
- **Field**: Declarative data surface (typed, reusable)
- **Action**: Intent declaration (what should happen)
- **Event**: Historical fact (what actually happened)

See [ARCHITECTURE-02-FOUNDATIONAL-MODEL.md](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md) for details.

### 2. No Stored State
All meaning is computed via interpretation:

```
Meaning = interpret(Records × Fields × Actions × Events)
```

Statuses, progress, timelines, and completion are **derived views**, never persisted.

### 3. Action-Event as Single Entry Point
The **Composer** module is the single entry point for creating work items. It ensures:
- Every intent creates an Action
- Every outcome creates an Event
- Proper traceability and auditability

Direct CRUD operations are deprecated.

### 4. Module Independence
Backend modules communicate through:
- The `@autoart/shared` package (types/schemas)
- Service layer APIs (not direct imports)

Cross-module imports are prohibited.

### 5. Surface-Based UI
The frontend is organized around **Surfaces** (long-lived workspace panels) and **Overlays** (transient workflows):
- **Surfaces**: Mail, Inspector, Composer, Workbench, Projects, Registry
- **Overlays**: Create/confirm/picker workflows (global, short-lived)

See [ARCHITECTURE-05-WORKSPACE.md](./ARCHITECTURE-05-WORKSPACE.md).

## System Boundaries

### What AutoArt Does
- Process and workflow management
- Hierarchical task decomposition
- Record and field-based data modeling
- Action and event traceability
- Multi-window workspace layouts
- Data import and classification
- Full-text search
- Export to external formats (BFA)

### What AutoArt Does Not Do
- Real-time collaboration (no operational transforms)
- Native mobile apps (web-first, Electron for desktop)
- Built-in email/calendar sync (delegates to AutoHelper agent)
- Version control for arbitrary files (not a CMS)

## Repository Structure

```
autoart/
├── backend/          # Fastify backend
│   └── src/
│       ├── modules/  # Feature modules (actions, composer, events, etc.)
│       ├── db/       # Database client and migrations
│       ├── plugins/  # Fastify plugins
│       └── utils/    # Shared utilities
├── frontend/         # React SPA
│   └── src/
│       ├── api/      # API client layer
│       ├── drawer/   # Drawer/overlay system
│       ├── surfaces/ # Surface implementations
│       ├── stores/   # Zustand stores
│       ├── ui/       # Shared UI components
│       └── pages/    # Route components
├── shared/           # Shared types and schemas
│   └── src/
│       ├── domain/   # Domain models
│       ├── schemas/  # Zod schemas
│       └── types/    # TypeScript types
└── docs/             # Documentation
```

## Next Steps

Continue to:
- [ARCHITECTURE-02-FOUNDATIONAL-MODEL.md](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md) - Understand the four first-class objects
- [ARCHITECTURE-03-BACKEND.md](./ARCHITECTURE-03-BACKEND.md) - Backend module structure
- [ARCHITECTURE-04-FRONTEND.md](./ARCHITECTURE-04-FRONTEND.md) - Frontend organization
