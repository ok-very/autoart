/**
 * Development Sample Data
 *
 * This creates DISPOSABLE test data for development.
 * This is NOT reference data - it can be deleted and recreated freely.
 *
 * Run with: npm run seed:dev
 *
 * APPROACH:
 * Reads the real Avisina CSV from _test-data/, parses it through
 * MondayCSVParser.parse(), stores the result as a real import_session +
 * import_plan, then creates hierarchy nodes and actions from the parsed
 * output. Validation issues from the parser are preserved in the import
 * plan — visible in SelectionInspector.
 *
 * ARCHITECTURE NOTE:
 * This seed follows the event-sourced Action architecture:
 * - Only 'project' type is created as a hierarchy_node (root anchor)
 * - All other entities (Process, Stage, Subprocess, Task, Subtask)
 *   are created as Actions with ACTION_DECLARED events
 * - parent_action_id maintains the hierarchy within the Action tree
 *
 * DO NOT create hierarchy_nodes with type: 'process', 'stage', or 'subprocess'
 * directly. Use the Action system for work items.
 */

import bcrypt from 'bcryptjs';
import fs from 'fs';
import { Kysely } from 'kysely';
import path from 'path';
import { fileURLToPath } from 'url';

import * as composerService from '../../modules/composer/composer.service.js';
import { MondayCSVParser } from '../../modules/imports/parsers/monday-csv-parser.js';
import type { ImportPlanItem } from '../../modules/imports/types.js';
import { projectWorkflowSurface } from '../../modules/projections/workflow-surface.projector.js';
import { initializeDatabase } from '../client.js';
import type { Database } from '../schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// STATUS MAPPING
// ============================================================================

/**
 * Map CSV task statuses to work lifecycle events.
 * Returns null for statuses that don't produce events.
 */
function statusToWorkEvent(status: string | null | undefined): string | null {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case 'executed':
    case 'done':
    case 'milestone':
      return 'WORK_FINISHED';
    case 'working on it':
      return 'WORK_STARTED';
    case 'not started':
    case 'not applicable':
    case '':
      return null;
    default:
      return null;
  }
}

// ============================================================================
// HELPER: Extract field bindings (schema) and field values (data) from item
// ============================================================================

function extractFields(item: ImportPlanItem): {
  fieldBindings: Array<{ fieldKey: string }>;
  fieldValues: Array<{ fieldName: string; value: unknown }>;
} {
  const fieldBindings: Array<{ fieldKey: string }> = [{ fieldKey: 'title' }];
  const fieldValues: Array<{ fieldName: string; value: unknown }> = [
    { fieldName: 'title', value: item.title },
  ];

  for (const rec of item.fieldRecordings) {
    const keyMap: Record<string, string> = {
      Status: 'status',
      'Target Date': 'targetDate',
      Priority: 'priority',
      Notes: 'description',
      Owner: 'assignee',
    };
    const fieldKey = keyMap[rec.fieldName] ?? rec.fieldName;
    if (rec.value != null && rec.value !== '') {
      fieldBindings.push({ fieldKey });
      fieldValues.push({ fieldName: fieldKey, value: rec.value });
    }
  }

  return { fieldBindings, fieldValues };
}

// ============================================================================
// MAIN SEED
// ============================================================================

