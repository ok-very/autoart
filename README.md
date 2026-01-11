# AutoArt Process Management System

A powerful process management system with a 5-level hierarchy (Project → Process → Stage → Subprocess → Task), polymorphic records, and a hyperlink engine for `#record:field` references.

## Core Architecture

AutoArt is built on a robust, type-safe architecture that ensures data integrity across the entire stack.

### 1. Shared Type System (Single Source of Truth)
- **Zod Schemas**: All data structures (Nodes, Records, Definitions) are defined in a shared library (`@autoart/shared`).
- **End-to-End Validation**: The exact same Zod schemas are used for:
  - Database migrations and schema definitions.
  - Backend API request validation.
  - Frontend TypeScript types and form validation.
- **Strict CRUD Mappings**: Frontend hooks use precise input types (`CreateRecordInput`, `CreateDefinitionInput`) derived directly from the API schema, preventing "silent failures" or incomplete data submissions.

### 2. Hierarchy & Record Definitions (Strict Linkage)
- **Explicit Linking**: Hierarchy Nodes (Projects, Processes, etc.) are explicitly linked to their Record Definitions via a unique UUID (`default_record_def_id`), rather than relying on fragile name-based matching.
- **Auto-Association**: When a new Node is created, the system automatically resolves and links it to the correct Record Definition for its type.
- **Robust Renaming**: Renaming a "Class Definition" (e.g., renaming "Subprocess" to "Phase") automatically updates the linkage for the current node, preserving the schema connection without breaking existing data.
- **Schema-Driven Views**: The Inspector view strictly renders fields based on the active Record Definition. Deleting a field from the schema immediately removes it from the view, ensuring the UI always reflects the true state of the data model.

### 3. Hyperlink Engine & Search
- **Unified Resolution**: The search and reference system (`#record:field`) uses a unified recursive path resolution strategy rooted in the database hierarchy.
- **ID-Based references**: All internal references rely on stable UUIDs, making the system resilient to name changes and structural moves.

### 4. UI Patterns: Drawer System
- **Bottom Drawer**: Contextual forms and workflows (`frontend/src/components/drawer`)
- **DrawerRegistry**: Routes drawer types to their view components
- Replaces legacy modal pattern for all insertions, deletions, and contextual views

### 5. Event-Sourced Actions
- **Actions & Events**: All work is tracked through immutable Events emitted against Actions
- **Project Log**: Default view showing chronological event stream for a context
- **Workflow Surface**: Materialized projection of action state derived from events

## Refactor Plan: Unified Record Architecture

The long-term vision is to treat all hierarchy nodes (Tasks, Projects, etc.) as "System Level Records" to enable unified visualization and querying.

### 1. Unified Data Model
- **Goal**: Eliminate the artificial distinction between "Hierarchy Nodes" and "Data Records".
- **Strategy**: 
  - Ensure all System Types (Task, Project, Process) are backed by immutable `RecordDefinitions`.
  - Migrate `hierarchy_nodes` to be a lightweight structural skeleton that points to a `records` entry for its data.
  - This allows a "Task" to be fully polymorphic—it is just a position in the tree that holds a Record of type "Task".

### 2. Renaming Propagation
- **Current State**: Renaming a definition (e.g., "Task" -> "Ticket") works for the current node but requires ensuring all other nodes of that type are updated.
- **Future State**: 
  - Since all nodes will point to a `definition_id` (via the Unified Data Model), renaming the Definition is a single atomic operation.
  - All "Task" instances will immediately reflect the new name "Ticket" and any schema changes (new columns/fields) globally.

### 3. Unified Visualization (Universal Table)
- **Goal**: "Visualize any kind of record and associated fields as columns."
- **Implementation**:
  - **UniversalTableView Component**: A generic React component that accepts a `definitionId`.
  - **Dynamic Columns**: Columns are generated dynamically from the `definition.schema_config.fields`.
  - **Data Fetching**: The component queries the `records` table (joined with `hierarchy_nodes` if necessary) to fetch all instances matching that Definition.
  - **Result**: A powerful, spreadsheet-like interface where you can view "Tasks", "Clients", or "Invoices" side-by-side with identical sorting, filtering, and bulk editing capabilities.

## Features

- **Deep Hierarchy**: Manage nested structures with Projects, Processes, Stages, Subprocesses, and Tasks.
- **Polymorphic Records**: Create custom record types with user-defined schemas.
- **Hyperlink Engine**: Reference records in task descriptions using `#recordname:fieldname` syntax.
- **Static/Dynamic References**: Choose between snapshot values or live-linked data.
- **Deep Cloning**: Clone entire project structures as templates.
- **Rich Text Editing**: TipTap-based editor with mention autocomplete.

## Tech Stack

- **Shared**: Zod (Schema validation & Type inference)
- **Backend**: Fastify + TypeScript + Kysely + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS + TipTap + Zustand + TanStack Query

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Git

