/**
 * Migration 041: Intake Forms Tables
 *
 * Creates database schema for Intake forms, generated pages, and submissions.
 *
 * Tables:
 * - intake_forms: Parent form entity with unique_id for public URLs
 * - intake_form_pages: Multi-page form content stored as Radix element trees
 * - intake_submissions: User submissions with metadata
 *
 * @see https://github.com/ok-very/autoart/issues/92
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Intake form status enum
  await sql`
    CREATE TYPE intake_form_status AS ENUM ('active', 'disabled')
  `.execute(db);

  // intake_forms table
  await db.schema
    .createTable('intake_forms')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('unique_id', 'text', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('status', sql`intake_form_status`, (col) =>
      col.notNull().defaultTo('active')
    )
    .addColumn('sharepoint_request_url', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index on unique_id for public URL lookups
  await db.schema
    .createIndex('idx_intake_forms_unique_id')
    .on('intake_forms')
    .column('unique_id')
    .execute();

  // intake_form_pages table
  await db.schema
    .createTable('intake_form_pages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('form_id', 'uuid', (col) =>
      col.notNull().references('intake_forms.id').onDelete('cascade')
    )
    .addColumn('page_index', 'integer', (col) => col.notNull())
    .addColumn('radix_tree', 'jsonb', (col) => col.notNull())
    .execute();

  // Index for fetching pages by form
  await db.schema
    .createIndex('idx_intake_form_pages_form')
    .on('intake_form_pages')
    .columns(['form_id', 'page_index'])
    .execute();

  // intake_submissions table
  await db.schema
    .createTable('intake_submissions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('form_id', 'uuid', (col) =>
      col.notNull().references('intake_forms.id').onDelete('cascade')
    )
    .addColumn('upload_code', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for fetching submissions by form, ordered by date
  await db.schema
    .createIndex('idx_intake_submissions_form_date')
    .on('intake_submissions')
    .columns(['form_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('intake_submissions').ifExists().execute();
  await db.schema.dropTable('intake_form_pages').ifExists().execute();
  await db.schema.dropTable('intake_forms').ifExists().execute();
  await sql`DROP TYPE IF EXISTS intake_form_status`.execute(db);
}
