/**
 * Migration 039: Record Aliases (Naming History)
 *
 * Tracks the "naming history" of records.
 * When a record is renamed, the old name is stored here as 'historical'.
 * Also allows strictly defining 'alias' names that are not primary.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('record_aliases')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('record_id', 'uuid', (col) =>
            col.notNull().references('records.id').onDelete('cascade')
        )
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('type', 'varchar(50)', (col) => col.notNull()) // 'primary', 'historical', 'alias'
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Index for quickly finding aliases for a record
    await db.schema
        .createIndex('idx_record_aliases_record_id')
        .on('record_aliases')
        .column('record_id')
        .execute();

    // Index for finding records by alias (search)
    await db.schema
        .createIndex('idx_record_aliases_name')
        .on('record_aliases')
        .column('name')
        .execute();

    // Full-text search index (trigram) for fuzzy matching aliases
    const trgmCheck = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    ) as exists
  `.execute(db);

    if (trgmCheck.rows[0]?.exists) {
        await sql`
      CREATE INDEX idx_record_aliases_name_trgm
      ON record_aliases
      USING GIN (name gin_trgm_ops)
    `.execute(db);
    } else {
        console.log('Note: pg_trgm not available, skipping trigram index for record_aliases');
    }
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('record_aliases').execute();
}
