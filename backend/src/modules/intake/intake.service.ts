import {
  generateUniqueId,
  IntakeFormConfigSchema,
  IntakePageConfigSchema,
  type CreatedRecord,
  type RecordMapping,
} from '@autoart/shared';

import { db } from '../../db/client.js';
import type {
  IntakeForm,
  IntakeFormPage,
  IntakeSubmission,
  NewIntakeForm,
  NewIntakeFormPage,
  IntakeFormUpdate,
} from '../../db/schema.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import * as recordsService from '../records/records.service.js';

const MAX_UNIQUE_ID_RETRIES = 5;

export interface IntakeFormWithPages extends IntakeForm {
  pages: IntakeFormPage[];
}

export async function createForm(
  title: string,
  sharepointRequestUrl?: string
): Promise<IntakeForm> {
  let uniqueId = generateUniqueId(title);
  let retries = 0;

  while (retries < MAX_UNIQUE_ID_RETRIES) {
    try {
      const form = await db
        .insertInto('intake_forms')
        .values({
          unique_id: uniqueId,
          title,
          sharepoint_request_url: sharepointRequestUrl ?? null,
        } satisfies NewIntakeForm)
        .returningAll()
        .executeTakeFirstOrThrow();

      return form;
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === '23505';

      if (isUniqueViolation && retries < MAX_UNIQUE_ID_RETRIES - 1) {
        uniqueId = generateUniqueId(title);
        retries++;
      } else {
        throw err;
      }
    }
  }

  throw new ConflictError('Failed to generate unique ID after multiple attempts');
}

export async function listForms(): Promise<IntakeForm[]> {
  return db
    .selectFrom('intake_forms')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();
}