export async function seedDevData(db: Kysely<Database>): Promise<void> {
  console.log('  Seeding development sample data...');

  // =========================================================================
  // 1. Upsert demo user
  // =========================================================================

  const passwordHash = await bcrypt.hash('demo123', 10);
  const [demoUser] = await db
    .insertInto('users')
    .values({
      email: 'demo@autoart.local',
      password_hash: passwordHash,
      name: 'Demo User',
    })
    .onConflict((oc) => oc.column('email').doUpdateSet({ password_hash: passwordHash }))
    .returning('id')
    .execute();

  console.log('  ✓ Demo user ready (demo@autoart.local / demo123)');

  // =========================================================================
  // 2. Skip if project already exists (idempotent)
  // =========================================================================

  const existingProject = await db
    .selectFrom('hierarchy_nodes')
    .select('id')
    .where('title', '=', 'Avisina - Broadview Village')
    .where('created_by', '=', demoUser.id)
    .executeTakeFirst();

  if (existingProject) {
    console.log('  ⏭ Sample data already exists, skipping');
    return;
  }

  // =========================================================================
  // 3. Create project hierarchy_node (root anchor)
  // =========================================================================

  const [project] = await db
    .insertInto('hierarchy_nodes')
    .values({
      type: 'project',
      title: 'Avisina - Broadview Village',
      description: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Public art commission for Avisina development at Broadview Village, Burnaby BC. Managed by Ballard Fine Art.',
              },
            ],
          },
        ],
      }),
      metadata: JSON.stringify({
        client: 'Avisina Development',
        location: 'Broadview Village, Burnaby BC',
      }),
      created_by: demoUser.id,
      position: 0,
    })
    .returning('id')
    .execute();

  await db
    .updateTable('hierarchy_nodes')
    .set({ root_project_id: project.id })
    .where('id', '=', project.id)
    .execute();

  console.log('  ✓ Created project node (hierarchy anchor)');

  // =========================================================================
  // 4. Read CSV and parse with MondayCSVParser
  // =========================================================================

  const csvPath = path.resolve(
    __dirname,
    '..', '..', '..', '..', '_test-data',
    'Avisina_-_Broadview_Village_-_P1_1765493434.csv',
  );
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const parser = new MondayCSVParser();
  const { containers, items, validationIssues } = parser.parse(csvContent);

  console.log(`  ✓ Parsed CSV: ${containers.length} containers, ${items.length} items, ${validationIssues.length} validation issues`);

  // =========================================================================
  // 5. Insert import_session + import_plan
  // =========================================================================

  const [importSession] = await db
    .insertInto('import_sessions')
    .values({
      parser_name: 'monday-csv',
      status: 'completed',
      raw_data: csvContent,
      parser_config: JSON.stringify({}),
      target_project_id: project.id,
      created_by: demoUser.id,
    })
    .returning('id')
    .execute();

  await db
    .insertInto('import_plans')
    .values({
      session_id: importSession.id,
      plan_data: JSON.stringify({
        sessionId: importSession.id,
        containers,
        items,
        validationIssues,
        classifications: [],
      }),
      validation_issues: JSON.stringify(validationIssues),
    })
    .execute();

  console.log('  ✓ Created import session + plan (with validation issues)');

  // =========================================================================
  // 6-7. Create actions via Composer (containers + items) in one transaction
  // =========================================================================

  // Initialize the db client module so Composer and Projector can use it
  await initializeDatabase();

  const containerActionMap = new Map<string, string>();
  const itemActionMap = new Map<string, string>();
  const userId = demoUser.id;
  let taskCount = 0;
  let subtaskCount = 0;
  let workEventCount = 0;

  await db.transaction().execute(async (trx) => {
    // --- 6. Containers ---

    for (const container of containers) {
      let actionType: string;
      if (container.type === 'process') {
        actionType = 'Process';
      } else if (container.definitionName === 'stage') {
        actionType = 'Stage';
      } else {
        actionType = 'Subprocess';
      }

      const parentActionId = container.parentTempId
        ? containerActionMap.get(container.parentTempId) ?? undefined
        : undefined;

      const result = await composerService.compose({
        action: {
          contextId: project.id,
          contextType: 'project',
          parentActionId,
          type: actionType,
          fieldBindings: [{ fieldKey: 'title' }],
        },
        fieldValues: [{ fieldName: 'title', value: container.title }],
      }, { actorId: userId, skipView: true, trx });

      containerActionMap.set(container.tempId, result.action.id);
    }

    console.log(`  ✓ Created ${containers.length} container actions (Process → Stage)`);

    // --- 7. Items (tasks + subtasks) ---

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isSubtask = item.metadata?.isSubtask === true;
      const { fieldBindings, fieldValues } = extractFields(item);

      let parentActionId: string | undefined;

      if (isSubtask) {
        const parentTaskTempId = item.metadata?.parentTaskTempId as string | undefined;
        parentActionId = parentTaskTempId
          ? itemActionMap.get(parentTaskTempId) ?? undefined
          : undefined;
        if (!parentActionId) {
          parentActionId = item.parentTempId
            ? containerActionMap.get(item.parentTempId) ?? undefined
            : undefined;
        }
      } else {
        parentActionId = item.parentTempId
          ? containerActionMap.get(item.parentTempId) ?? undefined
          : undefined;
      }

      const actionType = isSubtask ? 'Subtask' : 'Task';

      // Build extra events (work lifecycle + milestone)
      const emitExtraEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
      const status = (item.metadata?.status as string) ?? null;
      const workEvent = statusToWorkEvent(status);
      if (workEvent) {
        emitExtraEvents.push({ type: workEvent, payload: {} });
        workEventCount++;
      }

      // For MILESTONE items, add milestone field + value
      if (status?.trim().toUpperCase() === 'MILESTONE') {
        const notes = item.metadata?.notes as string | undefined;
        if (notes) {
          fieldBindings.push({ fieldKey: 'milestone' });
          fieldValues.push({ fieldName: 'milestone', value: notes });
        }
      }

      const result = await composerService.compose({
        action: {
          contextId: project.id,
          contextType: 'project',
          parentActionId,
          type: actionType,
          fieldBindings,
        },
        fieldValues,
        emitExtraEvents: emitExtraEvents.length > 0 ? emitExtraEvents : undefined,
      }, { actorId: userId, skipView: true, trx });

      itemActionMap.set(item.tempId, result.action.id);

      if (isSubtask) {
        subtaskCount++;
      } else {
        taskCount++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`    ... ${i + 1}/${items.length} items`);
      }
    }
  });

  console.log(`  ✓ Created ${taskCount} task actions, ${subtaskCount} subtask actions`);
  console.log(`  ✓ Emitted events via Composer (${workEventCount} work lifecycle)`);

  // =========================================================================
  // 7b. Project workflow surface (after transaction commits)
  // =========================================================================

  await projectWorkflowSurface(project.id, 'project');
  console.log('  ✓ Projected workflow surface');

  // =========================================================================
  // 8. Create sample records
  // =========================================================================

  const contactDef = await db
    .selectFrom('record_definitions')
    .select('id')
    .where('name', '=', 'Contact')
    .executeTakeFirst();

  const locationDef = await db
    .selectFrom('record_definitions')
    .select('id')
    .where('name', '=', 'Location')
    .executeTakeFirst();

  const documentDef = await db
    .selectFrom('record_definitions')
    .select('id')
    .where('name', '=', 'Document')
    .executeTakeFirst();

  if (!contactDef || !locationDef || !documentDef) {
    throw new Error('Record definitions not found. Run reference seed first.');
  }

  await db
    .insertInto('records')
    .values([
      {
        definition_id: contactDef.id,
        classification_node_id: project.id,
        unique_name: 'Crystal Przybille',
        data: JSON.stringify({
          name: 'Crystal Przybille',
          role: 'Artist',
          contactGroup: 'Artist/Arts Worker',
          notes: 'Selected artist for Broadview Village public art commission.',
        }),
        created_by: userId,
      },
      {
        definition_id: contactDef.id,
        classification_node_id: project.id,
        unique_name: 'Bradley @ Avisina',
        data: JSON.stringify({
          name: 'Bradley',
          company: 'Avisina Development',
          role: 'Developer Contact',
          contactGroup: 'Developer/Client',
        }),
        created_by: userId,
      },
      {
        definition_id: locationDef.id,
        classification_node_id: project.id,
        unique_name: 'Broadview Village',
        data: JSON.stringify({
          name: 'Broadview Village',
          address: 'Broadview Village',
          city: 'Burnaby, BC',
          access_notes: 'Development site. Contact Avisina for site access.',
        }),
        created_by: userId,
      },
      {
        definition_id: documentDef.id,
        classification_node_id: project.id,
        unique_name: 'Fee Proposal',
        data: JSON.stringify({
          title: 'Fee Proposal',
          type: 'Contract',
          notes: 'BFA consulting fee proposal for Avisina Broadview Village.',
        }),
        created_by: userId,
      },
      {
        definition_id: documentDef.id,
        classification_node_id: project.id,
        unique_name: 'Artist Contract',
        data: JSON.stringify({
          title: 'Artist Contract - Crystal Przybille',
          type: 'Contract',
          notes: 'Commission agreement with selected artist.',
        }),
        created_by: userId,
      },
    ])
    .execute();

  console.log('  ✓ Created sample records (2 contacts, 1 location, 2 documents)');

  // =========================================================================
  // 9. Summary
  // =========================================================================

  console.log('');
  console.log(`  Summary:`);
  console.log(`    Project: Avisina - Broadview Village`);
  console.log(`    Containers: ${containers.length} (process + stages)`);
  console.log(`    Tasks: ${taskCount}, Subtasks: ${subtaskCount}`);
  console.log(`    Work events: ${workEventCount}`);
  console.log(`    Validation issues: ${validationIssues.length}`);
  console.log(`    Import session: stored with raw CSV data`);

  // =========================================================================
  // 10. Guardrail: verify no legacy nodes
  // =========================================================================

  const legacyNodeTypes = ['process', 'stage', 'subprocess'] as const;
  const legacyNodes = await db
    .selectFrom('hierarchy_nodes')
    .select(['type'])
    .where('type', 'in', [...legacyNodeTypes])
    .execute();

  if (legacyNodes.length > 0) {
    const typeCounts = legacyNodes.reduce(
      (acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    throw new Error(
      `SEED GUARDRAIL FAILED: Legacy hierarchy_nodes detected!\n` +
        `Found: ${JSON.stringify(typeCounts)}\n` +
        `These types should be created as Actions, not hierarchy_nodes.\n` +
        `See dev_sample_data.ts header comment for architecture guidance.`,
    );
  }

  console.log('  ✓ Guardrail passed: No legacy node types detected');
}
