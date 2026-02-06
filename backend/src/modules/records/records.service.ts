import { sql, type Transaction } from 'kysely';

import type {
  CreateDefinitionInput,
  UpdateDefinitionInput,
  SaveToLibraryInput,
  CloneDefinitionInput,
  CreateRecordInput,
  UpdateRecordInput,
  ListRecordsQuery,
} from './records.schemas.js';
import { db } from '../../db/client.js';
import type { Database, RecordDefinition, DataRecord, NewRecordDefinition, RecordAlias } from '../../db/schema.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

// ==================== DEFINITIONS ====================

export interface ListDefinitionsQuery {
  definitionKind?: 'record' | 'action_arrangement' | 'container';
  projectId?: string;
  isTemplate?: boolean;
  isSystem?: boolean;
}

export async function listDefinitions(query?: ListDefinitionsQuery): Promise<RecordDefinition[]> {
  let q = db
    .selectFrom('record_definitions')
    .selectAll()
    .orderBy('name');

  if (query?.definitionKind) {
    q = q.where('definition_kind', '=', query.definitionKind);
  }

  if (query?.projectId !== undefined) {
    q = q.where('project_id', '=', query.projectId);
  }

  if (query?.isTemplate !== undefined) {
    q = q.where('is_template', '=', query.isTemplate);
  }

  if (query?.isSystem !== undefined) {
    q = q.where('is_system', '=', query.isSystem);
  }

  return q.execute();
}

