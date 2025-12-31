/**
 * Migration 006: Records (Data Instances)
 *
 * Records are instances of record definitions - the actual data.
 * This is the "schemaless SQL" pattern using JSONB.
 *
 * Design decisions:
 * - data is JSONB containing all field values
 * - unique_name is the user-facing identifier (for #mentions)
 * - classification_node_id links records to hierarchy for scoping
 * - GIN index on data enables efficient JSONB queries
 *
 * Example data:
 * { "name": "John Doe", "email": "john@example.com", "role": "Client" }
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('records')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('definition_id', 'uuid', (col) =>
      col.notNull().references('record_definitions.id').onDelete('restrict')
    )
    .addColumn('classification_node_id', 'uuid', (col) =>
      col.references('hierarchy_nodes.id').onDelete('set null')
    )
    .addColumn('unique_name', 'text', (col) => col.notNull())
    .addColumn('data', 'jsonb', (col) => col.notNull())
    .addColumn('created_by', 'uuid', (col) =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for filtering by definition type
  await db.schema
    .createIndex('idx_records_definition')
    .on('records')
    .column('definition_id')
    .execute();

  // Index for scoped record queries
  await db.schema
    .createIndex('idx_records_classification')
    .on('records')
    .column('classification_node_id')
    .execute();

  // GIN index for JSONB queries (e.g., searching within data)
  await sql`CREATE INDEX idx_records_data ON records USING GIN (data)`.execute(db);

  // Index for unique_name search (used by # autocomplete)
  await db.schema
    .createIndex('idx_records_unique_name')
    .on('records')
    .column('unique_name')
    .execute();

  // Full-text search index on unique_name (only if pg_trgm is available)
  const trgmCheck = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    ) as exists
  `.execute(db);

  if (trgmCheck.rows[0]?.exists) {
    await sql`
      CREATE INDEX idx_records_unique_name_trgm
      ON records
      USING GIN (unique_name gin_trgm_ops)
    `.execute(db);
  } else {
    console.log('Note: pg_trgm not available, skipping trigram index');
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('records').ifExists().execute();
}
