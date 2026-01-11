import type { ResolvedReference, ReferenceStatus } from '@autoart/shared';

import type { CreateReferenceInput, UpdateReferenceModeInput } from './references.schemas.js';
import { db } from '../../db/client.js';
import type { TaskReference } from '../../db/schema.js';
import { NotFoundError } from '../../utils/errors.js';


/**
 * Compute the reference status based on mode and resolution state
 */
function computeStatus(
  mode: 'static' | 'dynamic',
  sourceRecordId: string | null,
  targetFieldKey: string | null
): ReferenceStatus {
  // Check if target is unresolved
  if (!sourceRecordId || !targetFieldKey) {
    return 'unresolved';
  }
  // Mode maps directly to status for resolved references
  return mode;
}

export async function getReferenceById(id: string): Promise<TaskReference | null> {
  const ref = await db
    .selectFrom('task_references')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return ref || null;
}

export async function getReferencesForTask(taskId: string): Promise<TaskReference[]> {
  return db
    .selectFrom('task_references')
    .selectAll()
    .where('task_id', '=', taskId)
    .orderBy('created_at')
    .execute();
}

export async function createReference(input: CreateReferenceInput): Promise<TaskReference> {
  // Verify task exists
  const task = await db
    .selectFrom('hierarchy_nodes')
    .select('id')
    .where('id', '=', input.taskId)
    .executeTakeFirst();

  if (!task) {
    throw new NotFoundError('Task', input.taskId);
  }

  // Verify record exists
  const record = await db
    .selectFrom('records')
    .select(['id', 'data'])
    .where('id', '=', input.sourceRecordId)
    .executeTakeFirst();

  if (!record) {
    throw new NotFoundError('Record', input.sourceRecordId);
  }

  // Get snapshot value if static
  let snapshotValue = null;
  if (input.mode === 'static') {
    const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
    snapshotValue = data[input.targetFieldKey] ?? null;
  }

  const ref = await db
    .insertInto('task_references')
    .values({
      task_id: input.taskId,
      source_record_id: input.sourceRecordId,
      target_field_key: input.targetFieldKey,
      mode: input.mode,
      snapshot_value: snapshotValue !== null ? JSON.stringify(snapshotValue) : null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return ref;
}

export async function updateReferenceMode(id: string, input: UpdateReferenceModeInput): Promise<TaskReference> {
  const existing = await getReferenceById(id);
  if (!existing) {
    throw new NotFoundError('Reference', id);
  }

  let snapshotValue = existing.snapshot_value;

  // If switching to static, capture current value
  if (input.mode === 'static' && existing.mode === 'dynamic') {
    if (existing.source_record_id && existing.target_field_key) {
      const record = await db
        .selectFrom('records')
        .select('data')
        .where('id', '=', existing.source_record_id)
        .executeTakeFirst();

      if (record) {
        const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
        snapshotValue = data[existing.target_field_key] ?? null;
        if (snapshotValue !== null) {
          snapshotValue = JSON.stringify(snapshotValue);
        }
      }
    }
  }

  // If switching to dynamic, clear snapshot
  if (input.mode === 'dynamic' && existing.mode === 'static') {
    snapshotValue = null;
  }

  const ref = await db
    .updateTable('task_references')
    .set({
      mode: input.mode,
      snapshot_value: snapshotValue,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return ref;
}

export async function updateSnapshotValue(id: string, value: unknown): Promise<TaskReference> {
  const existing = await getReferenceById(id);
  if (!existing) {
    throw new NotFoundError('Reference', id);
  }

  const ref = await db
    .updateTable('task_references')
    .set({
      snapshot_value: value !== null ? JSON.stringify(value) : null,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return ref;
}

export async function deleteReference(id: string): Promise<void> {
  const existing = await getReferenceById(id);
  if (!existing) {
    throw new NotFoundError('Reference', id);
  }

  await db
    .deleteFrom('task_references')
    .where('id', '=', id)
    .execute();
}

// Resolve a single reference
export async function resolveReference(id: string): Promise<ResolvedReference> {
  const ref = await db
    .selectFrom('task_references')
    .leftJoin('records', 'records.id', 'task_references.source_record_id')
    .select([
      'task_references.id as referenceId',
      'task_references.mode',
      'task_references.snapshot_value',
      'task_references.source_record_id',
      'task_references.target_field_key',
      'records.data as recordData',
      'records.unique_name',
    ])
    .where('task_references.id', '=', id)
    .executeTakeFirst();

  if (!ref) {
    throw new NotFoundError('Reference', id);
  }

  const recordData = ref.recordData
    ? (typeof ref.recordData === 'string' ? JSON.parse(ref.recordData) : ref.recordData)
    : {};

  const liveValue = ref.target_field_key ? recordData[ref.target_field_key] : null;

  let value: unknown;
  let drift = false;

  if (ref.mode === 'static') {
    const snapshot = ref.snapshot_value
      ? (typeof ref.snapshot_value === 'string' ? JSON.parse(ref.snapshot_value as string) : ref.snapshot_value)
      : null;
    value = snapshot;
    // Check for drift
    drift = JSON.stringify(snapshot) !== JSON.stringify(liveValue);
  } else {
    value = liveValue;
  }

  const label = ref.unique_name && ref.target_field_key
    ? `#${ref.unique_name}:${ref.target_field_key}`
    : '#unknown';

  const status = computeStatus(ref.mode, ref.source_record_id, ref.target_field_key);

  return {
    referenceId: ref.referenceId,
    status,
    value,
    label,
    sourceRecordId: ref.source_record_id,
    targetFieldKey: ref.target_field_key,
    drift: drift || undefined,
    liveValue: drift ? liveValue : undefined,
  };
}

// Batch resolve multiple references
export async function batchResolveReferences(referenceIds: string[]): Promise<Record<string, ResolvedReference>> {
  const refs = await db
    .selectFrom('task_references')
    .leftJoin('records', 'records.id', 'task_references.source_record_id')
    .select([
      'task_references.id as referenceId',
      'task_references.mode',
      'task_references.snapshot_value',
      'task_references.source_record_id',
      'task_references.target_field_key',
      'records.data as recordData',
      'records.unique_name',
    ])
    .where('task_references.id', 'in', referenceIds)
    .execute();

  const result: Record<string, ResolvedReference> = {};

  for (const ref of refs) {
    const recordData = ref.recordData
      ? (typeof ref.recordData === 'string' ? JSON.parse(ref.recordData) : ref.recordData)
      : {};

    const liveValue = ref.target_field_key ? recordData[ref.target_field_key] : null;

    let value: unknown;
    let drift = false;

    if (ref.mode === 'static') {
      const snapshot = ref.snapshot_value
        ? (typeof ref.snapshot_value === 'string' ? JSON.parse(ref.snapshot_value as string) : ref.snapshot_value)
        : null;
      value = snapshot;
      drift = JSON.stringify(snapshot) !== JSON.stringify(liveValue);
    } else {
      value = liveValue;
    }

    const label = ref.unique_name && ref.target_field_key
      ? `#${ref.unique_name}:${ref.target_field_key}`
      : '#unknown';

    const status = computeStatus(ref.mode, ref.source_record_id, ref.target_field_key);

    result[ref.referenceId] = {
      referenceId: ref.referenceId,
      status,
      value,
      label,
      sourceRecordId: ref.source_record_id,
      targetFieldKey: ref.target_field_key,
      drift: drift || undefined,
      liveValue: drift ? liveValue : undefined,
    };
  }

  return result;
}

// Check drift for a single reference
export async function checkDrift(id: string): Promise<{ drift: boolean; snapshotValue: unknown; liveValue: unknown }> {
  const resolved = await resolveReference(id);
  return {
    drift: resolved.drift ?? false,
    snapshotValue: resolved.value,
    liveValue: resolved.liveValue ?? resolved.value,
  };
}

// Get backlinks - find all references to a specific record
export async function getBacklinks(recordId: string): Promise<TaskReference[]> {
  return db
    .selectFrom('task_references')
    .selectAll()
    .where('source_record_id', '=', recordId)
    .execute();
}