export async function getDefinitionById(id: string): Promise<RecordDefinition | null> {
  const def = await db
    .selectFrom('record_definitions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return def || null;
}

export async function createDefinition(input: CreateDefinitionInput): Promise<RecordDefinition> {
  const values: NewRecordDefinition = {
    name: input.name as string,
    schema_config: JSON.stringify(input.schemaConfig),
    styling: input.styling ? JSON.stringify(input.styling) : '{}',
    project_id: (input.projectId as string | undefined) ?? null,
    is_template: (input.isTemplate as boolean | undefined) ?? false,
  };

  const def = await db
    .insertInto('record_definitions')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();

  return def;
}

export async function updateDefinition(id: string, input: UpdateDefinitionInput): Promise<RecordDefinition> {
  const existing = await getDefinitionById(id);
  if (!existing) {
    throw new NotFoundError('Record definition', id);
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.schemaConfig !== undefined) updates.schema_config = JSON.stringify(input.schemaConfig);
  if (input.styling !== undefined) updates.styling = JSON.stringify(input.styling);
  if (input.projectId !== undefined) updates.project_id = input.projectId;
  if (input.isTemplate !== undefined) updates.is_template = input.isTemplate;
  if (input.pinned !== undefined) updates.pinned = input.pinned;

  const def = await db
    .updateTable('record_definitions')
    .set(updates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return def;
}

export async function cloneDefinition(id: string, input: CloneDefinitionInput): Promise<RecordDefinition> {
  const source = await getDefinitionById(id);
  if (!source) {
    throw new NotFoundError('Record definition', id);
  }

  // Merge schema overrides
  let schemaConfig = source.schema_config;
  if (input.schemaOverrides) {
    const sourceSchema = typeof source.schema_config === 'string'
      ? JSON.parse(source.schema_config)
      : source.schema_config;
    schemaConfig = JSON.stringify({ ...sourceSchema, ...input.schemaOverrides });
  }

  const cloneValues: NewRecordDefinition = {
    name: input.newName as string,
    derived_from_id: id,
    schema_config: schemaConfig,
    styling: source.styling,
  };

  const cloned = await db
    .insertInto('record_definitions')
    .values(cloneValues)
    .returningAll()
    .executeTakeFirstOrThrow();

  return cloned;
}

export async function deleteDefinition(id: string): Promise<void> {
  const existing = await getDefinitionById(id);
  if (!existing) {
    throw new NotFoundError('Record definition', id);
  }

  // Check if any records use this definition
  const count = await db
    .selectFrom('records')
    .select(sql<number>`COUNT(*)`.as('count'))
    .where('definition_id', '=', id)
    .executeTakeFirst();

  if (count && Number(count.count) > 0) {
    throw new ConflictError('Cannot delete definition with existing records');
  }

  await db
    .deleteFrom('record_definitions')
    .where('id', '=', id)
    .execute();
}

// ==================== TEMPLATE LIBRARY ====================

/**
 * Get all template definitions for a specific project
 */
export async function listProjectTemplates(projectId: string): Promise<RecordDefinition[]> {
  return db
    .selectFrom('record_definitions')
    .selectAll()
    .where('project_id', '=', projectId)
    .where('is_template', '=', true)
    .orderBy('name')
    .execute();
}

/**
 * Save a definition to a project's template library
 */
export async function saveToProjectLibrary(
  definitionId: string,
  input: SaveToLibraryInput
): Promise<RecordDefinition> {
  const existing = await getDefinitionById(definitionId);
  if (!existing) {
    throw new NotFoundError('Record definition', definitionId);
  }

  const def = await db
    .updateTable('record_definitions')
    .set({
      project_id: input.projectId,
      is_template: true,
    })
    .where('id', '=', definitionId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return def;
}

/**
 * Remove a definition from a project's template library
 */
export async function removeFromProjectLibrary(definitionId: string): Promise<RecordDefinition> {
  const existing = await getDefinitionById(definitionId);
  if (!existing) {
    throw new NotFoundError('Record definition', definitionId);
  }

  const def = await db
    .updateTable('record_definitions')
    .set({
      project_id: null,
      is_template: false,
    })
    .where('id', '=', definitionId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return def;
}

/**
 * Clone all non-excluded definitions from one project to another
 * This is the new default behavior - all definitions are cloned unless explicitly excluded
 */
export async function cloneProjectDefinitions(
  sourceProjectId: string,
  targetProjectId: string
): Promise<RecordDefinition[]> {
  // Get all definitions used in this project (by checking records)
  // OR that are marked as templates for this project
  // Exclude any that are marked as clone_excluded
  const definitions = await db
    .selectFrom('record_definitions')
    .selectAll()
    .where((eb) =>
      eb.or([
        // Templates saved to this project
        eb.and([
          eb('project_id', '=', sourceProjectId),
          eb('is_template', '=', true),
        ]),
        // Global definitions (not project-specific) that aren't excluded
        eb('project_id', 'is', null),
      ])
    )
    .where('clone_excluded', '=', false)
    .orderBy('name')
    .execute();

  if (definitions.length === 0) {
    return [];
  }

  return await db.transaction().execute(async (trx) => {
    const clonedDefs: RecordDefinition[] = [];

    for (const def of definitions) {
      const cloned = await trx
        .insertInto('record_definitions')
        .values({
          name: def.name,
          derived_from_id: def.id,
          project_id: targetProjectId,
          is_template: true, // Mark cloned defs as templates in the new project
          schema_config: def.schema_config,
          styling: def.styling,
          clone_excluded: false, // Reset exclusion in cloned project
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      clonedDefs.push(cloned);
    }

    return clonedDefs;
  });
}

/**
 * Toggle the clone_excluded flag on a definition
 */
export async function toggleCloneExcluded(
  definitionId: string,
  excluded: boolean
): Promise<RecordDefinition> {
  const existing = await getDefinitionById(definitionId);
  if (!existing) {
    throw new NotFoundError('Record definition', definitionId);
  }

  return await db
    .updateTable('record_definitions')
    .set({ clone_excluded: excluded })
    .where('id', '=', definitionId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Get count of definitions that would be cloned for a project
 * (all non-excluded definitions)
 */
export async function getCloneableDefinitionsCount(projectId: string): Promise<{ total: number; excluded: number }> {
  const all = await db
    .selectFrom('record_definitions')
    .select((eb) => eb.fn.count('id').as('count'))
    .where((eb) =>
      eb.or([
        eb.and([
          eb('project_id', '=', projectId),
          eb('is_template', '=', true),
        ]),
        eb('project_id', 'is', null),
      ])
    )
    .executeTakeFirst();

  const excluded = await db
    .selectFrom('record_definitions')
    .select((eb) => eb.fn.count('id').as('count'))
    .where((eb) =>
      eb.or([
        eb.and([
          eb('project_id', '=', projectId),
          eb('is_template', '=', true),
        ]),
        eb('project_id', 'is', null),
      ])
    )
    .where('clone_excluded', '=', true)
    .executeTakeFirst();

  return {
    total: Number(all?.count || 0),
    excluded: Number(excluded?.count || 0),
  };
}

// ==================== CONTACTS ====================

/**
 * List Contact records, optionally filtered by contactGroup status field.
 * Used by finance pickers to show Client or Vendor contacts.
 */
export async function listContactsByGroup(group?: string): Promise<DataRecord[]> {
  // Find the Contact definition
  const contactDef = await db
    .selectFrom('record_definitions')
    .select('id')
    .where('name', '=', 'Contact')
    .executeTakeFirst();

  if (!contactDef) return [];

  let q = db
    .selectFrom('records')
    .selectAll()
    .where('definition_id', '=', contactDef.id)
    .orderBy('unique_name');

  if (group) {
    // Filter by contactGroup field in JSONB data
    q = q.where(sql`data->>'contactGroup'`, '=', group);
  }

  return q.execute();
}

// ==================== RECORDS ====================

export async function listRecords(query: ListRecordsQuery): Promise<DataRecord[]> {
  let q = db
    .selectFrom('records')
    .selectAll()
    .orderBy('updated_at', 'desc');

  if (query.definitionId) {
    q = q.where('definition_id', '=', query.definitionId);
  }

  if (query.classificationNodeId) {
    q = q.where('classification_node_id', '=', query.classificationNodeId);
  }

  if (query.search) {
    q = q.where((eb) =>
      eb.or([
        eb('unique_name', 'ilike', `%${query.search}%`),
        eb('id', 'in', ({ selectFrom }) =>
          selectFrom('record_aliases')
            .select('record_id')
            .where('name', 'ilike', `%${query.search}%`)
        ),
      ])
    );
  }

  if (query.limit) {
    q = q.limit(query.limit);
  }

  if (query.offset) {
    q = q.offset(query.offset);
  }

  return q.execute();
}

export async function getRecordById(id: string): Promise<DataRecord | null> {
  const record = await db
    .selectFrom('records')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return record || null;
}

export async function getRecordByUniqueName(uniqueName: string): Promise<DataRecord | null> {
  const record = await db
    .selectFrom('records')
    .selectAll()
    .where('unique_name', '=', uniqueName)
    .executeTakeFirst();
  return record || null;
}

export async function createRecord(
  input: CreateRecordInput,
  userId?: string,
  trx?: Transaction<Database>
): Promise<DataRecord> {
  const conn = trx ?? db;

  // Verify definition exists
  const def = await getDefinitionById(input.definitionId);
  if (!def) {
    throw new NotFoundError('Record definition', input.definitionId);
  }

  const record = await conn
    .insertInto('records')
    .values({
      definition_id: input.definitionId,
      classification_node_id: input.classificationNodeId || null,
      unique_name: input.uniqueName,
      data: JSON.stringify(input.data),
      created_by: userId || null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Create primary alias
  await conn
    .insertInto('record_aliases')
    .values({
      record_id: record.id,
      name: record.unique_name,
      type: 'primary',
    })
    .execute();

  return record;
}

export async function updateRecord(id: string, input: UpdateRecordInput): Promise<DataRecord> {
  return await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('records')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Record', id);
    }

    const updates: { [key: string]: unknown } = { updated_at: new Date() };

    if (input.uniqueName !== undefined && input.uniqueName !== existing.unique_name) {
      updates.unique_name = input.uniqueName;

      // Archive old name
      await trx
        .insertInto('record_aliases')
        .values({
          record_id: id,
          name: existing.unique_name,
          type: 'historical',
        })
        .execute();

      // Update duplicate primary alias or insert new one?
      // For now, we assume implicit primary alias is the current name,
      // but if we want to track 'primary' explicitly:
      await trx
        .deleteFrom('record_aliases')
        .where('record_id', '=', id)
        .where('type', '=', 'primary')
        .execute();

      await trx
        .insertInto('record_aliases')
        .values({
          record_id: id,
          name: input.uniqueName,
          type: 'primary',
        })
        .execute();
    }

    if (input.classificationNodeId !== undefined) updates.classification_node_id = input.classificationNodeId;
    if (input.data !== undefined) updates.data = JSON.stringify(input.data);

    const record = await trx
      .updateTable('records')
      .set(updates)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return record;
  });
}

export async function deleteRecord(id: string): Promise<void> {
  const existing = await getRecordById(id);
  if (!existing) {
    throw new NotFoundError('Record', id);
  }

  await db
    .deleteFrom('records')
    .where('id', '=', id)
    .execute();
}

export async function getRecordAliases(id: string): Promise<RecordAlias[]> {
  return await db
    .selectFrom('record_aliases')
    .selectAll()
    .where('record_id', '=', id)
    .orderBy('created_at', 'desc')
    .execute();
}

// Get record with its definition (for type info)
export async function getRecordWithDefinition(id: string) {
  const result = await db
    .selectFrom('records')
    .innerJoin('record_definitions', 'record_definitions.id', 'records.definition_id')
    .select([
      'records.id',
      'records.unique_name',
      'records.data',
      'records.classification_node_id',
      'records.updated_at',
      'record_definitions.name as definition_name',
      'record_definitions.schema_config',
      'record_definitions.styling',
    ])
    .where('records.id', '=', id)
    .executeTakeFirst();

  return result;
}

// ==================== RECORD STATS ====================

export interface RecordStat {
  definitionId: string;
  definitionName: string;
  count: number;
}

/**
 * Get count of records per definition type
 */
export async function getRecordStats(): Promise<RecordStat[]> {
  const stats = await db
    .selectFrom('records')
    .innerJoin('record_definitions', 'record_definitions.id', 'records.definition_id')
    .select([
      'record_definitions.id as definitionId',
      'record_definitions.name as definitionName',
      sql<number>`count(records.id)::int`.as('count'),
    ])
    .groupBy(['record_definitions.id', 'record_definitions.name'])
    .orderBy('record_definitions.name')
    .execute();

  return stats;
}

// ==================== BULK OPERATIONS ====================

/**
 * Update classification_node_id for multiple records at once
 */
export async function bulkClassifyRecords(
  recordIds: string[],
  classificationNodeId: string | null
): Promise<number> {
  if (recordIds.length === 0) return 0;

  const result = await db
    .updateTable('records')
    .set({
      classification_node_id: classificationNodeId,
      updated_at: new Date(),
    })
    .where('id', 'in', recordIds)
    .execute();

  return result.reduce((sum, r) => sum + Number(r.numUpdatedRows), 0);
}

/**
 * Delete multiple records at once.
 * Wrapped in a transaction to ensure atomic deletion of records, links, and references.
 */
export async function bulkDeleteRecords(recordIds: string[]): Promise<number> {
  if (recordIds.length === 0) return 0;

  return await db.transaction().execute(async (trx) => {
    // First delete any links involving these records
    await trx
      .deleteFrom('record_links')
      .where((eb) =>
        eb.or([
          eb('source_record_id', 'in', recordIds),
          eb('target_record_id', 'in', recordIds),
        ])
      )
      .execute();

    // Finally delete the records
    const result = await trx
      .deleteFrom('records')
      .where('id', 'in', recordIds)
      .execute();

    return result.reduce((sum, r) => sum + Number(r.numDeletedRows), 0);
  });
}

// ==================== BULK IMPORT ====================

export interface BulkCreateRecordInput {
  uniqueName: string;
  data: Record<string, unknown>;
  classificationNodeId?: string | null;
}

export interface BulkCreateResult {
  created: number;
  updated: number;
  errors: Array<{ uniqueName: string; error: string }>;
}

/**
 * Create or update multiple records at once.
 * Uses unique_name for upsert logic - if a record with the same unique_name exists,
 * it will be updated instead of creating a duplicate.
 */
export async function bulkCreateRecords(
  definitionId: string,
  records: BulkCreateRecordInput[],
  userId?: string
): Promise<BulkCreateResult & { records: DataRecord[] }> {
  // Verify definition exists
  const def = await getDefinitionById(definitionId);
  if (!def) {
    throw new NotFoundError('Record definition', definitionId);
  }

  const result: BulkCreateResult & { records: DataRecord[] } = {
    created: 0,
    updated: 0,
    errors: [],
    records: []
  };

  if (records.length === 0) return result;

  // Process in transaction for atomicity
  await db.transaction().execute(async (trx) => {
    for (const record of records) {
      try {
        // Check if record with same unique_name exists
        const existing = await trx
          .selectFrom('records')
          .select('id')
          .where('definition_id', '=', definitionId)
          .where('unique_name', '=', record.uniqueName)
          .executeTakeFirst();

        if (existing) {
          // Update existing record
          const updated = await trx
            .updateTable('records')
            .set({
              data: JSON.stringify(record.data),
              classification_node_id: record.classificationNodeId ?? null,
              updated_at: new Date(),
            })
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow();

          result.updated++;
          result.records.push(updated);
        } else {
          // Create new record
          const created = await trx
            .insertInto('records')
            .values({
              definition_id: definitionId,
              unique_name: record.uniqueName,
              data: JSON.stringify(record.data),
              classification_node_id: record.classificationNodeId ?? null,
              created_by: userId ?? null,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

          // Create primary alias for mention system
          await trx
            .insertInto('record_aliases')
            .values({
              record_id: created.id,
              name: record.uniqueName,
              type: 'primary',
            })
            .execute();

          result.created++;
          result.records.push(created);
        }
      } catch (error) {
        result.errors.push({
          uniqueName: record.uniqueName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  return result;
}
