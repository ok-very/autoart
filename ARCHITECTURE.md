# AutoArt v02 - Complete Architecture & Schema Report

## Executive Summary

**AutoArt v02** is a **Hybrid Relational-Graph Process Management System** designed to manage complex workflows with flexible data capture. It provides:

- **5-Level Hierarchy**: Project → Process → Stage → Subprocess → Task structure
- **Polymorphic Records**: User-defined data types with JSONB storage and schema inheritance
- **Reference System**: Static/Dynamic links between tasks and records with Copy-on-Write semantics
- **Hypertext Engine**: `#recordname:field` syntax for inline database references in rich text
- **Template Library**: Reusable record definitions with project-scoped templates

The system is built as a **full-stack TypeScript application** with a Fastify backend and React frontend.

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Fastify** | 5.2.1 | High-performance HTTP framework |
| **TypeScript** | 5.5.3 | Type-safe development |
| **Kysely** | 0.27.4 | Type-safe SQL query builder |
| **PostgreSQL** | 16+ | Database (JSONB, Recursive CTEs, GIN indexes) |
| **Zod** | 3.23.8 | Runtime schema validation |
| **@fastify/jwt** | 10.0.0 | JWT authentication |
| **bcryptjs** | 2.4.3 | Password hashing |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI component library |
| **Vite** | 5.3.5 | Build tool & dev server |
| **TypeScript** | 5.5.4 | Type-safe development |
| **TanStack Query** | 5.51.21 | Server state management |
| **Zustand** | 4.5.4 | Client state management |
| **TipTap** | 2.5.9 | Rich text editor with mentions |
| **Tailwind CSS** | 3.4.7 | Utility-first styling |
| **React Router** | 6.26.0 | Client-side routing |

---

## Project Structure

