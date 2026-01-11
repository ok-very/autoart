/**
 * Development Sample Data
 *
 * This creates DISPOSABLE test data for development.
 * This is NOT reference data - it can be deleted and recreated freely.
 *
 * Run with: npm run seed:dev
 *
 * ARCHITECTURE NOTE:
 * This seed follows the event-sourced Action architecture:
 * - Only 'project' type is created as a hierarchy_node (root anchor)
 * - All other entities (Process, Stage, Subprocess, Task, Subtask)
 *   are created as Actions with ACTION_DECLARED events
 * - parent_action_id maintains the hierarchy within the Action tree
 *
 * DO NOT create hierarchy_nodes with type: 'process', 'stage', 'subprocess',
 * 'task', or 'subtask'. These types are DEPRECATED and should use Actions.
 */

import { Kysely } from 'kysely';
import bcrypt from 'bcryptjs';
import type { Database } from '../schema.js';

export async function seedDevData(db: Kysely<Database>): Promise<void> {
  console.log('  Seeding development sample data...');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123', 10);
  const [user] = await db
    .insertInto('users')
    .values({
      email: 'demo@autoart.local',
      password_hash: passwordHash,
      name: 'Demo User',
    })
    .returning('id')
    .execute();

  console.log('  ✓ Created demo user (demo@autoart.local / demo123)');

  // Get record definitions
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

  if (!contactDef || !locationDef) {
    throw new Error('Record definitions not found. Run reference seed first.');
  }

  // Create sample project
  const [project] = await db
    .insertInto('hierarchy_nodes')
    .values({
      type: 'project',
      title: 'Downtown Mural 2025',
      description: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Public art installation for downtown revitalization.' }],
          },
        ],
      }),
      metadata: JSON.stringify({ client: 'City Council', budget: 50000 }),
      created_by: user.id,
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

  // Create sample records
  await db
    .insertInto('records')
    .values([
      {
        definition_id: contactDef.id,
        classification_node_id: project.id,
        unique_name: 'Sarah Jenkins',
        data: JSON.stringify({
          name: 'Sarah Jenkins',
          email: 'sarah@artconsulting.com',
          phone: '555-0123',
          role: 'Consultant',
        }),
        created_by: user.id,
      },
      {
        definition_id: contactDef.id,
        classification_node_id: project.id,
        unique_name: 'City Planning Dept',
        data: JSON.stringify({
          name: 'City Planning Department',
          email: 'planning@city.gov',
          phone: '555-0100',
          role: 'Client',
        }),
        created_by: user.id,
      },
      {
        definition_id: locationDef.id,
        classification_node_id: project.id,
        unique_name: 'Downtown Site',
        data: JSON.stringify({
          name: '5th & Main Wall',
          address: '123 Main Street',
          city: 'Downtown',
          gps: '40.7128,-74.0060',
          access_notes: 'Alley access from 5th Street. Key required for gate.',
        }),
        created_by: user.id,
      },
    ])
    .execute();

  console.log('  ✓ Created sample records');

  // =========================================================================
  // CONTAINER ACTIONS (New Architecture)
  // Create Process → Stage → Subprocess as action-based containers
  // These populate the ComposerSurface subprocess dropdown
  // =========================================================================

  // Create Process action (context = project)
  const [processAction] = await db
    .insertInto('actions')
    .values({
      context_id: project.id,
      context_type: 'project',
      parent_action_id: null,
      type: 'Process',
      field_bindings: JSON.stringify([
        { fieldKey: 'title', value: 'Standard Commission' },
        { fieldKey: 'methodology', value: 'Public Call' },
      ]),
    })
    .returning('id')
    .execute();

  // Emit ACTION_DECLARED event for process
  await db
    .insertInto('events')
    .values({
      context_id: project.id,
      context_type: 'project',
      action_id: processAction.id,
      type: 'ACTION_DECLARED',
      payload: JSON.stringify({
        actionType: 'Process',
        fieldBindings: [
          { fieldKey: 'title', value: 'Standard Commission' },
          { fieldKey: 'methodology', value: 'Public Call' },
        ],
      }),
      actor_id: user.id,
    })
    .execute();

  // Create Stage actions (child of Process)
  const stageNames = [
    { title: '1. Feasibility', color: 'yellow' },
    { title: '2. Design', color: 'blue' },
    { title: '3. Fabrication', color: 'orange' },
    { title: '4. Installation', color: 'green' },
  ];

  const stageActions: Array<{ id: string; title: string }> = [];

  for (const stage of stageNames) {
    const [stageAction] = await db
      .insertInto('actions')
      .values({
        context_id: project.id,
        context_type: 'project',
        parent_action_id: processAction.id,
        type: 'Stage',
        field_bindings: JSON.stringify([
          { fieldKey: 'title', value: stage.title },
          { fieldKey: 'color', value: stage.color },
        ]),
      })
      .returning('id')
      .execute();

    stageActions.push({ id: stageAction.id, title: stage.title });

    await db
      .insertInto('events')
      .values({
        context_id: project.id,
        context_type: 'project',
        action_id: stageAction.id,
        type: 'ACTION_DECLARED',
        payload: JSON.stringify({
          actionType: 'Stage',
          fieldBindings: [
            { fieldKey: 'title', value: stage.title },
            { fieldKey: 'color', value: stage.color },
          ],
        }),
        actor_id: user.id,
      })
      .execute();
  }

  // Create Subprocess actions (children of first Stage - Feasibility)
  const feasibilityStageAction = stageActions[0];
  const subprocessNames = [
    { title: 'Site Survey & Analysis', lead: 'Sarah Jenkins' },
    { title: 'Initial Budgeting', lead: 'Mark Robinson' },
  ];

  const subprocessActions: Array<{ id: string; title: string }> = [];

  for (const sub of subprocessNames) {
    const [subprocessAction] = await db
      .insertInto('actions')
      .values({
        context_id: project.id,
        context_type: 'project',
        parent_action_id: feasibilityStageAction.id,
        type: 'Subprocess',
        field_bindings: JSON.stringify([
          { fieldKey: 'title', value: sub.title },
          { fieldKey: 'lead', value: sub.lead },
        ]),
      })
      .returning('id')
      .execute();

    subprocessActions.push({ id: subprocessAction.id, title: sub.title });

    await db
      .insertInto('events')
      .values({
        context_id: project.id,
        context_type: 'project',
        action_id: subprocessAction.id,
        type: 'ACTION_DECLARED',
        payload: JSON.stringify({
          actionType: 'Subprocess',
          fieldBindings: [
            { fieldKey: 'title', value: sub.title },
            { fieldKey: 'lead', value: sub.lead },
          ],
        }),
        actor_id: user.id,
      })
      .execute();
  }

  console.log('  ✓ Created container actions (Process → Stage → Subprocess)');

  // =========================================================================
  // TASK ACTIONS (New Architecture)
  // Tasks are Actions with parent_action_id pointing to a Subprocess
  // =========================================================================

  const siteSurveySubprocess = subprocessActions[0]; // Site Survey & Analysis
  const taskDefinitions = [
    {
      title: 'Confirm Location Boundary',
      description: 'Verify the GPS coordinates match the city filing.',
      status: 'in-progress',
      owner: 'SJ',
      dueDate: '2025-02-05',
      percentComplete: 35,
      tags: ['Engineering'],
    },
    {
      title: 'Submit Survey Report',
      description: 'Upload the final PDF before the deadline.',
      status: 'blocked',
      owner: 'MR',
      dueDate: '2025-02-10',
      percentComplete: 10,
      tags: [],
    },
    {
      title: 'Document Site Conditions',
      description: 'Take photos of current wall condition and surroundings.',
      status: 'done',
      owner: 'SJ',
      dueDate: '2025-02-03',
      percentComplete: 100,
      tags: ['Documentation'],
    },
  ];

  const taskActions: Array<{ id: string; title: string }> = [];

  for (const task of taskDefinitions) {
    const fieldBindings = [
      { fieldKey: 'title', value: task.title },
      { fieldKey: 'description', value: task.description },
      { fieldKey: 'status', value: task.status },
      { fieldKey: 'owner', value: task.owner },
      { fieldKey: 'dueDate', value: task.dueDate },
      { fieldKey: 'percentComplete', value: task.percentComplete },
      ...(task.tags.length > 0 ? [{ fieldKey: 'tags', value: task.tags }] : []),
    ];

    const [taskAction] = await db
      .insertInto('actions')
      .values({
        context_id: project.id,
        context_type: 'project',
        parent_action_id: siteSurveySubprocess.id,
        type: 'Task',
        field_bindings: JSON.stringify(fieldBindings),
      })
      .returning('id')
      .execute();

    taskActions.push({ id: taskAction.id, title: task.title });

    await db
      .insertInto('events')
      .values({
        context_id: project.id,
        context_type: 'project',
        action_id: taskAction.id,
        type: 'ACTION_DECLARED',
        payload: JSON.stringify({
          actionType: 'Task',
          fieldBindings,
        }),
        actor_id: user.id,
      })
      .execute();
  }

  console.log('  ✓ Created task actions');

  // =========================================================================
  // SUBTASK ACTIONS (New Architecture)
  // Subtasks are Actions with parent_action_id pointing to a Task
  // =========================================================================

  // Subtasks for "Confirm Location Boundary" task
  const confirmBoundaryTask = taskActions[0];
  const confirmBoundarySubtasks = [
    { title: 'Pull property records from city archives', status: 'done', owner: 'SJ' },
    { title: 'Cross-reference GPS with survey maps', status: 'in-progress', owner: 'SJ' },
    { title: 'Get sign-off from property owner', status: 'not-started', owner: null },
  ];

  for (const subtask of confirmBoundarySubtasks) {
    const fieldBindings = [
      { fieldKey: 'title', value: subtask.title },
      { fieldKey: 'status', value: subtask.status },
      ...(subtask.owner ? [{ fieldKey: 'owner', value: subtask.owner }] : []),
    ];

    const [subtaskAction] = await db
      .insertInto('actions')
      .values({
        context_id: project.id,
        context_type: 'project',
        parent_action_id: confirmBoundaryTask.id,
        type: 'Subtask',
        field_bindings: JSON.stringify(fieldBindings),
      })
      .returning('id')
      .execute();

    await db
      .insertInto('events')
      .values({
        context_id: project.id,
        context_type: 'project',
        action_id: subtaskAction.id,
        type: 'ACTION_DECLARED',
        payload: JSON.stringify({
          actionType: 'Subtask',
          fieldBindings,
        }),
        actor_id: user.id,
      })
      .execute();
  }

  // Subtasks for "Submit Survey Report" task
  const submitReportTask = taskActions[1];
  const submitReportSubtasks = [
    { title: 'Compile field notes into draft', status: 'done', owner: 'MR' },
    { title: 'Review with engineering lead', status: 'blocked', owner: 'MR' },
  ];

  for (const subtask of submitReportSubtasks) {
    const fieldBindings = [
      { fieldKey: 'title', value: subtask.title },
      { fieldKey: 'status', value: subtask.status },
      { fieldKey: 'owner', value: subtask.owner },
    ];

    const [subtaskAction] = await db
      .insertInto('actions')
      .values({
        context_id: project.id,
        context_type: 'project',
        parent_action_id: submitReportTask.id,
        type: 'Subtask',
        field_bindings: JSON.stringify(fieldBindings),
      })
      .returning('id')
      .execute();

    await db
      .insertInto('events')
      .values({
        context_id: project.id,
        context_type: 'project',
        action_id: subtaskAction.id,
        type: 'ACTION_DECLARED',
        payload: JSON.stringify({
          actionType: 'Subtask',
          fieldBindings,
        }),
        actor_id: user.id,
      })
      .execute();
  }

  console.log('  ✓ Created subtask actions');
  console.log('  ✓ Complete Action hierarchy: Process → Stage → Subprocess → Task → Subtask');

  // =========================================================================
  // GUARDRAIL: Verify no legacy nodes were created
  // This prevents regression to the old architecture
  // =========================================================================

  const legacyNodeTypes = ['process', 'stage', 'subprocess', 'task', 'subtask'] as const;
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
      {} as Record<string, number>
    );
    throw new Error(
      `SEED GUARDRAIL FAILED: Legacy hierarchy_nodes detected!\n` +
        `Found: ${JSON.stringify(typeCounts)}\n` +
        `These types should be created as Actions, not hierarchy_nodes.\n` +
        `See dev_sample_data.ts header comment for architecture guidance.`
    );
  }

  console.log('  ✓ Guardrail passed: No legacy node types detected');
}

