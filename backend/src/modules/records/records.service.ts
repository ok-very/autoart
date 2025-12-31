import { sql } from 'kysely';
import { db } from '../../db/client.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import type {
  CreateDefinitionInput,
  UpdateDefinitionInput,
  SaveToLibraryInput,
  CloneDefinitionInput,
  CreateRecordInput,
  UpdateRecordInput,
  ListRecordsQuery,
} from './records.schemas.js';
import type { RecordDefinition, DataRecord } from '../../db/schema.js';

// ==================== DEFINITIONS ====================

export async function listDefinitions(): Promise<RecordDefinition[]> {
  return db
    .selectFrom('record_definitions')
    .selectAll()
    .orderBy('name')
    .execute();
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
  const def = await db
    .insertInto('record_definitions')
    .values({
      name: input.name,
      schema_config: JSON.stringify(input.schemaConfig),
      styling: input.styling ? JSON.stringify(input.styling) : '{}',
      project_id: input.projectId || null,
      is_template: input.isTemplate || false,
    })
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

  const cloned = await db
    .insertInto('record_definitions')
    .values({
      name: input.newName,
      derived_from_id: id,
      schema_config: schemaConfig,
      styling: source.styling,
    })
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
 * Clone all template definitions from one project to another
 * Used when cloning a project with "include templates" option
 * @deprecated Use cloneProjectDefinitions instead
 */
export async function cloneProjectTemplates(
  sourceProjectId: string,
  targetProjectId: string
): Promise<RecordDefinition[]> {
  // Delegate to new function for backward compatibility
  return cloneProjectDefinitions(sourceProjectId, targetProjectId);
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
    q = q.where('unique_name', 'ilike', `%${query.search}%`);
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

export async function createRecord(input: CreateRecordInput, userId?: string): Promise<DataRecord> {
  // Verify definition exists
  const def = await getDefinitionById(input.definitionId);
  if (!def) {
    throw new NotFoundError('Record definition', input.definitionId);
  }

  const record = await db
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

  return record;
}

export async function updateRecord(id: string, input: UpdateRecordInput): Promise<DataRecord> {
  const existing = await getRecordById(id);
  if (!existing) {
    throw new NotFoundError('Record', id);
  }

  const updates: { [key: string]: unknown } = { updated_at: new Date() };
  if (input.uniqueName !== undefined) updates.unique_name = input.uniqueName;
  if (input.classificationNodeId !== undefined) updates.classification_node_id = input.classificationNodeId;
  if (input.data !== undefined) updates.data = JSON.stringify(input.data);

  const record = await db
    .updateTable('records')
    .set(updates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return record;
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
 * Delete multiple records at once
 */
export async function bulkDeleteRecords(recordIds: string[]): Promise<number> {
  if (recordIds.length === 0) return 0;

  // First delete any links involving these records
  await db
    .deleteFrom('record_links')
    .where((eb) =>
      eb.or([
        eb('source_record_id', 'in', recordIds),
        eb('target_record_id', 'in', recordIds),
      ])
    )
    .execute();

  // Then delete task references pointing to these records
  await db
    .deleteFrom('task_references')
    .where('source_record_id', 'in', recordIds)
    .execute();

  // Finally delete the records
  const result = await db
    .deleteFrom('records')
    .where('id', 'in', recordIds)
    .execute();

  return result.reduce((sum, r) => sum + Number(r.numDeletedRows), 0);
}
