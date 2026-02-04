/**
 * Migration 009: Seed Default Record Definitions
 *
 * Creates default record definitions for the 5 hierarchy node types.
 * This ensures the Schema Editor works out of the box without requiring
 * users to manually create definitions for basic node types.
 *
 * Each node type gets a definition with common metadata fields.
 * Users can extend these by adding custom fields via the Schema Editor.
 */

import { Kysely, sql } from 'kysely';

interface NodeTypeDefinition {
  name: string;
  schema_config: object;
  styling: object;
}

const NODE_TYPE_DEFINITIONS: NodeTypeDefinition[] = [
  {
    name: 'Project',
    schema_config: {
      fields: [
        { key: 'status', type: 'select', label: 'Status', options: ['Planning', 'Active', 'On Hold', 'Done', 'Archived'] },
        { key: 'owner', type: 'text', label: 'Project Lead' },
        { key: 'client', type: 'text', label: 'Client' },
        { key: 'start_date', type: 'date', label: 'Start Date' },
        { key: 'due_date', type: 'date', label: 'Due Date' },
      ],
    },
    styling: { color: 'blue', icon: '📁' },
  },
  {
    name: 'Process',
    schema_config: {
      fields: [
        { key: 'owner', type: 'text', label: 'Assignee' },
        { key: 'priority', type: 'select', label: 'Priority', options: ['Low', 'Medium', 'High', 'Critical'] },
      ],
    },
    styling: { color: 'purple', icon: '⚙️' },
  },
  {
    name: 'Stage',
    schema_config: {
      fields: [
        { key: 'status', type: 'select', label: 'Status', options: ['Not Started', 'In Progress', 'Done'] },
        { key: 'gate_criteria', type: 'textarea', label: 'Gate Criteria' },
      ],
    },
    styling: { color: 'slate', icon: '📋' },
  },
  {
    name: 'Subprocess',
    schema_config: {
      fields: [
        { key: 'lead', type: 'text', label: 'Lead' },
        { key: 'dueDate', type: 'date', label: 'Due Date' },
        { key: 'tags', type: 'text', label: 'Tags' },
      ],
    },
    styling: { color: 'orange', icon: '🌿' },
  },
  {
    name: 'Task',
    schema_config: {
      fields: [
        { key: 'assignee', type: 'text', label: 'Assignee' },
        { key: 'priority', type: 'select', label: 'Priority', options: ['Low', 'Medium', 'High'] },
        { key: 'due_date', type: 'date', label: 'Due Date' },
        { key: 'completed', type: 'checkbox', label: 'Done' },
        { key: 'tags', type: 'text', label: 'Tags' },
      ],
    },
    styling: { color: 'green', icon: '✅' },
  },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  // First, add a unique constraint on name if it doesn't exist
  // This enables idempotent inserts
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'record_definitions_name_unique'
      ) THEN
        ALTER TABLE record_definitions ADD CONSTRAINT record_definitions_name_unique UNIQUE (name);
      END IF;
    END $$
  `.execute(db);

  // Insert default definitions (idempotent)
  for (const def of NODE_TYPE_DEFINITIONS) {
    await sql`
      INSERT INTO record_definitions (name, schema_config, styling)
      VALUES (
        ${def.name},
        ${JSON.stringify(def.schema_config)}::jsonb,
        ${JSON.stringify(def.styling)}::jsonb
      )
      ON CONFLICT (name) DO NOTHING
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Remove only the seeded definitions (by name)
  for (const def of NODE_TYPE_DEFINITIONS) {
    await sql`
      DELETE FROM record_definitions WHERE name = ${def.name}
    `.execute(db);
  }

  // Note: We don't remove the unique constraint as other parts of the system may rely on it
}
