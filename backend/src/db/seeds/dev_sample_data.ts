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
  await db
    .insertInto('hierarchy_nodes')
    .values([
      {
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
      },
      {
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
      },
      {
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
      },
    ])
    .execute();

  console.log('  ✓ Created sample project hierarchy');

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
}
