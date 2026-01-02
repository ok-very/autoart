# Architectural Inventory
Date: 2026-01-01

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
- **Views**:
    - Creation: `CreateDefinitionView.tsx`, `CreateLinkView.tsx`, `CreateNodeView.tsx`, `CreateProjectView.tsx`, `CreateRecordView.tsx`, `AddFieldView.tsx`
    - Management: `ClassifyRecordsView.tsx`, `CloneDefinitionView.tsx`, `CloneProjectView.tsx`
    - Deletion: `ConfirmDeleteView.tsx`
    - Viewing: `IngestionDrawer.tsx`, `ProjectLibraryDrawer.tsx`, `ViewDefinitionDrawer.tsx`, `ViewRecordDrawer.tsx`

### Editor (`/editor`)
Rich text editing capabilities (TipTap based).
- `RichTextEditor.tsx`, `RichTextInput.tsx`
- Mentions: `MentionChip.tsx`, `MentionExtension.ts`, `MentionSuggestion.tsx`

### Hierarchy (`/hierarchy`)
Tree structure visualization.
- `Sidebar.tsx`, `TreeNode.tsx`

### Inspector (`/inspector`)
Detail editing panel for records.
- **Container**: `RecordInspector.tsx`
- **Fields**: `LinkFieldInput.tsx`, `FieldRenderer.tsx`, `TagsInput.tsx`, `UserMentionInput.tsx`
- **Views**: `LinksView.tsx`, `RecordPropertiesView.tsx`, `ReferencesManager.tsx`, `SchemaEditorView.tsx`

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
- `DataTable.tsx`, `RecordDataTable.tsx`, `TaskDataTable.tsx`, `UniversalTableView.tsx`
- Cells: `EditableCell.tsx`

## 2. Backend Services (`backend/src/modules/`)

| Module | Purpose | Key Files |
| :--- | :--- | :--- |
| **Auth** | Authentication & Session Management | `auth.routes.ts`, `auth.service.ts` |
| **Hierarchy** | Tree Structure Management (Projects/Tasks) | `hierarchy.routes.ts`, `hierarchy.service.ts` |
| **Ingestion** | Data Import/Parsing | `ingestion.routes.ts`, `ingestion.service.ts` |
| **Links** | Record-to-Record Relationships | `links.routes.ts`, `links.service.ts` |
| **Records** | Data Record CRUD & Definitions | `records.routes.ts`, `records.service.ts` |
| **References** | Task-to-Record References | `references.routes.ts`, `references.service.ts` |
| **Search** | Global Search | `search.routes.ts`, `search.service.ts` |

## 3. Data Entry Points

### Shared Schemas (`shared/src/schemas/`)
Single source of truth for validation types.
- `auth.ts`: Login/Register inputs.
- `enums.ts`: System-wide enumerations.
- `hierarchy.ts`: Node creation/movement (`CreateNodeInputSchema`, etc.).
- `links.ts`: `CreateLinkInputSchema`.
- `records.ts`: Definition & Record CRUD (`CreateRecordInputSchema`, `CreateDefinitionInputSchema`).
- `references.ts`: `CreateReferenceInputSchema`.
- `search.ts`: `SearchQueryInputSchema`.
- `tasks.ts`: Task-specific validations.

## 4. Legacy / Experimental Fields

### Backend
- **`backend/src/modules/records/records.service.ts`**:
    - `cloneProjectTemplates` is marked `@deprecated`. Use `cloneProjectDefinitions` instead.
- **`hierarchy_nodes` table**:
    - `metadata.status`: Logic relying on unstructured status strings is legacy; migrated to enum in Migration 015.

### Potential Legacy
- `backend/src/db/schema.ts` indicates `project_id` on `record_definitions` drives the template library logic. Changes in cloning logic (see deprecated service method) suggest `clone_excluded` was added to handle nuances previously handled differently.
