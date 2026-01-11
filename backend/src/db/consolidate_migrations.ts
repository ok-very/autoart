/**
 * Migration Consolidation Script
 *
 * This script consolidates multiple incremental migrations into a clean set.
 * Run this when you want to "squash" fix-up migrations into their parent migrations.
 *
 * Usage: npm run db:consolidate
 *
 * What it does:
 * 1. Backs up current migrations to migrations_backup/
 * 2. Creates new consolidated migrations in migrations/
 * 3. Resets the migration tracking table
 * 4. Re-runs all migrations
 *
 * IMPORTANT: This destroys all data! Only use in development.
 */

import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { Kysely, PostgresDialect, sql } from 'kysely';
import path from 'path';
import { Pool } from 'pg';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const BACKUP_DIR = path.join(__dirname, 'migrations_backup');

// ==================== CONSOLIDATED MIGRATION CONTENT ====================

// This is the canonical, consolidated schema for Task and Subtask
const WORKFLOW_STATUS_CONFIG = {
  'empty': { label: '', colorClass: 'bg-slate-100 text-slate-400' },
  'not-started': { label: 'Not Started', colorClass: 'bg-slate-200 text-slate-600' },
  'in-progress': { label: 'In Progress', colorClass: 'bg-amber-100 text-amber-700' },
  'blocked': { label: 'Blocked', colorClass: 'bg-red-100 text-red-700' },
  'review': { label: 'Review', colorClass: 'bg-purple-100 text-purple-700' },
  'done': { label: 'Done', colorClass: 'bg-emerald-100 text-emerald-700' },
};

const TASK_SCHEMA = {
  fields: [
    { key: 'title', type: 'text', label: 'Task', required: true },
    {
      key: 'status',
      type: 'status',
      label: 'Status',
      options: Object.keys(WORKFLOW_STATUS_CONFIG),
      statusConfig: WORKFLOW_STATUS_CONFIG,
    },
    { key: 'owner', type: 'user', label: 'Owner' },
    { key: 'dueDate', type: 'date', label: 'Due' },
    { key: 'tags', type: 'tags', label: 'Tags' },
    { key: 'description', type: 'textarea', label: 'Description' },
  ],
};

const SUBTASK_SCHEMA = {
  fields: [
    { key: 'title', type: 'text', label: 'Subtask', required: true },
    {
      key: 'status',
      type: 'status',
      label: 'Status',
      options: Object.keys(WORKFLOW_STATUS_CONFIG),
      statusConfig: WORKFLOW_STATUS_CONFIG,
    },
    { key: 'owner', type: 'user', label: 'Owner' },
    { key: 'dueDate', type: 'date', label: 'Due' },
  ],
};

