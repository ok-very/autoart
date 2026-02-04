/**
 * Migration 044: Rename action_recipe to action_arrangement
 *
 * Updates:
 * 1. Renames definition_kind values from 'action_recipe' to 'action_arrangement'
 * 2. Removes is_system flag from Task/Subtask (now user-defined arrangements)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // 1. Rename definition_kind values: action_recipe → action_arrangement
    await sql`
        UPDATE record_definitions
        SET definition_kind = 'action_arrangement'
        WHERE definition_kind = 'action_recipe'
    `.execute(db);

    // 2. Remove system flag from Task/Subtask (now user-defined arrangements)
    await sql`
        UPDATE record_definitions
        SET is_system = false
        WHERE name IN ('Task', 'Subtask')
          AND definition_kind = 'action_arrangement'
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // 1. Restore system flag on Task/Subtask
    await sql`
        UPDATE record_definitions
        SET is_system = true
        WHERE name IN ('Task', 'Subtask')
          AND definition_kind = 'action_arrangement'
    `.execute(db);

    // 2. Rename definition_kind values back: action_arrangement → action_recipe
    await sql`
        UPDATE record_definitions
        SET definition_kind = 'action_recipe'
        WHERE definition_kind = 'action_arrangement'
    `.execute(db);
}
