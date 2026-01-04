/**
 * Development Sample Data
 *
 * This creates DISPOSABLE test data for development.
 * This is NOT reference data - it can be deleted and recreated freely.
 *
 * Run with: npm run seed:dev
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

  // Create process
  const [process] = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: project.id,
      root_project_id: project.id,
      type: 'process',
      title: 'Standard Commission',
      metadata: JSON.stringify({ methodology: 'Public Call', timeline: '12 Weeks' }),
      created_by: user.id,
      position: 0,
    })
    .returning('id')
    .execute();

  // Create stages
  const [feasibilityStage] = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: process.id,
      root_project_id: project.id,
      type: 'stage',
      title: '1. Feasibility',
      metadata: JSON.stringify({ color: 'yellow' }),
      created_by: user.id,
      position: 0,
    })
    .returning('id')
    .execute();

  await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: process.id,
      root_project_id: project.id,
      type: 'stage',
      title: '2. Design',
      metadata: JSON.stringify({ color: 'blue' }),
      created_by: user.id,
      position: 1,
    })
    .execute();

  await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: process.id,
      root_project_id: project.id,
      type: 'stage',
      title: '3. Fabrication',
      metadata: JSON.stringify({ color: 'orange' }),
      created_by: user.id,
      position: 2,
    })
    .execute();

  await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: process.id,
      root_project_id: project.id,
      type: 'stage',
      title: '4. Installation',
      metadata: JSON.stringify({ color: 'green' }),
      created_by: user.id,
      position: 3,
    })
    .execute();

  // Create subprocess
  const [siteSurvey] = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: feasibilityStage.id,
      root_project_id: project.id,
      type: 'subprocess',
      title: 'Site Survey & Analysis',
      metadata: JSON.stringify({ lead: 'Sarah Jenkins', dueDate: '2025-02-15' }),
      created_by: user.id,
      position: 0,
    })
    .returning('id')
    .execute();

  await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: feasibilityStage.id,
      root_project_id: project.id,
      type: 'subprocess',
      title: 'Initial Budgeting',
      metadata: JSON.stringify({}),
      created_by: user.id,
      position: 1,
    })
    .execute();

  // Create tasks
  const [confirmBoundaryTask] = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: siteSurvey.id,
      root_project_id: project.id,
      type: 'task',
      title: 'Confirm Location Boundary',
      description: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Verify the GPS coordinates match the city filing.' }],
          },
        ],
      }),
      metadata: JSON.stringify({
        tags: ['Engineering'],
        status: 'in-progress',
        owner: 'SJ',
        dueDate: '2025-02-05',
        percentComplete: 35,
        completed: false,
      }),
      created_by: user.id,
      position: 0,
    })
    .returning('id')
    .execute();

  const [submitReportTask] = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: siteSurvey.id,
      root_project_id: project.id,
      type: 'task',
      title: 'Submit Survey Report',
      description: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Upload the final PDF before the deadline.' }],
          },
        ],
      }),
      metadata: JSON.stringify({
        status: 'blocked',
        owner: 'MR',
        dueDate: '2025-02-10',
        percentComplete: 10,
        completed: false,
      }),
      created_by: user.id,
      position: 1,
    })
    .returning('id')
    .execute();

  await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: siteSurvey.id,
      root_project_id: project.id,
      type: 'task',
      title: 'Document Site Conditions',
      description: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Take photos of current wall condition and surroundings.' }],
          },
        ],
      }),
      metadata: JSON.stringify({
        tags: ['Documentation'],
        status: 'done',
        owner: 'SJ',
        dueDate: '2025-02-03',
        percentComplete: 100,
        completed: true,
      }),
      created_by: user.id,
      position: 2,
    })
    .execute();

  console.log('  ✓ Created sample project hierarchy');

  // Create subtasks under the "Confirm Location Boundary" task
  await db
    .insertInto('hierarchy_nodes')
    .values([
      {
        parent_id: confirmBoundaryTask.id,
        root_project_id: project.id,
        type: 'subtask',
        title: 'Pull property records from city archives',
        metadata: JSON.stringify({
          status: 'done',
          owner: 'SJ',
          completed: true,
        }),
        created_by: user.id,
        position: 0,
      },
      {
        parent_id: confirmBoundaryTask.id,
        root_project_id: project.id,
        type: 'subtask',
        title: 'Cross-reference GPS with survey maps',
        metadata: JSON.stringify({
          status: 'in-progress',
          owner: 'SJ',
          completed: false,
        }),
        created_by: user.id,
        position: 1,
      },
      {
        parent_id: confirmBoundaryTask.id,
        root_project_id: project.id,
        type: 'subtask',
        title: 'Get sign-off from property owner',
        metadata: JSON.stringify({
          status: 'not-started',
          completed: false,
        }),
        created_by: user.id,
        position: 2,
      },
    ])
    .execute();

  // Create subtasks under the "Submit Survey Report" task
  await db
    .insertInto('hierarchy_nodes')
    .values([
      {
        parent_id: submitReportTask.id,
        root_project_id: project.id,
        type: 'subtask',
        title: 'Compile field notes into draft',
        metadata: JSON.stringify({
          status: 'done',
          owner: 'MR',
          completed: true,
        }),
        created_by: user.id,
        position: 0,
      },
      {
        parent_id: submitReportTask.id,
        root_project_id: project.id,
        type: 'subtask',
        title: 'Review with engineering lead',
        metadata: JSON.stringify({
          status: 'blocked',
          owner: 'MR',
          completed: false,
        }),
        created_by: user.id,
        position: 1,
      },
    ])
    .execute();

  console.log('  ✓ Created sample subtasks');

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
}