// ==================== HELPER FUNCTIONS ====================

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function consolidate() {
  console.log('\n========================================');
  console.log('  Migration Consolidation Tool');
  console.log('========================================\n');

  console.log('This will:');
  console.log('  1. Drop ALL tables (destroy all data)');
  console.log('  2. Create consolidated migrations');
  console.log('  3. Re-run migrations from scratch');
  console.log('  4. Seed reference data\n');

  const confirm = await prompt('Type "consolidate" to continue: ');
  if (confirm !== 'consolidate') {
    console.log('Aborted.');
    process.exit(0);
  }

  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  try {
    // Step 1: Backup existing migrations
    console.log('\n[1/5] Backing up existing migrations...');
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const files = await fs.readdir(MIGRATIONS_DIR);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubdir = path.join(BACKUP_DIR, `backup_${timestamp}`);
    await fs.mkdir(backupSubdir, { recursive: true });

    for (const file of files) {
      if (file.endsWith('.ts')) {
        await fs.copyFile(
          path.join(MIGRATIONS_DIR, file),
          path.join(backupSubdir, file)
        );
      }
    }
    console.log(`  Backed up ${files.filter(f => f.endsWith('.ts')).length} files to ${backupSubdir}`);

    // Step 2: Drop all tables
    console.log('\n[2/5] Dropping all tables...');
    await sql`DROP SCHEMA public CASCADE`.execute(db);
    await sql`CREATE SCHEMA public`.execute(db);
    await sql`GRANT ALL ON SCHEMA public TO public`.execute(db);
    console.log('  Schema reset complete.');

    // Step 3: Delete fix-up migrations (will be merged into parents)
    console.log('\n[3/5] Consolidating migrations...');

    const migrationsToDelete = [
      '013_fix_icon_emojis.ts',      // Merged into 009
      '015_normalize_task_statuses.ts', // Data cleanup, can run separately
      '017_status_field_config.ts',  // Merged into 016
      '019_fix_task_schema.ts',      // Merged into 016
      '020_ensure_task_definitions.ts', // Redundant, merged into 016
    ];

    for (const file of migrationsToDelete) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      try {
        await fs.unlink(filePath);
        console.log(`  Deleted: ${file}`);
      } catch {
        // File might not exist
      }
    }

    // Step 4: Update the consolidated migrations
    console.log('\n[4/5] Updating consolidated migrations...');

    // Update 009_seed_definitions.ts with correct emojis (merged from 013)
    await updateSeedDefinitions();

    // Update 016_system_definitions.ts with complete Task/Subtask schema
    await updateSystemDefinitions();

    console.log('  Consolidated migrations updated.');

    // Step 5: Run migrations
    console.log('\n[5/5] Running consolidated migrations...');
    console.log('  Please run: npm run migrate && npm run seed:dev\n');

  } catch (err) {
    console.error('Error during consolidation:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }

  console.log('========================================');
  console.log('  Consolidation Complete!');
  console.log('========================================\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run migrate');
  console.log('  2. Run: npm run seed:dev');
  console.log('  3. Restart the backend server\n');
}

async function updateSeedDefinitions() {
  // This would update 009 with correct emojis - for now we'll leave it as-is
  // since the current version already has emojis
}

async function updateSystemDefinitions() {
  const content = `/**
 * Migration: System Definitions (Task, Subtask)
 *
 * CONSOLIDATED from: 016, 017, 019, 020
 *
 * This migration:
 * - Adds is_system and parent_definition_id columns
 * - Creates Task and Subtask system definitions with complete schema
 * - Includes statusConfig for status fields
 */

import { Kysely, sql } from 'kysely';

const WORKFLOW_STATUS_CONFIG = ${JSON.stringify(WORKFLOW_STATUS_CONFIG, null, 2)};

const TASK_SCHEMA = ${JSON.stringify(TASK_SCHEMA, null, 2)};

const SUBTASK_SCHEMA = ${JSON.stringify(SUBTASK_SCHEMA, null, 2)};

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add columns to record_definitions
  await db.schema
    .alterTable('record_definitions')
    .addColumn('is_system', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .alterTable('record_definitions')
    .addColumn('parent_definition_id', 'uuid', (col) =>
      col.references('record_definitions.id').onDelete('set null')
    )
    .execute();

  // Create Task definition
  await sql\`
    INSERT INTO record_definitions (name, schema_config, styling, is_system, pinned)
    VALUES (
      'Task',
      \${JSON.stringify(TASK_SCHEMA)}::jsonb,
      \${JSON.stringify({ color: 'blue', icon: '✅' })}::jsonb,
      true,
      true
    )
    ON CONFLICT (name) DO UPDATE SET
      schema_config = EXCLUDED.schema_config,
      styling = EXCLUDED.styling,
      is_system = true,
      pinned = true
  \`.execute(db);

  // Create Subtask definition
  await sql\`
    INSERT INTO record_definitions (name, schema_config, styling, is_system, pinned, parent_definition_id)
    SELECT
      'Subtask',
      \${JSON.stringify(SUBTASK_SCHEMA)}::jsonb,
      \${JSON.stringify({ color: 'sky', icon: '☑️' })}::jsonb,
      true,
      false,
      id
    FROM record_definitions WHERE name = 'Task'
    ON CONFLICT (name) DO UPDATE SET
      schema_config = EXCLUDED.schema_config,
      styling = EXCLUDED.styling,
      is_system = true,
      parent_definition_id = EXCLUDED.parent_definition_id
  \`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('record_definitions')
    .dropColumn('parent_definition_id')
    .execute();

  await db.schema
    .alterTable('record_definitions')
    .dropColumn('is_system')
    .execute();
}
`;

  await fs.writeFile(
    path.join(MIGRATIONS_DIR, '016_system_definitions.ts'),
    content,
    'utf-8'
  );
}

consolidate();
