# AutoArt Architecture Documentation

This directory contains the complete architectural documentation for AutoArt, organized as a numbered series.

## Reading Order

1. **[ARCHITECTURE-01-OVERVIEW.md](./ARCHITECTURE-01-OVERVIEW.md)** - System overview, technology stack, and core principles
2. **[ARCHITECTURE-02-FOUNDATIONAL-MODEL.md](./ARCHITECTURE-02-FOUNDATIONAL-MODEL.md)** - The four first-class objects and interpretive model
3. **[ARCHITECTURE-03-BACKEND.md](./ARCHITECTURE-03-BACKEND.md)** - Backend modules, structure, and API patterns
4. **[ARCHITECTURE-04-FRONTEND.md](./ARCHITECTURE-04-FRONTEND.md)** - Frontend organization, surfaces, and UI patterns
5. **[ARCHITECTURE-05-WORKSPACE.md](./ARCHITECTURE-05-WORKSPACE.md)** - SPA workspace model (panels, overlays, popouts)
6. **[ARCHITECTURE-06-SHARED.md](./ARCHITECTURE-06-SHARED.md)** - Shared package and cross-cutting concerns

## Quick Reference

### Core Concepts
- **Four First-Class Objects**: Record, Field, Action, Event (see 02)
- **No Stored State**: All meaning is computed via interpretation (see 02)
- **Action-Event Architecture**: Composer as single entry point (see 02, 03)
- **Surfaces**: Long-lived workspace panels (Mail, Inspector, Workbench) (see 04, 05)
- **Overlays**: Transient global workflows (create, confirm, pickers) (see 04, 05)

### Technology Stack
- **Backend**: Fastify + TypeScript + Kysely + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS + Zustand + TanStack Query
- **Shared**: Zod schemas for end-to-end type safety
- **Workspace**: Dockview for panel management

## For New Contributors

Start with documents 01 and 02 to understand the foundational model, then proceed to 03-06 based on whether you're working on backend or frontend.

## For Existing Contributors

This series replaces the previous standalone `ARCHITECTURE.md` and consolidates scattered architectural docs. The foundational model remains unchanged; backend and frontend sections have been updated to reflect current codebase structure.