```
autoart_v02/
├── backend/                           # Fastify Backend
│   └── src/
│       ├── app.ts                     # Fastify application setup
│       ├── config/
│       │   └── env.ts                 # Environment validation (Zod)
│       ├── db/
│       │   ├── client.ts              # Kysely database client
│       │   ├── schema.ts              # TypeScript type definitions
│       │   └── migrations/            # Database migrations (14 files)
│       ├── modules/
│       │   ├── auth/                  # Authentication (JWT, sessions)
│       │   ├── hierarchy/             # Node CRUD, cloning, tree ops
│       │   ├── records/               # Definitions & records
│       │   ├── references/            # Static/dynamic task references
│       │   ├── links/                 # Record-to-record relationships
│       │   ├── search/                # Mention resolution, backlinks
│       │   └── ingestion/             # Data import with parsers
│       ├── plugins/                   # Fastify plugins
│       └── utils/
│           └── errors.ts              # Custom error classes
│
├── frontend/                          # React/Vite Frontend
│   └── src/
│       ├── App.tsx                    # Route definitions
│       ├── api/
│       │   ├── client.ts              # API client wrapper
│       │   └── hooks.ts               # TanStack Query hooks (50+)
│       ├── components/
│       │   ├── common/                # Shared UI components
│       │   ├── drawer/                # Bottom drawer views
│       │   ├── editor/                # TipTap rich text components
│       │   ├── hierarchy/             # Tree view components
│       │   ├── inspector/             # Right panel inspector
│       │   ├── layout/                # Main layout, header
│       │   └── records/               # Record grid, sidebar
│       ├── stores/                    # Zustand stores (3 stores)
│       └── types/                     # TypeScript interfaces
│
├── CLAUDE.md                          # Development conventions
└── package.json                       # Root scripts
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vite)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Sidebar   │  │  Workspace  │  │  Inspector  │  │   Drawer    │ │
│  │ (Tree Nav)  │  │ (Editor)    │  │ (Details)   │  │ (Forms)     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                              │                                       │
│     ┌────────────────────────┴────────────────────────┐             │
│     │  State: Zustand (auth, hierarchy, ui)           │             │
│     │  Server State: TanStack Query (cache, sync)     │             │
│     └────────────────────────┬────────────────────────┘             │
│                              │                                       │
│                    ┌─────────┴─────────┐                            │
│                    │    API Client     │                            │
│                    │   (hooks.ts)      │                            │
│                    └─────────┬─────────┘                            │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTP REST (JSON)
                               │ Port 5173 → Proxy → Port 3001
┌──────────────────────────────┼──────────────────────────────────────┐
│                         BACKEND (Fastify)                            │
│                    ┌─────────┴─────────┐                            │
│                    │     app.ts        │                            │
│                    │   (Route Setup)   │                            │
│                    └─────────┬─────────┘                            │
│          ┌───────────────────┼───────────────────┐                  │
│          │                   │                   │                  │
│  ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐           │
│  │   Modules     │  │   Services    │  │   Schemas     │           │
│  │ (routes.ts)   │  │ (*.service)   │  │ (Zod)         │           │
│  └───────────────┘  └───────┬───────┘  └───────────────┘           │
│                             │                                       │
│                    ┌────────┴────────┐                             │
│                    │    Kysely       │                             │
│                    │  (Query Builder)│                             │
│                    └────────┬────────┘                             │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ SQL
┌─────────────────────────────┼───────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                             │
│           ┌─────────────────┴─────────────────┐                     │
│           │  7 Tables + Indexes + Functions   │                     │
│           │  JSONB for flexible data          │                     │
│           │  Recursive CTEs for tree ops      │                     │
│           └───────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Complete Database Schema

### 1. User Management

#### **users**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | User ID |
| email | VARCHAR | NOT NULL, UNIQUE | User email |
| password_hash | VARCHAR | NOT NULL | Bcrypt hashed password |
| name | VARCHAR | NOT NULL | Display name |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

#### **sessions**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Session ID |
| user_id | UUID | FK → users | User reference |
| refresh_token | VARCHAR | NOT NULL | JWT refresh token |
| expires_at | TIMESTAMP | NOT NULL | Token expiration |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

---

### 2. Hierarchy System (5-Level Tree)

#### **hierarchy_nodes**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Node ID |
| parent_id | UUID | FK → hierarchy_nodes, NULLABLE | Parent node |
| root_project_id | UUID | FK → hierarchy_nodes | Denormalized project reference |
| type | ENUM | NOT NULL | 'project', 'process', 'stage', 'subprocess', 'task' |
| title | VARCHAR | NOT NULL | Display title |
| description | JSONB | NULLABLE | TipTap rich text with mentions |
| position | INTEGER | DEFAULT 0 | Order within parent |
| default_record_def_id | UUID | FK → record_definitions | Default definition for child records |
| metadata | JSONB | DEFAULT '{}' | Flexible node-specific data |
| created_by | UUID | FK → users | Creator |
| created_at | TIMESTAMP | DEFAULT NOW | Creation time |
| updated_at | TIMESTAMP | DEFAULT NOW | Last update |

**Indexes:**
- `idx_hierarchy_parent` on (parent_id, position)
- `idx_hierarchy_root` on (root_project_id)
- `idx_hierarchy_type` on (type)

**Hierarchy Rules (enforced at application layer):**
```
project    → can contain: process
process    → can contain: stage
stage      → can contain: subprocess
subprocess → can contain: task
task       → can contain: (none - leaf node)
```

---

### 3. Polymorphic Records System

#### **record_definitions**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Definition ID |
| name | VARCHAR | NOT NULL | Type name (e.g., "Contact", "Artwork") |
| derived_from_id | UUID | FK → record_definitions | Inheritance link |
| project_id | UUID | FK → hierarchy_nodes | Project template library scope |
| is_template | BOOLEAN | DEFAULT FALSE | Reusable template flag |
| clone_excluded | BOOLEAN | DEFAULT FALSE | Exclude from project cloning |
| pinned | BOOLEAN | DEFAULT FALSE | Show in quick create menu |
| schema_config | JSONB | NOT NULL | Field definitions |
| styling | JSONB | DEFAULT '{}' | Visual styling (color, icon) |
| created_at | TIMESTAMP | DEFAULT NOW | Creation time |

**schema_config Structure:**
```json
{
  "fields": [
    {
      "key": "email",
      "type": "email",
      "label": "Email Address",
      "required": true,
      "options": []
    },
    {
      "key": "role",
      "type": "select",
      "label": "Role",
      "required": false,
      "options": ["Artist", "Curator", "Developer"]
    }
  ]
}
```

**Field Types:** `text`, `number`, `email`, `url`, `textarea`, `select`, `date`, `checkbox`, `link`

#### **records**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Record ID |
| definition_id | UUID | FK → record_definitions | Record type |
| classification_node_id | UUID | FK → hierarchy_nodes | Optional project/subprocess scope |
| unique_name | VARCHAR | NOT NULL | Display name |
| data | JSONB | DEFAULT '{}' | Field values |
| created_by | UUID | FK → users | Creator |
| created_at | TIMESTAMP | DEFAULT NOW | Creation time |
| updated_at | TIMESTAMP | DEFAULT NOW | Last update |

**Indexes:**
- GIN index on `data` for JSONB queries
- Index on `unique_name` for search
- Index on `definition_id` for type filtering

---

### 4. Reference System (Static/Dynamic Links)

#### **task_references**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Reference ID |
| task_id | UUID | FK → hierarchy_nodes | Task node |
| source_record_id | UUID | FK → records | Source record |
| target_field_key | VARCHAR | NULLABLE | Field key within record |
| mode | ENUM | DEFAULT 'dynamic' | 'static' or 'dynamic' |
| snapshot_value | JSONB | NULLABLE | Frozen value for static mode |
| created_at | TIMESTAMP | DEFAULT NOW | Creation time |

**Reference Modes:**
- **Dynamic**: Value resolved from source record at read time (pointer)
- **Static**: Snapshot captured, can be edited independently
- **Drift Detection**: Compare snapshot to current source value

---

### 5. Record Links (Many-to-Many)

#### **record_links**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Link ID |
| source_record_id | UUID | FK → records | Source record |
| target_record_id | UUID | FK → records | Target record |
| link_type | VARCHAR | NOT NULL | Relationship type (e.g., "related_to") |
| metadata | JSONB | DEFAULT '{}' | Link metadata |
| created_by | UUID | FK → users | Creator |
| created_at | TIMESTAMP | DEFAULT NOW | Creation time |

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HIERARCHY SYSTEM                                   │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │ hierarchy_nodes  │◄────────┐ (self-referential)                         │
│  │ - type (enum)    │─────────┘                                             │
│  │ - parent_id      │                                                       │
│  │ - root_project_id│ (denormalized for fast project queries)              │
│  │ - title          │                                                       │
│  │ - description    │ ──► JSONB with TipTap mention nodes                  │
│  │ - metadata       │                                                       │
│  │ - position       │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           │ classification_node_id (optional scoping)                       │
│           ▼                                                                 │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
┌───────────┼─────────────────────────────────────────────────────────────────┐
│           │              POLYMORPHIC RECORDS                                 │
│           │                                                                 │
│  ┌────────┴─────────┐         ┌──────────────────┐                         │
│  │     records      │◄────────│record_definitions│                         │
│  │ - definition_id  │         │ - name           │                         │
│  │ - unique_name    │         │ - schema_config  │ (JSONB field defs)      │
│  │ - data (JSONB)   │         │ - styling        │                         │
│  │ - classification │         │ - derived_from_id│ (inheritance)           │
│  └────────┬─────────┘         │ - pinned         │                         │
│           │                   │ - clone_excluded │                         │
│           │                   └──────────────────┘                         │
│           │                                                                 │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
┌───────────┼─────────────────────────────────────────────────────────────────┐
│           │              REFERENCE & LINK LAYER                              │
│           │                                                                 │
│           │◄──────────────┐                                                 │
│  ┌────────┴─────────┐     │                                                 │
│  │  task_references │     │ (task → record field)                          │
│  │ - task_id        │─────┘                                                 │
│  │ - source_record  │                                                       │
│  │ - target_field   │                                                       │
│  │ - mode           │ (static/dynamic)                                      │
│  │ - snapshot_value │                                                       │
│  └──────────────────┘                                                       │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │   record_links   │ (record ↔ record)                                     │
│  │ - source_record  │                                                       │
│  │ - target_record  │                                                       │
│  │ - link_type      │                                                       │
│  │ - metadata       │                                                       │
│  └──────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          AUTHENTICATION                                      │
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │      users       │◄────────│     sessions     │                         │
│  │ - email          │         │ - refresh_token  │                         │
│  │ - password_hash  │         │ - expires_at     │                         │
│  │ - name           │         └──────────────────┘                         │
│  └──────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints Summary

### Authentication (`/api/auth`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/register` | POST | Create user account |
| `/login` | POST | Generate access & refresh tokens |
| `/refresh` | POST | Refresh expired access token |
| `/logout` | POST | Invalidate session |
| `/me` | GET | Get current user |