export async function getFormById(id: string): Promise<IntakeForm | undefined> {
  return db
    .selectFrom('intake_forms')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function getFormByUniqueId(uniqueId: string): Promise<IntakeForm | undefined> {
  return db
    .selectFrom('intake_forms')
    .selectAll()
    .where('unique_id', '=', uniqueId)
    .executeTakeFirst();
}

export async function getFormWithPages(id: string): Promise<IntakeFormWithPages | undefined> {
  const form = await getFormById(id);
  if (!form) return undefined;

  const pages = await db
    .selectFrom('intake_form_pages')
    .selectAll()
    .where('form_id', '=', id)
    .orderBy('page_index', 'asc')
    .execute();

  return { ...form, pages };
}

export async function getFormWithPagesByUniqueId(uniqueId: string): Promise<IntakeFormWithPages | undefined> {
  const form = await getFormByUniqueId(uniqueId);
  if (!form) return undefined;

  const pages = await db
    .selectFrom('intake_form_pages')
    .selectAll()
    .where('form_id', '=', form.id)
    .orderBy('page_index', 'asc')
    .execute();

  return { ...form, pages };
}

export async function updateForm(
  id: string,
  updates: IntakeFormUpdate
): Promise<IntakeForm> {
  const form = await db
    .updateTable('intake_forms')
    .set(updates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!form) {
    throw new NotFoundError('IntakeForm', id);
  }

  return form;
}

export async function upsertPage(
  formId: string,
  pageIndex: number,
  blocksConfig: unknown
): Promise<IntakeFormPage> {
  return db
    .insertInto('intake_form_pages')
    .values({
      form_id: formId,
      page_index: pageIndex,
      blocks_config: blocksConfig,
    } satisfies NewIntakeFormPage)
    .onConflict((oc) =>
      oc
        .columns(['form_id', 'page_index'])
        .doUpdateSet({ blocks_config: blocksConfig })
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deletePage(formId: string, pageIndex: number): Promise<void> {
  await db
    .deleteFrom('intake_form_pages')
    .where('form_id', '=', formId)
    .where('page_index', '=', pageIndex)
    .execute();
}

export interface SubmissionWithRecords extends IntakeSubmission {
  createdRecords: CreatedRecord[];
}

/**
 * Process RecordBlocks in a form submission.
 * Extracts field values from metadata using {blockId}:{fieldKey} pattern
 * and creates records for each RecordBlock with createInstance: true.
 */
async function processRecordBlocks(
  formId: string,
  metadata: Record<string, unknown>,
  trx: typeof db
): Promise<CreatedRecord[]> {
  const createdRecords: CreatedRecord[] = [];

  // Get form pages to find RecordBlocks
  const pages = await trx
    .selectFrom('intake_form_pages')
    .selectAll()
    .where('form_id', '=', formId)
    .execute();

  for (const page of pages) {
    let config;
    try {
      config = IntakeFormConfigSchema.parse(page.blocks_config);
    } catch {
      continue; // Skip invalid config
    }

    for (const block of config.blocks) {
      if (block.kind !== 'record' || !block.createInstance) {
        continue;
      }

      // Get definition to get the name
      const definition = await recordsService.getDefinitionById(block.definitionId);
      if (!definition) {
        continue; // Skip if definition doesn't exist
      }

      // Extract field values from metadata using {blockId}:{fieldKey} pattern
      const recordData: Record<string, unknown> = {};
      const blockPrefix = `${block.id}:`;

      for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith(blockPrefix)) {
          const fieldKey = key.slice(blockPrefix.length);
          recordData[fieldKey] = value;
        }
      }

      // Generate unique name: {definitionName}-{timestamp}
      const timestamp = Date.now();
      const uniqueName = `${definition.name}-${timestamp}`;

      // Create the record
      try {
        const record = await recordsService.createRecord({
          definitionId: block.definitionId,
          uniqueName,
          data: recordData,
        });

        createdRecords.push({
          definitionId: block.definitionId,
          recordId: record.id,
          uniqueName: record.unique_name,
        });
      } catch (err) {
        // Log but don't fail - continue processing other blocks
        console.error(`Failed to create record for block ${block.id}:`, err);
      }
    }
  }

  return createdRecords;
}

/**
 * Process RecordMappings in a form submission.
 * Uses the new block connector pattern: maps ModuleBlock values to record fields.
 */
async function processRecordMappings(
  formId: string,
  metadata: Record<string, unknown>,
  trx: typeof db
): Promise<CreatedRecord[]> {
  const createdRecords: CreatedRecord[] = [];

  // Get form pages to find RecordMappings
  const pages = await trx
    .selectFrom('intake_form_pages')
    .selectAll()
    .where('form_id', '=', formId)
    .execute();

  for (const page of pages) {
    let config;
    try {
      config = IntakePageConfigSchema.parse(page.blocks_config);
    } catch {
      continue; // Skip invalid config
    }

    const recordMappings = config.recordMappings as RecordMapping[] | undefined;
    if (!recordMappings || recordMappings.length === 0) {
      continue;
    }

    for (const mapping of recordMappings) {
      if (!mapping.createInstance || !mapping.definitionId) {
        continue;
      }

      // Get definition to get the name
      const definition = await recordsService.getDefinitionById(mapping.definitionId);
      if (!definition) {
        continue; // Skip if definition doesn't exist
      }

      // Build record data from field mappings
      const recordData: Record<string, unknown> = {};

      for (const fieldMapping of mapping.fieldMappings) {
        const value = metadata[fieldMapping.blockId];
        if (value !== undefined) {
          recordData[fieldMapping.fieldKey] = value;
        }
      }

      // Determine unique name
      let uniqueName: string;
      if (mapping.nameFieldKey && recordData[mapping.nameFieldKey]) {
        uniqueName = String(recordData[mapping.nameFieldKey]);
      } else {
        // Fallback: {definitionName}-{timestamp}
        const timestamp = Date.now();
        uniqueName = `${definition.name}-${timestamp}`;
      }

      // Create the record
      try {
        const record = await recordsService.createRecord({
          definitionId: mapping.definitionId,
          uniqueName,
          data: recordData,
        });

        createdRecords.push({
          definitionId: mapping.definitionId,
          recordId: record.id,
          uniqueName: record.unique_name,
        });
      } catch (err) {
        // Log but don't fail - continue processing other mappings
        console.error(`Failed to create record for mapping ${mapping.id}:`, err);
      }
    }
  }

  return createdRecords;
}

/**
 * Create a form submission with optional record creation.
 * Wraps submission insert and record creation in a transaction.
 */
export async function createSubmission(
  formId: string,
  uploadCode: string,
  metadata: unknown
): Promise<SubmissionWithRecords> {
  return await db.transaction().execute(async (trx) => {
    // Insert the submission first
    const submission = await trx
      .insertInto('intake_submissions')
      .values({
        form_id: formId,
        upload_code: uploadCode,
        metadata,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Process records from both RecordBlocks (legacy) and RecordMappings (new)
    const metadataObj = (typeof metadata === 'object' && metadata !== null)
      ? metadata as Record<string, unknown>
      : {};

    // Process legacy RecordBlocks
    const recordBlockRecords = await processRecordBlocks(formId, metadataObj, trx);

    // Process new RecordMappings (block connector pattern)
    const recordMappingRecords = await processRecordMappings(formId, metadataObj, trx);

    // Combine all created records
    const createdRecords = [...recordBlockRecords, ...recordMappingRecords];

    // Update submission with created records
    if (createdRecords.length > 0) {
      await trx
        .updateTable('intake_submissions')
        .set({ created_records: JSON.stringify(createdRecords) })
        .where('id', '=', submission.id)
        .execute();
    }

    return {
      ...submission,
      created_records: createdRecords,
      createdRecords,
    };
  });
}

export async function listSubmissions(
  formId: string,
  limit = 50,
  offset = 0
): Promise<IntakeSubmission[]> {
  return db
    .selectFrom('intake_submissions')
    .selectAll()
    .where('form_id', '=', formId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();
}

export async function getSubmissionById(id: string): Promise<IntakeSubmission | undefined> {
  return db
    .selectFrom('intake_submissions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

/**
 * Get a record definition that is referenced by a form's RecordBlock.
 * Returns sanitized definition with only public fields (id, name, fields).
 *
 * Security: Only returns definition if it's actually referenced by the form.
 * This prevents enumeration of all definitions via the public API.
 */
export async function getDefinitionForForm(
  uniqueId: string,
  definitionId: string
): Promise<{ id: string; name: string; fields: unknown[] } | null> {
  // Get form with pages
  const form = await getFormWithPagesByUniqueId(uniqueId);
  if (!form || form.status !== 'active') {
    return null;
  }

  // Check if any page's blocks reference this definition
  let definitionReferenced = false;
  for (const page of form.pages) {
    try {
      // Parse blocks_config as IntakeFormConfig
      const config = IntakeFormConfigSchema.parse(page.blocks_config);

      // Check if any RecordBlock references this definitionId
      for (const block of config.blocks) {
        if (block.kind === 'record' && block.definitionId === definitionId) {
          definitionReferenced = true;
          break;
        }
      }

      if (definitionReferenced) break;
    } catch {
      // Invalid blocks_config - skip this page
      continue;
    }
  }

  if (!definitionReferenced) {
    return null;
  }

  // Fetch the definition
  const definition = await recordsService.getDefinitionById(definitionId);
  if (!definition) {
    return null;
  }

  // Parse schema_config to extract fields
  let fields: unknown[] = [];
  try {
    const schemaConfig = typeof definition.schema_config === 'string'
      ? JSON.parse(definition.schema_config)
      : definition.schema_config;

    fields = Array.isArray(schemaConfig?.fields) ? schemaConfig.fields : [];
  } catch {
    // Invalid schema_config
    fields = [];
  }

  // Return sanitized definition
  return {
    id: definition.id,
    name: definition.name,
    fields,
  };
}
