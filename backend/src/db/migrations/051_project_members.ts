/**
 * Migration 051: Project Members
 *
 * Many-to-many table linking users to projects with role-based membership.
 * Supports ownership transfer and membership management.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('project_members')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('project_id', 'uuid', (col) =>
            col.notNull().references('hierarchy_nodes.id').onDelete('cascade')
        )
        .addColumn('user_id', 'uuid', (col) =>
            col.notNull().references('users.id').onDelete('cascade')
        )
        .addColumn('role', 'text', (col) => col.notNull().defaultTo('member'))
        .addColumn('assigned_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .addColumn('assigned_by', 'uuid', (col) =>
            col.references('users.id').onDelete('set null')
        )
        .addUniqueConstraint('uq_project_members_project_user', ['project_id', 'user_id'])
        .execute();

    await db.schema
        .createIndex('idx_project_members_project')
        .on('project_members')
        .column('project_id')
        .execute();

    await db.schema
        .createIndex('idx_project_members_user')
        .on('project_members')
        .column('user_id')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('project_members').ifExists().execute();
}