### Hierarchy (`/api/hierarchy`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects` | GET | List all projects |
| `/:projectId` | GET | Get complete project tree |
| `/nodes/:nodeId` | GET | Get single node |
| `/nodes` | POST | Create node |
| `/nodes/:nodeId` | PATCH | Update node |
| `/nodes/:nodeId` | DELETE | Delete node and children |
| `/nodes/:nodeId/move` | PATCH | Move node to new parent |
| `/clone` | POST | Deep clone subtree |

### Records (`/api/records`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/definitions` | GET, POST | List/create definitions |
| `/definitions/:id` | GET, PATCH, DELETE | Manage definition |
| `/definitions/:id/save-to-library` | POST | Save to project templates |
| `/definitions/:id/toggle-clone-excluded` | POST | Toggle clone exclusion |
| `/definitions/library/:projectId` | GET | Get project templates |
| `/definitions/clone-stats/:projectId` | GET | Get clone statistics |
| `/` | GET | List records (with filters) |
| `/` | POST | Create record |
| `/:id` | GET, PATCH, DELETE | Manage record |
| `/stats` | GET | Get record counts by type |
| `/bulk/classify` | POST | Bulk update classification |
| `/bulk/delete` | POST | Bulk delete records |

### References (`/api/references`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Create reference |
| `/:id` | GET, DELETE | Get/delete reference |
| `/:id/resolve` | GET | Resolve to current value |
| `/:id/mode` | PATCH | Switch static/dynamic mode |
| `/:id/snapshot` | PATCH | Update static snapshot |
| `/:id/drift` | GET | Check for drift |
| `/task/:taskId` | GET | Get task's references |
| `/resolve` | POST | Batch resolve references |

