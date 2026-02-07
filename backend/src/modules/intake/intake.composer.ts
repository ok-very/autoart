/**
 * Intake Composer - Processes block record bindings during form submission.
 *
 * Groups bound blocks by (definitionId, groupKey), then for each group:
 * - mode='create': creates a record + Composer action + events
 * - mode='link': auto-matches existing record, or creates new as fallback
 *
 * Runs within the submission transaction for atomicity.
 */

import type { Transaction } from 'kysely';

import type { CreatedRecord, ComposerInput, ContextType, BlockRecordBinding } from '@autoart/shared';

import type { Database } from '../../db/schema.js';
import * as recordsService from '../records/records.service.js';
import { compose } from '../composer/composer.service.js';

interface BoundBlock {
  blockId: string;
  binding: BlockRecordBinding;
  value: unknown;
}

interface BlockGroup {
  definitionId: string;
  groupKey: string;
  mode: 'create' | 'link';
  blocks: BoundBlock[];
  linkMatchField?: string;
}

/**
 * Process block bindings for a form submission.
 * Loads form blocks, groups by (definitionId, groupKey), creates records + Composer actions.
 */
export async function processBlockBindings(
  formId: string,
  classificationNodeId: string,
  metadata: Record<string, unknown>,
  trx: Transaction<Database>
): Promise<CreatedRecord[]> {
  const createdRecords: CreatedRecord[] = [];

  // Load form pages to find blocks with bindings
  const pages = await trx
    .selectFrom('intake_form_pages')
    .selectAll()
    .where('form_id', '=', formId)
    .execute();

  // Collect all bound blocks from all pages
  const boundBlocks: BoundBlock[] = [];
  for (const page of pages) {
    const config = page.blocks_config as { blocks?: Array<{ id: string; recordBinding?: BlockRecordBinding }> };
    if (!config?.blocks) continue;

    for (const block of config.blocks) {
      if (!block.recordBinding) continue;

      boundBlocks.push({
        blockId: block.id,
        binding: block.recordBinding,
        value: metadata[block.id],
      });
    }
  }

  if (boundBlocks.length === 0) return createdRecords;

  // Resolve context type from classification node
  const node = await trx
    .selectFrom('hierarchy_nodes')
    .select(['type'])
    .where('id', '=', classificationNodeId)
    .executeTakeFirst();

  if (!node) return createdRecords;

  // Templates aren't valid action contexts
  if (node.type === 'template') return createdRecords;
  const contextType = node.type as ContextType;

  // Group blocks by (definitionId, groupKey)
  const groupMap = new Map<string, BlockGroup>();
  for (const bb of boundBlocks) {
    const key = `${bb.binding.definitionId}::${bb.binding.groupKey ?? 'default'}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        definitionId: bb.binding.definitionId,
        groupKey: bb.binding.groupKey ?? 'default',
        mode: bb.binding.mode,
        blocks: [],
        linkMatchField: bb.binding.linkMatchField,
      });
    }
    groupMap.get(key)!.blocks.push(bb);
  }

  // Process each group
  for (const group of groupMap.values()) {
    const definition = await recordsService.getDefinitionById(group.definitionId);
    if (!definition) continue;

    // Aggregate block values into record data (skip undefined to avoid overwriting existing data in link mode)
    const recordData: Record<string, unknown> = {};
    for (const bb of group.blocks) {
      if (bb.value !== undefined) {
        recordData[bb.binding.fieldKey] = bb.value;
      }
    }

    if (group.mode === 'create') {
      const result = await processCreateGroup(
        group, definition, recordData, classificationNodeId, contextType, formId, trx
      );
      if (result) createdRecords.push(result);
    } else {
      const result = await processLinkGroup(
        group, definition, recordData, classificationNodeId, contextType, formId, trx
      );
      if (result) createdRecords.push(result);
    }
  }

  return createdRecords;
}

async function processCreateGroup(
  group: BlockGroup,
  definition: { id: string; name: string },
  recordData: Record<string, unknown>,
  classificationNodeId: string,
  contextType: ContextType,
  formId: string,
  trx: Transaction<Database>
): Promise<CreatedRecord | null> {
  const uniqueName = `${definition.name}-${Date.now()}`;

  try {
    const record = await recordsService.createRecord(
      {
        definitionId: group.definitionId,
        uniqueName,
        classificationNodeId,
        data: recordData,
      },
      undefined,
      trx
    );

    const composerInput: ComposerInput = {
      action: {
        contextId: classificationNodeId,
        contextType,
        type: definition.name,
        fieldBindings: [],
      },
      references: [{ sourceRecordId: record.id, mode: 'dynamic' as const }],
      emitExtraEvents: [{
        type: 'FACT_RECORDED',
        payload: {
          factKind: 'DOCUMENT_SUBMITTED',
          formId,
          definitionId: group.definitionId,
          recordId: record.id,
        },
      }],
    };

    await compose(composerInput, { actorId: null, skipView: true, trx });

    return {
      definitionId: group.definitionId,
      recordId: record.id,
      uniqueName: record.unique_name,
    };
  } catch (err) {
    console.error(`[intake.composer] Failed to create record for group ${group.definitionId}:${group.groupKey}:`, err);
    return null;
  }
}

async function processLinkGroup(
  group: BlockGroup,
  definition: { id: string; name: string },
  recordData: Record<string, unknown>,
  classificationNodeId: string,
  contextType: ContextType,
  formId: string,
  trx: Transaction<Database>
): Promise<CreatedRecord | null> {
  try {
    let existingRecord: { id: string; unique_name: string } | undefined;

    // Try to find existing record by linkMatchField
    if (group.linkMatchField && recordData[group.linkMatchField] !== undefined) {
      const matchValue = String(recordData[group.linkMatchField]);

      const found = await trx
        .selectFrom('records')
        .select(['id', 'unique_name'])
        .where('definition_id', '=', group.definitionId)
        .where((eb) =>
          eb(eb.fn('jsonb_extract_path_text', ['data', eb.val(group.linkMatchField!)]), '=', matchValue)
        )
        .executeTakeFirst();

      existingRecord = found;
    }

    if (existingRecord) {
      // Update existing record's fields with submitted values
      const existingData = await trx
        .selectFrom('records')
        .select('data')
        .where('id', '=', existingRecord.id)
        .executeTakeFirst();

      const merged = {
        ...(typeof existingData?.data === 'object' && existingData?.data !== null ? existingData.data : {}),
        ...recordData,
      };

      await trx
        .updateTable('records')
        .set({ data: JSON.stringify(merged) })
        .where('id', '=', existingRecord.id)
        .execute();

      // Create Composer action referencing existing record
      const composerInput: ComposerInput = {
        action: {
          contextId: classificationNodeId,
          contextType,
          type: definition.name,
          fieldBindings: [],
        },
        references: [{ sourceRecordId: existingRecord.id, mode: 'dynamic' as const }],
        emitExtraEvents: [{
          type: 'FACT_RECORDED',
          payload: {
            factKind: 'DOCUMENT_SUBMITTED',
            formId,
            definitionId: group.definitionId,
            recordId: existingRecord.id,
          },
        }],
      };

      await compose(composerInput, { actorId: null, skipView: true, trx });

      return {
        definitionId: group.definitionId,
        recordId: existingRecord.id,
        uniqueName: existingRecord.unique_name,
      };
    }

    // Fallback: create new record
    const uniqueName = `${definition.name}-${Date.now()}`;
    const record = await recordsService.createRecord(
      {
        definitionId: group.definitionId,
        uniqueName,
        classificationNodeId,
        data: recordData,
      },
      undefined,
      trx
    );

    const composerInput: ComposerInput = {
      action: {
        contextId: classificationNodeId,
        contextType,
        type: definition.name,
        fieldBindings: [],
      },
      references: [{ sourceRecordId: record.id, mode: 'dynamic' as const }],
      emitExtraEvents: [{
        type: 'FACT_RECORDED',
        payload: {
          factKind: 'intake_link_unresolved',
          formId,
          definitionId: group.definitionId,
          recordId: record.id,
        },
      }],
    };

    await compose(composerInput, { actorId: null, skipView: true, trx });

    return {
      definitionId: group.definitionId,
      recordId: record.id,
      uniqueName: record.unique_name,
    };
  } catch (err) {
    console.error(`[intake.composer] Failed to link record for group ${group.definitionId}:${group.groupKey}:`, err);
    return null;
  }
}
