import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Restored dummy migration to fix "missing migration" error.
  // The original 011_definition_templates was likely executed but the file was deleted.
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // No-op
}
