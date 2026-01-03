# Architectural Inventory
Date: 2026-01-03

This document lists the current state of the codebase components, services, and data structures. It is descriptive only and serves as a factual map.

## 1. Frontend Components (`frontend/src/components/`)

### Common (`/common`)
Reusable, generic UI components.
- `Badge.tsx`, `Button.tsx`, `CloneExcludedToggle.tsx`, `DataFieldWidget.tsx`, `EmojiPicker.tsx`
- `ErrorBoundary.tsx`, `MentionableInput.tsx`, `PortalMenu.tsx`, `ProgressBar.tsx`
- `RecordSearchCombobox.tsx`, `ResizeHandle.tsx`, `UserChip.tsx`

### Drawer (`/drawer`)
Sliding side panel management and views.
- **Registry**: `DrawerRegistry.tsx`
- **Container**: `BottomDrawer.tsx`
- **Views** (`/views`):
    - Creation: `AddFieldView.tsx`, `CreateDefinitionView.tsx`, `CreateLinkView.tsx`, `CreateNodeView.tsx`, `CreateProjectView.tsx`, `CreateRecordView.tsx`
    - Management: `ClassifyRecordsView.tsx`, `CloneDefinitionView.tsx`, `CloneProjectView.tsx`
    - Deletion: `ConfirmDeleteView.tsx`
    - Viewing: `ProjectLibraryDrawer.tsx`, `ViewDefinitionDrawer.tsx`, `ViewRecordDrawer.tsx`

### Editor (`/editor`)
Rich text editing capabilities (TipTap based).
- `RichTextEditor.tsx`, `RichTextInput.tsx`
- Mentions: `MentionChip.tsx`, `MentionExtension.ts`, `MentionSuggestion.tsx`

### Hierarchy (`/hierarchy`)
Tree structure visualization.
- `Sidebar.tsx`, `TreeNode.tsx`

### Layout (`/layout`)
Main application structure and specific layout views.
- `Header.tsx`, `MainLayout.tsx`, `Workspace.tsx`
- Views: `CalendarView.tsx`, `MillerColumn.tsx`, `MillerColumnsView.tsx`, `ProjectWorkflowView.tsx`

### Modals (`/modals`)
Dialog components.
- `Modal.tsx`
- Specifics: `AddFieldModal.tsx`, `ConfirmDeleteModal.tsx`, `CreateNodeModal.tsx`

### Records (`/records`)
Record listing and categorization.
- `RecordGrid.tsx`, `RecordTypeSidebar.tsx`

### Tables (`/tables`)
Data grid representations.
- `DataTable.tsx`, `RecordDataTable.tsx`, `TaskDataTable.tsx`, `UniversalTableView.tsx` (Note: `RecordDataTable` and `TaskDataTable` were not found in scan, verifying `UniversalTableView` and `DataTable` presence)
- Cells: `EditableCell.tsx`

*Note: The `inspector` directory exists but appears to be empty or deprecated.*

## 2. Backend Services (`backend/src/modules/`)

| Module | Purpose | Key Files |
| :--- | :--- | :--- |
| **Auth** | Authentication & Session Management | `auth.routes.ts`, `auth.schemas.ts`, `auth.service.ts` |
| **Hierarchy** | Tree Structure Management (Projects/Tasks) | `hierarchy.routes.ts`, `hierarchy.schemas.ts`, `hierarchy.service.ts` |
| **Ingestion** | Data Import/Parsing | `ingestion.routes.ts`, `ingestion.schemas.ts`, `ingestion.service.ts`, `parser.registry.ts` |
| **Links** | Record-to-Record Relationships | `links.routes.ts`, `links.service.ts` |
| **Records** | Data Record CRUD & Definitions | `records.routes.ts`, `records.schemas.ts`, `records.service.ts` |
| **References** | Task-to-Record References | `references.routes.ts`, `references.schemas.ts`, `references.service.ts` |
| **Search** | Global Search | `search.routes.ts`, `search.service.ts` |

## 3. Data Entry Points

### Shared Schemas (`shared/src/schemas/`)
Single source of truth for validation types.
- `auth.ts`: Login/Register inputs.
- `enums.ts`: System-wide enumerations.
- `fields.ts`: Field definitions and types.
- `hierarchy.ts`: Node creation/movement.
- `links.ts`: Link creation inputs.
- `records.ts`: Definition & Record CRUD.
- `references.ts`: Reference creation.
- `search.ts`: Search query inputs.
- `tasks.ts`: Task-specific validations.

## 4. Legacy / Experimental Fields

### Backend
- **`backend/src/db/schema.ts`**:
    - `project_id` on `record_definitions` drives the template library logic.
    - `clone_excluded` flag handles exclusion of definitions during project cloning.

### Historical
- **`hierarchy_nodes` table**:
    - `metadata.status`: Logic relying on unstructured status strings is considered legacy (refer to migration history).