### Development Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd autoart_v02
   npm run install:all
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development servers**:
   ```bash
   # Linux/macOS
   npm run dev

   # Windows
   npm run dev:win
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Database: localhost:5432

### Demo Credentials

After seeding the database (`npm run seed`):
- Email: `demo@autoart.local`
- Password: `demo123`

## Available Scripts

### Root (Monorepo) Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development servers (backend + frontend) |
| `npm run dev:kill` | Kill dev servers and free ports |
| `npm run install:all` | Install dependencies for all workspaces |
| `npm run build:shared` | Build shared type library |
| `npm run build:backend` | Build backend for production |
| `npm run build:frontend` | Build frontend for production |
| `npm run start:backend` | Start backend dev server only |
| `npm run start:frontend` | Start frontend dev server only |

### Database Scripts

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run database migrations |
| `npm run migrate:down` | Rollback last migration |
| `npm run seed` | Seed reference data |
| `npm run seed:dev` | Seed development sample data |
| `npm run seed:reset` | Reset and re-seed development data |
| `npm run db:rebuild` | Migrate down → up → seed:dev |
| `npm run db:reset` | Nuke database → migrate → seed:dev |
| `npm run db:nuke` | Drop all tables (requires "nuke" confirmation) |
| `npm run db:status` | Show migration status |
| `npm run db:verify` | Verify database connection and schema |
| `npm run backup` | Backup database to timestamped file |

### Backend Scripts (from `backend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | TypeScript compile |
| `npm run start` | Start production server |
| `npm run typecheck` | Type-check without emitting |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run db:repair` | Repair migration history |

### Frontend Scripts (from `frontend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |

## Project Structure

```
autoart_v02/
├── shared/                  # Shared Zod schemas & types
│   ├── src/
│   │   ├── schemas/        # Source of truth for validation
│   │   └── types.ts        # Inferred TypeScript types
│
├── backend/                 # Fastify API
│   ├── src/
│   │   ├── config/         # Environment configuration
│   │   ├── db/             # Database client & migrations
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       # JWT authentication
│   │   │   ├── hierarchy/  # Node CRUD & cloning (Auto-linking)
│   │   │   ├── records/    # Record definitions & instances
│   │   │   ├── references/ # Static/dynamic links
│   │   │   └── search/     # Full-text search
│   │   └── plugins/        # Fastify plugins
│
├── frontend/                # React SPA
│   ├── src/
│   │   ├── api/            # API client & hooks (Strict types)
│   │   ├── components/     # React components
│   │   ├── stores/         # Zustand state stores
│   │   ├── types/          # Re-exported shared types
│   │   └── pages/          # Route components
│
├── config/                  # Configuration files
│   ├── nginx.conf          # Reverse proxy config
│   └── state-saves/        # UI state snapshots
│
├── scripts/                 # Utility scripts
│   ├── dev.sh              # Development startup
│   ├── build.sh            # Production build
│   ├── deploy.sh           # Production deployment
│   ├── backup.sh           # Database backup
│   └── ...
│
└── scripts/                 # Utility scripts
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Hierarchy
- `GET /api/hierarchy/projects` - List projects
- `GET /api/hierarchy/:projectId` - Get project tree
- `POST /api/hierarchy/nodes` - Create node (Auto-links definition)
- `PATCH /api/hierarchy/nodes/:id` - Update node
- `DELETE /api/hierarchy/nodes/:id` - Delete node
- `POST /api/hierarchy/clone` - Deep clone subtree

### Records
- `GET /api/records/definitions` - List record types
- `POST /api/records/definitions` - Create record type
- `POST /api/records/definitions/:id/clone` - Clone record type
- `GET /api/records` - List records
- `POST /api/records` - Create record
- `PATCH /api/records/:id` - Update record

### References
- `POST /api/references` - Create reference
- `POST /api/references/resolve` - Batch resolve values
- `PATCH /api/references/:id/mode` - Switch static/dynamic
- `GET /api/references/:id/drift` - Check for value drift

### Search
- `GET /api/search/resolve?q=...` - Search for `#` autocomplete

## Database Schema

The system uses PostgreSQL with the following core tables:

- `users` - User accounts
- `sessions` - JWT refresh tokens
- `hierarchy_nodes` - The 5-level tree structure (linked via `default_record_def_id`)
- `record_definitions` - Schema definitions for record types
- `records` - Actual record instances
- `task_references` - Links between tasks and records (static/dynamic)

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing (min 32 chars)
- `CORS_ORIGIN` - Allowed origins for CORS

### State Saves

UI state can be saved/restored from `config/state-saves/`. This includes:
- Sidebar and inspector widths
- Expanded nodes
- Selected views
- Theme preferences

## Production Deployment

1. **Configure environment**:
   ```bash
   cp .env.example .env
   # Set production values for DB_PASSWORD, JWT_SECRET, etc.
   ```

2. **Build and deploy**:
   ```bash
   npm run deploy -- --build
   ```

3. **Set up SSL** (recommended):
   ```bash
   certbot certonly --webroot -w /var/www/html -d yourdomain.com
   # Update nginx.conf to enable HTTPS
   ```

4. **Set up automated backups**:
   ```bash
   # Add to crontab
   0 2 * * * /path/to/autoart/scripts/backup.sh
   ```

## License

MIT