### Links (`/api/links`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Create link |
| `/:id` | GET, PATCH, DELETE | Manage link |
| `/record/:recordId` | GET | Get record's links |
| `/types` | GET | Get all link types |

### Search (`/api/search`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/resolve` | GET | Resolve #mention query |

### Ingestion (`/api/ingestion`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/parsers` | GET | List available parsers |
| `/preview` | POST | Preview import |
| `/import` | POST | Execute import |

---

## Key Design Patterns

### 1. Adjacency List for Hierarchy
Single table inheritance with `parent_id` enables O(N) deep cloning. Recursive CTEs handle tree traversal efficiently.

```sql
WITH RECURSIVE tree AS (
  SELECT * FROM hierarchy_nodes WHERE id = $1
  UNION ALL
  SELECT h.* FROM hierarchy_nodes h
  INNER JOIN tree t ON h.parent_id = t.id
)
SELECT * FROM tree
```

### 2. JSONB for Polymorphism
Dynamic fields without schema migrations:
- `schema_config.fields[]` defines field types
- `data` stores actual values
- GIN indexes enable efficient querying

### 3. Copy-on-Write References
References between tasks and records support two modes:
- **Dynamic**: Live pointer, value fetched at read time
- **Static**: Snapshot captured, editable independently
- **Drift Detection**: Alert when snapshot differs from source

### 4. Hypertext Mentions
TipTap editor parses `#recordname:field` into structured nodes:
```json
{
  "type": "mention",
  "attrs": {
    "referenceId": "uuid",
    "label": "#recordname:field",
    "mode": "dynamic",
    "recordId": "uuid",
    "fieldKey": "field"
  }
}
```

### 5. Deep Clone with ID Remapping
When cloning a project:
1. Fetch entire tree with recursive CTE
2. Generate new UUIDs for all nodes
3. Remap parent_id references
4. Scan JSONB descriptions, remap mention UUIDs
5. Insert in single transaction

