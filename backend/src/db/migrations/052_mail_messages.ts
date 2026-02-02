/**
 * Migration 052: Mail Messages + Mail Links
 *
 * Promoted emails from AutoHelper's transient store become durable
 * mail_messages in PostgreSQL. mail_links provides polymorphic
 * associations to actions, records, and hierarchy nodes.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('mail_messages')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('external_id', 'text', (col) => col.notNull().unique())
        .addColumn('subject', 'text')
        .addColumn('sender', 'text')
        .addColumn('sender_name', 'text')
        .addColumn('received_at', 'timestamptz')
        .addColumn('body_preview', 'text')
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
        .addColumn('project_id', 'uuid', (col) =>
            col.references('hierarchy_nodes.id').onDelete('set null')
        )
        .addColumn('promoted_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .addColumn('promoted_by', 'uuid', (col) =>
            col.notNull().references('users.id')
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .execute();

    await db.schema
        .createTable('mail_links')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('mail_message_id', 'uuid', (col) =>
            col.notNull().references('mail_messages.id').onDelete('cascade')
        )
        .addColumn('target_type', 'text', (col) => col.notNull())
        .addColumn('target_id', 'uuid', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .addColumn('created_by', 'uuid', (col) =>
            col.notNull().references('users.id')
        )
        .addUniqueConstraint('uq_mail_links_message_target', [
            'mail_message_id',
            'target_type',
            'target_id',
        ])
        .execute();

    // Indexes
    await db.schema
        .createIndex('idx_mail_messages_external')
        .on('mail_messages')
        .column('external_id')
        .execute();

    await db.schema
        .createIndex('idx_mail_messages_project')
        .on('mail_messages')
        .column('project_id')
        .execute();

    await db.schema
        .createIndex('idx_mail_links_target')
        .on('mail_links')
        .columns(['target_type', 'target_id'])
        .execute();

    await db.schema
        .createIndex('idx_mail_links_message')
        .on('mail_links')
        .column('mail_message_id')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('mail_links').ifExists().execute();
    await db.schema.dropTable('mail_messages').ifExists().execute();
}
