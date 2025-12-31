# AutoArt System Implementation Plan

## 1. Executive Summary
This plan outlines the greenfield implementation of the AutoArt Process Management System. It pivots from the original proposal to support a specific 5-level hierarchy (**Project $\rightarrow$ Process $\rightarrow$ Stage $\rightarrow$ Subprocess $\rightarrow$ Task**) and treats Projects and Subprocesses as "Classifications" for polymorphic records.

The system is architected as a **Hypertext-Database Hybrid**, where text content is not static strings but a mesh of live database references.

## 2. Technology Stack Selection
We replace standard choices with high-performance, type-safe alternatives suitable for graph-like data.

### Backend (The "Graph" Engine)
- **Runtime**: **Node.js** (TypeScript)
- **Framework**: **Fastify** (Lower overhead than Express, better schema validation with Zod).
- **Database**: **PostgreSQL 16+** (Required for JSONB and Recursive CTEs).
- **SQL Builder**: **Kysely** (Type-safe SQL builder). *Why?* ORMs like Prisma struggle with complex Recursive CTEs and dynamic JSONB filtering. Kysely gives us raw SQL power with TypeScript safety.
- **Search**: **Postgres Full Text Search (tsvector)** (Sufficient for the scale; avoids managing ElasticSearch).

### Frontend (The "Canvas")
- **Framework**: **React** + **Vite**.
- **State Management**: **Zustand** (Global store) + **TanStack Query** (Server state/Caching).
- **Rich Text Engine**: **TipTap** (Headless wrapper around ProseMirror). *Essential for the `#record:field` syntax.*
- **UI Library**: **Shadcn/UI** (Tailwind-based, highly customizable for the "different styles" requirement).

---

## 3. Database Schema Design

### 3.1 The Hierarchy Backbone (`hierarchy_nodes`)
Supports the 5-level structure. `node_type` enforces the nesting rules.

```sql
CREATE TYPE node_type AS ENUM ('project', 'process', 'stage', 'subprocess', 'task');

CREATE TABLE hierarchy_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    root_project_id UUID REFERENCES hierarchy_nodes(id), -- Optimization for "Get all nodes in Project"
    type node_type NOT NULL,
    title TEXT NOT NULL,
    description JSONB, -- TipTap JSON document
    position INTEGER NOT NULL, -- For drag-and-drop ordering
    
    -- Classification Logic
    -- If this node is a Project or Subprocess, it can define a "Default Record Class"
    default_record_def_id UUID REFERENCES record_definitions(id),
    
    metadata JSONB DEFAULT '{}', -- Folder colors, view settings
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hierarchy_parent ON hierarchy_nodes(parent_id);
CREATE INDEX idx_hierarchy_root ON hierarchy_nodes(root_project_id);
```

### 3.2 The Polymorphic Record Engine
Allows creating "Classes" of records and cloning them.

```sql
CREATE TABLE record_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., "Plumbing Asset", "Client Contact"
    derived_from_id UUID REFERENCES record_definitions(id), -- Inheritance/Cloning tracking
    schema_config JSONB NOT NULL, -- The fields definition (UI styles, validation)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID REFERENCES record_definitions(id) NOT NULL,
    
    -- The "Tag" capability
    -- Records can be loosely classified by linking them to a Project or Subprocess node
    classification_node_id UUID REFERENCES hierarchy_nodes(id),
    
    unique_name TEXT NOT NULL, -- The addressable handle (e.g., "ProjectA_Budget")
    data JSONB NOT NULL, -- The actual values
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_records_data ON records USING GIN (data);
```

### 3.3 The Reference Layer (The "Hyperlinks")

```sql
CREATE TABLE task_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    
    -- The Target
    source_record_id UUID REFERENCES records(id),
    target_field_key TEXT,
    
    -- The State
    mode TEXT CHECK (mode IN ('STATIC', 'DYNAMIC')),
    snapshot_value JSONB, -- If Static, this holds the frozen data
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Backend Architecture & Logic

### 4.1 Deep Cloning Service (The "Template" Engine)
When a user duplicates a Project or Process, we use a Recursive CTE.

**Logic:**
1.  **Fetch Tree**: `WITH RECURSIVE` query to get the node and all descendants.
2.  **Map IDs**: Generate new UUIDs for every node in memory.
3.  **Rewrite References**:
    *   Update `parent_id` to the new parent UUID.
    *   **Crucial**: Scan the `description` JSONB. If it contains internal links (e.g., Task A links to Task B within the same tree), remap those UUIDs too so the clone is self-contained.
4.  **Bulk Insert**: Perform a transaction insert.

### 4.2 The Resolution Service (UX Hookup)
Handles the `#` syntax.

