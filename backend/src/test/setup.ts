/**
 * Test setup and utilities for backend testing
 *
 * Uses the actual database for integration tests to ensure
 * real PostgreSQL behavior including recursive CTEs and transactions.
 */

import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { Database } from '../db/schema.js';

// Create a separate test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

let testDb: Kysely<Database> | null = null;
let testPool: Pool | null = null;

export function getTestDb(): Kysely<Database> {
  if (!testDb) {
    testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 5,
    });
    testDb = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: testPool }),
    });
  }
  return testDb;
}

export async function closeTestDb(): Promise<void> {
  if (testDb) {
    await testDb.destroy();
    testDb = null;
  }
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Clean up test data created during tests
 * Deletes in dependency order to avoid FK violations
 * Uses try-catch to handle cases where tables don't exist
 */
export async function cleanupTestData(db: Kysely<Database>, testPrefix: string): Promise<void> {
  // Delete in reverse dependency order
  // Wrap each in try-catch in case tables don't exist

  // First delete events (references actions via action_id)
  try {
    await db.deleteFrom('events')
      .where('context_id', 'in',
        db.selectFrom('hierarchy_nodes')
          .select('id')
          .where('title', 'like', `${testPrefix}%`)
      )
      .execute();
  } catch {
    // Table may not exist
  }

  // Then delete action_references (references actions via action_id)
  try {
    await db.deleteFrom('action_references')
      .where('action_id', 'in',
        db.selectFrom('actions')
          .select('id')
          .where('context_id', 'in',
            db.selectFrom('hierarchy_nodes')
              .select('id')
              .where('title', 'like', `${testPrefix}%`)
          )
      )
      .execute();
  } catch {
    // Table may not exist
  }

  // Then delete actions (references hierarchy_nodes via context_id)
  try {
    await db.deleteFrom('actions')
      .where('context_id', 'in',
        db.selectFrom('hierarchy_nodes')
          .select('id')
          .where('title', 'like', `${testPrefix}%`)
      )
      .execute();
  } catch {
    // Table may not exist
  }

  try {
    await db.deleteFrom('task_references')
      .where('task_id', 'in',
        db.selectFrom('hierarchy_nodes')
          .select('id')
          .where('title', 'like', `${testPrefix}%`)
      )
      .execute();
  } catch {
    // Table may not exist
  }

  try {
    await db.deleteFrom('record_links')
      .where('source_record_id', 'in',
        db.selectFrom('records')
          .select('id')
          .where('unique_name', 'like', `${testPrefix}%`)
      )
      .execute();
  } catch {
    // Table may not exist
  }

  try {
    await db.deleteFrom('records')
      .where('unique_name', 'like', `${testPrefix}%`)
      .execute();
  } catch {
    // Table may not exist
  }

  try {
    await db.deleteFrom('hierarchy_nodes')
      .where('title', 'like', `${testPrefix}%`)
      .execute();
  } catch {
    // Table may not exist
  }

  try {
    await db.deleteFrom('record_definitions')
      .where('name', 'like', `${testPrefix}%`)
      .execute();
  } catch {
    // Table may not exist
  }
}

/**
 * Generate a unique test prefix for isolation
 */
export function generateTestPrefix(): string {
  return `__test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Create test fixtures for hierarchy tests
 */
export async function createTestProject(
  db: Kysely<Database>,
  prefix: string,
  options?: { withChildren?: boolean }
): Promise<{
  projectId: string;
  processId?: string;
  stageId?: string;
  subprocessId?: string;
  taskId?: string;
}> {
  // Create project
  const project = await db
    .insertInto('hierarchy_nodes')
    .values({
      type: 'project',
      title: `${prefix}_project`,
      metadata: '{}',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  // Set root_project_id to itself
  await db
    .updateTable('hierarchy_nodes')
    .set({ root_project_id: project.id })
    .where('id', '=', project.id)
    .execute();

  if (!options?.withChildren) {
    return { projectId: project.id };
  }

  // Create full hierarchy
  const process = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: project.id,
      root_project_id: project.id,
      type: 'process',
      title: `${prefix}_process`,
      metadata: '{}',
      position: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const stage = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: process.id,
      root_project_id: project.id,
      type: 'stage',
      title: `${prefix}_stage`,
      metadata: '{}',
      position: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const subprocess = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: stage.id,
      root_project_id: project.id,
      type: 'subprocess',
      title: `${prefix}_subprocess`,
      metadata: '{}',
      position: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const task = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: subprocess.id,
      root_project_id: project.id,
      type: 'task',
      title: `${prefix}_task`,
      metadata: '{}',
      position: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return {
    projectId: project.id,
    processId: process.id,
    stageId: stage.id,
    subprocessId: subprocess.id,
    taskId: task.id,
  };
}

/**
 * Create a test record definition and record
 */
export async function createTestRecord(
  db: Kysely<Database>,
  prefix: string,
  data: Record<string, unknown> = { field1: 'value1', field2: 42 }
): Promise<{ definitionId: string; recordId: string }> {
  // Create or get a test definition
  let definition = await db
    .selectFrom('record_definitions')
    .select('id')
    .where('name', '=', `${prefix}_definition`)
    .executeTakeFirst();

  if (!definition) {
    definition = await db
      .insertInto('record_definitions')
      .values({
        name: `${prefix}_definition`,
        schema_config: JSON.stringify({
          fields: [
            { key: 'field1', label: 'Field 1', type: 'text' },
            { key: 'field2', label: 'Field 2', type: 'number' },
          ],
        }),
        styling: JSON.stringify({ color: 'blue' }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
  }

  // Create record
  const record = await db
    .insertInto('records')
    .values({
      definition_id: definition.id,
      unique_name: `${prefix}_record_${Date.now()}`,
      data: JSON.stringify(data),
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return {
    definitionId: definition.id,
    recordId: record.id,
  };
}
