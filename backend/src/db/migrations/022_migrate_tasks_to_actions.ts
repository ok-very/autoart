/**
 * Migration 022: Migrate Tasks to Actions + Events
 *
 * Converts legacy task/subtask hierarchy nodes into the foundational model:
 * - Creates Actions for each task/subtask
 * - Emits synthetic Events (ACTION_DECLARED, FIELD_VALUE_RECORDED, WORK_FINISHED)
 * - Creates action_references from legacy task_references
 * - Keeps task/subtask nodes as read-only coordinates
 *
 * After this migration:
 * - Task nodes become "scaffolding" - positional only, never mutated
 * - All task state is derived from Actions + Events
 * - task_references remain read-only (deprecated, for traceability)
 *
 * Part of Phase 5: Migration (One-Way, Ontology-Preserving)
 */

import { Kysely, sql } from 'kysely';

interface TaskNode {
  id: string;
  parent_id: string | null;
  type: string;
  title: string;
  description: unknown;
  metadata: unknown;
}

interface TaskReference {
  id: string;
  task_id: string;
  source_record_id: string | null;
  target_field_key: string | null;
  mode: string;
  snapshot_value: unknown;
}

export async function up(db: Kysely<unknown>): Promise<void> {
  // Step 1: Get all task and subtask nodes
  const taskNodes = await sql<TaskNode>`
    SELECT id, parent_id, type, title, description, metadata
    FROM hierarchy_nodes
    WHERE type IN ('task', 'subtask')
    ORDER BY created_at ASC
  `.execute(db);

  console.log(`  → Found ${taskNodes.rows.length} task/subtask nodes to migrate`);

  // Step 2: Create a mapping from task_id to action_id
  const taskToActionMap = new Map<string, string>();

  for (const task of taskNodes.rows) {
    // Find the parent subprocess (context)
    // For tasks, parent is subprocess
    // For subtasks, parent is task, grandparent is subprocess
    let contextId = task.parent_id;
    let contextType = 'subprocess';

    if (task.type === 'subtask' && task.parent_id) {
      // Get the parent task's parent (the subprocess)
      const parentResult = await sql<{ parent_id: string | null }>`
        SELECT parent_id FROM hierarchy_nodes WHERE id = ${task.parent_id}
      `.execute(db);

      if (parentResult.rows.length > 0 && parentResult.rows[0].parent_id) {
        contextId = parentResult.rows[0].parent_id;
      }
    }

    if (!contextId) {
      console.log(`  ⚠ Skipping ${task.type} ${task.id}: no parent context`);
      continue;
    }

    // Create Action
    const actionResult = await sql<{ id: string }>`
      INSERT INTO actions (context_id, context_type, type, field_bindings)
      VALUES (
        ${contextId}::uuid,
        ${contextType},
        ${task.type},
        ${JSON.stringify([
      { fieldKey: 'title', value: task.title },
      { fieldKey: 'description', value: task.description },
      { fieldKey: 'legacy_node_id', value: task.id },
    ])}::jsonb
      )
      RETURNING id
    `.execute(db);

    const actionId = actionResult.rows[0].id;
    taskToActionMap.set(task.id, actionId);

    // Emit ACTION_DECLARED event
    await sql`
      INSERT INTO events (context_id, context_type, action_id, type, payload, actor_id)
      VALUES (
        ${contextId}::uuid,
        ${contextType},
        ${actionId}::uuid,
        'ACTION_DECLARED',
        ${JSON.stringify({
      actionType: task.type,
      migrated: true,
      legacyNodeId: task.id,
    })}::jsonb,
        NULL
      )
    `.execute(db);

    // Emit FIELD_VALUE_RECORDED for title
    await sql`
      INSERT INTO events (context_id, context_type, action_id, type, payload, actor_id)
      VALUES (
        ${contextId}::uuid,
        ${contextType},
        ${actionId}::uuid,
        'FIELD_VALUE_RECORDED',
        ${JSON.stringify({
      fieldKey: 'title',
      value: task.title,
      migrated: true,
    })}::jsonb,
        NULL
      )
    `.execute(db);

    // Emit FIELD_VALUE_RECORDED for description if present
    if (task.description) {
      await sql`
        INSERT INTO events (context_id, context_type, action_id, type, payload, actor_id)
        VALUES (
          ${contextId}::uuid,
          ${contextType},
          ${actionId}::uuid,
          'FIELD_VALUE_RECORDED',
          ${JSON.stringify({
        fieldKey: 'description',
        value: task.description,
        migrated: true,
      })}::jsonb,
          NULL
        )
      `.execute(db);
    }

    // Check if task was completed (look in metadata)
    const metadata = (typeof task.metadata === 'string'
      ? JSON.parse(task.metadata)
      : task.metadata) as Record<string, unknown> | null;

    const status = metadata?.status as string | undefined;
    if (status === 'completed' || status === 'done' || status === 'finished') {
      await sql`
        INSERT INTO events (context_id, context_type, action_id, type, payload, actor_id)
        VALUES (
          ${contextId}::uuid,
          ${contextType},
          ${actionId}::uuid,
          'WORK_FINISHED',
          ${JSON.stringify({
        migrated: true,
        legacyStatus: status,
      })}::jsonb,
          NULL
        )
      `.execute(db);
    }
  }

  console.log(`  ✓ Created ${taskToActionMap.size} Actions with Events`);

  // Step 3: Migrate task_references to action_references
  const taskRefs = await sql<TaskReference>`
    SELECT id, task_id, source_record_id, target_field_key, mode, snapshot_value
    FROM task_references
  `.execute(db);

  let refsCreated = 0;
  for (const ref of taskRefs.rows) {
    const actionId = taskToActionMap.get(ref.task_id);
    if (!actionId) {
      console.log(`  ⚠ Skipping reference ${ref.id}: task ${ref.task_id} not migrated`);
      continue;
    }

    await sql`
      INSERT INTO action_references (
        action_id, source_record_id, target_field_key, mode, snapshot_value, legacy_task_reference_id
      )
      VALUES (
        ${actionId}::uuid,
        ${ref.source_record_id}::uuid,
        ${ref.target_field_key},
        ${ref.mode}::ref_mode,
        ${ref.snapshot_value ? JSON.stringify(ref.snapshot_value) : null}::jsonb,
        ${ref.id}::uuid
      )
    `.execute(db);
    refsCreated++;
  }

  console.log(`  ✓ Created ${refsCreated} action_references from ${taskRefs.rows.length} task_references`);

  // Step 4: Add comment to task_references table marking it deprecated
  await sql`
    COMMENT ON TABLE task_references IS 'DEPRECATED: Read-only after migration 022. Use action_references instead.'
  `.execute(db);

  console.log('  ✓ Marked task_references as deprecated');

  // Step 5: Store migration mapping for traceability
  // Add legacy_action_id to hierarchy_nodes metadata
  for (const [taskId, actionId] of taskToActionMap) {
    await sql`
      UPDATE hierarchy_nodes
      SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
      legacy_migrated: true,
      action_id: actionId,
      migrated_at: new Date().toISOString(),
    })}::jsonb
      WHERE id = ${taskId}::uuid
    `.execute(db);
  }

  console.log('  ✓ Updated task nodes with migration metadata');
  console.log('  ✓ Migration complete: Tasks are now read-only coordinates');
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // WARNING: This is a destructive rollback
  // It removes all migrated actions, events, and action_references

  // Remove migration metadata from task nodes
  await sql`
    UPDATE hierarchy_nodes
    SET metadata = metadata - 'legacy_migrated' - 'action_id' - 'migrated_at'
    WHERE type IN ('task', 'subtask')
  `.execute(db);

  // Delete action_references that came from migration
  await sql`
    DELETE FROM action_references
    WHERE legacy_task_reference_id IS NOT NULL
  `.execute(db);

  // Delete events from migrated actions
  await sql`
    DELETE FROM events
    WHERE (payload->>'migrated')::boolean = true
  `.execute(db);

  // Delete migrated actions
  await sql`
    DELETE FROM actions
    WHERE (field_bindings @> '[{"fieldKey": "legacy_node_id"}]')
  `.execute(db);

  // Remove deprecation comment
  await sql`
    COMMENT ON TABLE task_references IS NULL
  `.execute(db);

  console.log('  ✓ Rolled back task-to-action migration');
}
