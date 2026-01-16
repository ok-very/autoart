# Monday Import → Records: Investigation Report

**Date:** 2026-01-15  
**Status:** Gap Identified

---

## Summary

The Monday import wizard does **NOT** save data to the `records` table. Instead, it exclusively creates entries in the `actions` table. This is by design based on the Action-Event architecture, but there is **no pathway** implemented for items with `entityType: 'record'` to actually populate the `records` table.

---

## Architecture Overview

The system uses two distinct entity types:

| Table | Purpose | Schema |
|-------|---------|--------|
| `actions` | Work items (Tasks, Bugs, etc.) - immutable intents | `id`, `context_id`, `type`, `field_bindings` |
| `records` | Reference/lookup data tied to definitions | `id`, `definition_id`, `unique_name`, `data` |

**Key Distinction:**
- **Actions** = Work that needs to be done (Tasks, Bugs, Subitems)
- **Records** = Reference data (Clients, Vendors, Equipment, etc.)

---

## Current Import Flow

```
Monday API → MondayConnector.traverseHierarchy()
          → interpretMondayData() [monday-domain-interpreter.ts]
          → ImportPlan { containers[], items[], classifications[] }
          → executePlanViaComposer() [imports.service.ts]
          → db.insertInto('actions') ← ALL ITEMS GO HERE
```

### Entity Type Determination

The interpreter determines `entityType` based on board/group role configuration:

```typescript
// monday-domain-interpreter.ts#L543-559
function determineEntityType(boardConfig, groupConfig) {
    if (boardConfig.role === 'template_board') return 'template';
    if (boardConfig.role === 'reference_board') return 'record';  // ← Returns 'record'
    if (groupConfig?.role === 'template_group') return 'template';
    if (groupConfig?.role === 'reference_group') return 'record'; // ← Returns 'record'
    return 'action'; // Default
}
```

**The interpreter correctly identifies when items should be records.** However...

---

## The Gap

In `executePlanViaComposer()` ([imports.service.ts#L742-855](file:///e:/autoart_v02/backend/src/modules/imports/imports.service.ts#L742-L855)):

```typescript
for (const item of sortedItems) {
    // Special handling exists for 'template' entityType
    if (item.entityType === 'template') { /* deduplication logic */ }
    
    // NO special handling for 'record' entityType!
    // ALL items fall through to actions table:
    const action = await db.insertInto('actions').values({...})
}
```

**There is no conditional branch for `entityType === 'record'`.** Items from `reference_board` or `reference_group` roles are incorrectly inserted into `actions` instead of `records`.

---

## What Would Be Needed for Records

To properly create records, the execution path would need to:

1. **Match to a RecordDefinition** - Records require a `definition_id` referencing `record_definitions`
2. **Provide a `unique_name`** - Records are identified by a unique name within their definition
3. **Format `data` as JSONB** - Field values stored differently than action `field_bindings`
4. **Use `createRecord()` service** - From `records.service.ts`

```typescript
// records.service.ts#L384-404
export async function createRecord(input: CreateRecordInput): Promise<DataRecord> {
    const record = await db.insertInto('records').values({
        definition_id: input.definitionId,     // Required: links to schema
        unique_name: input.uniqueName,          // Required: identifier
        data: JSON.stringify(input.data),       // JSONB field values
        classification_node_id: input.classificationNodeId || null,
        created_by: userId || null,
    })
}
```

---

## Board/Group Roles That Should Create Records

| Role | Configured Via | Should Create |
|------|----------------|---------------|
| `reference_board` | Board config | Records |
| `reference_group` | Group config | Records |

Heuristic patterns that trigger these roles:
- Board names matching: `/reference/i`, `/library/i`, `/lookup/i`
- Group names matching: `/reference/i`, `/resource/i`, `/file/i`, `/doc/i`

---

## Impact

1. **Data Loss (Semantic):** Reference data from Monday (clients, vendors, resources) is being stored as "Task" actions instead of proper records
2. **No Definition Linkage:** Items lack connection to `record_definitions` schema, so field validation and typing is lost
3. **UI Mismatch:** Records UI expects data in `records` table; imported reference data won't appear there
4. **Sync Mismatch:** External source mappings map to `localEntityType: 'action'` even for reference data

---

## Recommended Fix

Add record-specific handling in `executePlanViaComposer()`:

```typescript
for (const item of sortedItems) {
    if (item.entityType === 'record') {
        // 1. Find or create matching RecordDefinition
        // 2. Extract unique_name from title or metadata
        // 3. Call createRecord() instead of inserting action
        // 4. Create external_source_mapping with localEntityType: 'record'
        continue;
    }
    
    // Existing action creation logic...
}
```

Key decisions needed:
1. How to match Monday boards to RecordDefinitions (by name? by config?)
2. How to derive `unique_name` (from title? from specific column?)
3. How to map Monday column values to definition schema fields

---

## Related Files

| File | Relevance |
|------|-----------|
| [imports.service.ts](file:///e:/autoart_v02/backend/src/modules/imports/imports.service.ts) | Execution logic (gap location) |
| [monday-domain-interpreter.ts](file:///e:/autoart_v02/backend/src/modules/imports/monday/monday-domain-interpreter.ts) | Entity type determination |
| [monday-config.types.ts](file:///e:/autoart_v02/backend/src/modules/imports/monday/monday-config.types.ts) | Role definitions |
| [records.service.ts](file:///e:/autoart_v02/backend/src/modules/records/records.service.ts) | Record creation API |
| [types.ts](file:///e:/autoart_v02/backend/src/modules/imports/types.ts) | ImportPlanItem.entityType definition |