---

## State Management

### Zustand Stores

**authStore** - Authentication state
- `user`, `isAuthenticated`
- Persisted to localStorage

**hierarchyStore** - Tree data and selection
- `nodes` (Record<id, node>)
- `selectedProjectId`, `selectedNodeId`
- `expandedIds` (Set)
- Helper methods: `getChildren()`, `getAncestors()`

**uiStore** - Layout and view state
- `sidebarWidth`, `inspectorWidth`
- `viewMode`: 'workflow' | 'grid' | 'calendar' | 'columns'
- `inspectorMode`: 'record' | 'schema' | 'references' | 'links'
- `activeDrawer`: { type, props }

### TanStack Query

Server state caching with automatic invalidation:
```typescript
// Query
const { data: nodes } = useProjectTree(projectId);

// Mutation with invalidation
const createNode = useCreateNode();
// onSuccess: invalidateQueries({ queryKey: ['hierarchy'] })
```

---

## Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `MainLayout` | layout/ | 3-column resizable layout |
| `Header` | layout/ | Navigation, project selector |
| `Sidebar` | hierarchy/ | Tree navigation, quick create |
| `TreeNode` | hierarchy/ | Recursive tree item |
| `RecordInspector` | inspector/ | Right panel with tabs |
| `RichTextEditor` | editor/ | TipTap with mentions |
| `BottomDrawer` | drawer/ | Slide-up modal forms |
| `RecordGrid` | records/ | Table view with filtering |
| `RecordTypeSidebar` | records/ | Definition type list |

---

## Database Migrations

| # | File | Purpose |
|---|------|---------|
| 001 | extensions.ts | Enable uuid-ossp, pg_trgm |
| 002 | enums.ts | Create node_type, ref_mode enums |
| 003 | users.ts | Users and sessions tables |
| 004 | record_definitions.ts | Definition registry |
| 005 | hierarchy.ts | Hierarchy nodes table |
| 006 | records.ts | Records table |
| 007 | references.ts | Task references table |
| 008 | functions.ts | SQL helper functions |
| 009 | seed_definitions.ts | Default record definitions |
| 010 | record_links.ts | Record-to-record links |
| 011 | definition_templates.ts | Template library support |
| 012 | clone_excluded.ts | Clone exclusion flag |
| 013 | fix_icon_emojis.ts | Emoji icon fixes |
| 014 | pinned_flag.ts | Quick create pinning |

---

## Running the Application

### Prerequisites
- Node.js 18+
- PostgreSQL 16+
- npm or yarn

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Configure DATABASE_URL, JWT_SECRET
npm run migrate       # Apply migrations
npm run dev           # Start on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev           # Start on port 5173 (proxies /api to 3001)
```

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/autoart
JWT_SECRET=your-32-character-minimum-secret
NODE_ENV=development
```

---

## Key Files Reference

**Backend:**
- `src/db/schema.ts` - Database type definitions
- `src/modules/hierarchy/hierarchy.service.ts` - Tree operations
- `src/modules/records/records.service.ts` - Polymorphic data
- `src/modules/references/references.service.ts` - Reference modes

**Frontend:**
- `src/App.tsx` - Routing and auth flow
- `src/components/layout/MainLayout.tsx` - Main UI structure
- `src/components/editor/RichTextEditor.tsx` - Mention system
- `src/api/hooks.ts` - 50+ query/mutation hooks
- `src/stores/*.ts` - State management

---

## Intended Purpose

AutoArt v02 is designed for organizations managing complex project workflows with flexible data requirements:

1. **Hierarchical Project Management**: Organize work in a structured 5-level tree
2. **Polymorphic Data Capture**: Define custom record types without code changes
3. **Reference System**: Link data across the system with live or frozen values
4. **Template Reuse**: Save and clone definitions across projects
5. **Rich Text with Database Links**: Embed live data references in descriptions
6. **Data Import**: Migrate from external systems via pluggable parsers

The system replaces rigid databases with a flexible schema-on-read approach while maintaining strong type safety and referential integrity.

---

*Report generated: December 2024*
*Database: 7 tables | API: 40+ endpoints | Components: 25+ React components*
