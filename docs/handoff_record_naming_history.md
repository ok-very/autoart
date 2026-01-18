# Handoff: Implement Record Naming History

## Objective
Implement a system to track the "Naming History" of Record entities in the backend and expose it in the UI. This ensures that when a record is renamed (aliased), we retain a trace of its previous names for searchability, syncing, and audit purposes.

## Requirements
1.  **Backend Data Model**:
    *   Update the `Record` entity (or create a related `RecordAlias` table) to store:
        *   `recordId`: Link to the parent record.
        *   `name`: The string value of the name.
        *   `type`: e.g., 'primary', 'historical', 'alias'.
        *   `createdAt`: When this name was active/added.
    *   Ensure strict uniqueness constraints where appropriate (e.g., current primary names must be unique).

2.  **API Updates**:
    *   Update `PATCH /records/:id` to handle renaming:
        *   When `uniqueName` changes, archive the old name as a historical alias before updating.
    *   Add `GET /records/:id/history` (or include in default response) to fetch name history.

3.  **Frontend UI**:
    *   Update Record details view to show "Also known as" or "History" tooltip/popover.
    *   Allow searching records by their historical names (if feasible with current search infra).

## Files to Check
### Backend
- **Schemas**: `backend/src/modules/records/records.schemas.ts`
    - *Action*: Add `aliases` or `namingHistory` to the record schema definition.
- **Service**: `backend/src/modules/records/records.service.ts`
    - *Action*: Modify `updateRecord` to handle the logic of "archive old name -> update new name".
- **Database**: `backend/src/database` (or wherever migrations live)
    - *Action*: Create migration for `record_aliases` table or JSON column updates.

### Frontend
- **Record View**: `frontend/src/surfaces/records` (or equivalent)
    - *Action*: Display the history.
- **Input Components**: `frontend/src/ui/atoms/DebouncedInput.tsx` is ready to be used here on the UI side for editing names.

## Assumptions & constraints
- The `DebouncedInput` created in the previous task should be reused for the renaming UI to ensure performance.
- Search indexing (if existing) may need to be rebuilt to include historical aliases.