*   **Input**: User types `#Proj`.
*   **Query**: Search `hierarchy_nodes` (Projects/Subprocesses) AND `records` (Unique Names).
*   **Return**: A polymorphic list:
    *   `{ type: 'node', id: '...', label: 'Project Alpha' }`
    *   `{ type: 'record', id: '...', label: 'Project Alpha Budget' }`

### 4.3 Record Classification Logic
Since "Project and Subprocesses are classifications":
*   **Create Record**: When creating a record inside a Subprocess (e.g., "Plumbing"), the backend automatically tags `records.classification_node_id = subprocess_id`.
*   **Inheritance**: If the Subprocess has a `default_record_def_id`, the new record automatically uses that schema.

---

## 5. Frontend Architecture & UX Bindings

### 5.1 The Layout
*   **Left Sidebar**: **Hierarchy Tree**.
    *   *UX Hook*: Drag-and-drop uses Optimistic UI. We update the local Zustand store immediately, then fire the API call. If it fails, we revert.
*   **Center Stage**: **The Workspace**.
    *   Renders the "Folder" view (Stage) or the "Document" view (Task).
*   **Right Panel**: **Context/Inspector**.
    *   Shows details of the currently selected Record or Reference.

### 5.2 The "Hyperlink Engine" (TipTap Integration)
This is the core UX component. We build a custom TipTap Node Extension called `ReferenceNode`.

**The Flow:**
1.  **Trigger**: User types `#`.
2.  **Popup**: A floating menu appears (using `tippy.js`).
3.  **Selection**: User selects "Project Alpha Budget" (Record).
4.  **Field Picker**: UI asks "Which field? (Cost / Status)". User picks "Cost".
5.  **Insertion**:
    *   Frontend calls `POST /api/references` to create a `task_reference`.
    *   Backend returns a UUID.
    *   Editor inserts a "Chip" component: `<span data-type="reference" data-id="UUID">#ProjectAlpha:Cost</span>`.

### 5.3 Static vs. Dynamic UX (The "Drift" System)
How we handle the "Static/Dynamic" requirement visually.

*   **Component**: `<ReferenceChip id={refId} />`
*   **Hook**: `useReference(refId)`
    *   Fetches the `task_reference` data.
    *   If `mode === 'DYNAMIC'`: Subscribes to the Record's value.
    *   If `mode === 'STATIC'`:
        *   Displays `snapshot_value`.
        *   **Background Check**: Fetches the *current* Record value.
        *   **Drift Alert**: If `current !== snapshot`, render a small orange dot.
        *   **Interaction**: Hovering the dot shows "Value changed to X. Update?".

### 5.4 The Schema Designer (Record Builder)
To satisfy "create new types... by cloning original types":

*   **UI**: A drag-and-drop form builder.
*   **Action**: "Clone Definition".
    *   User selects "Basic Contact".
    *   System copies the JSON schema.
    *   User adds "LinkedIn Profile" field.
    *   Saves as "Tech Contact".
*   **Binding**: This new Definition ID is now available to be assigned to Projects/Subprocesses as their "Default Class".

---

## 6. Implementation Roadmap

### Phase 1: The Foundation
1.  Setup Fastify + Kysely + Postgres.
2.  Implement `hierarchy_nodes` CRUD.
3.  Build the Recursive CTE for fetching the tree.

### Phase 2: The Record System
1.  Implement `record_definitions` and `records` tables.
2.  Build the JSON Schema validator middleware.
3.  Create the "Schema Designer" UI.

### Phase 3: The Hyperlink Engine
1.  Implement `task_references` table.
2.  Build the TipTap extension for `#` mentions.
3.  Implement the Resolver API (Search).

### Phase 4: Advanced Logic
1.  **Deep Cloning**: Implement the transaction logic to copy Projects/Processes.
2.  **Drift Detection**: Implement the frontend logic to compare Static snapshots vs Live data.

### Phase 5: Polish
1.  Styling based on Record Class (e.g., "Plumbing" records look Blue, "Electrical" look Yellow).
2.  Drag-and-drop reordering of the hierarchy.

## 7. Sample API Payloads

**POST /api/hierarchy/clone**
```json
{
  "sourceNodeId": "uuid-of-project-template",
  "targetParentId": "uuid-of-workspace",
  "overrides": {
    "title": "New Client Project"
  }
}
```

**POST /api/references/resolve**
*(Used when rendering the document to get current values)*
```json
{
  "referenceIds": ["uuid-1", "uuid-2"]
}
```
**Response:**
```json
{
  "uuid-1": { "value": 150, "drift": false },
  "uuid-2": { "value": 100, "drift": true, "liveValue": 120 }
}
```