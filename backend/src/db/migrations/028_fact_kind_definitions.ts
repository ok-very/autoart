import { Kysely, sql } from 'kysely';
import type { Database } from '../schema.js';

/**
 * Migration 028: Fact Kind Definitions
 *
 * Creates a table to track discovered fact kinds from imports.
 * This enables the Definition Review UI to show auto-created fact kinds
 * that need review before being promoted to known/trusted status.
 */

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable('fact_kind_definitions')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('fact_kind', 'varchar(100)', (col) => col.notNull().unique())
        .addColumn('display_name', 'varchar(200)', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('payload_schema', 'jsonb', (col) => col.defaultTo(sql`'{}'`))
        .addColumn('example_payload', 'jsonb') // First-seen payload for reference
        .addColumn('source', 'varchar(50)', (col) =>
            col.notNull().defaultTo('csv-import')
        )
        .addColumn('confidence', 'varchar(20)', (col) =>
            col.notNull().defaultTo('low')
        )
        .addColumn('needs_review', 'boolean', (col) =>
            col.notNull().defaultTo(true)
        )
        .addColumn('is_known', 'boolean', (col) =>
            col.notNull().defaultTo(false)
        )
        .addColumn('first_seen_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .addColumn('reviewed_at', 'timestamptz')
        .addColumn('reviewed_by', 'uuid', (col) =>
            col.references('users.id').onDelete('set null')
        )
        .execute();

    // Index for quick lookup by review status
    await db.schema
        .createIndex('idx_fact_kind_definitions_needs_review')
        .on('fact_kind_definitions')
        .column('needs_review')
        .execute();

    // Seed known fact kinds from domain-events.ts
    const knownFactKinds = [
        { fact_kind: 'MEETING_SCHEDULED', display_name: 'Meeting Scheduled' },
        { fact_kind: 'AGENDA_PREPARED', display_name: 'Agenda Prepared' },
        { fact_kind: 'MATERIALS_SENT', display_name: 'Materials Sent' },
        { fact_kind: 'REMINDER_SENT', display_name: 'Reminder Sent' },
        { fact_kind: 'MEETING_HELD', display_name: 'Meeting Held' },
        { fact_kind: 'MEETING_CANCELLED', display_name: 'Meeting Cancelled' },
        { fact_kind: 'MEETING_RESCHEDULED', display_name: 'Meeting Rescheduled' },
        { fact_kind: 'FOLLOWED_UP', display_name: 'Followed Up' },
        { fact_kind: 'CONTRACT_DRAFTED', display_name: 'Contract Drafted' },
        { fact_kind: 'CONTRACT_SENT', display_name: 'Contract Sent' },
        { fact_kind: 'SIGNATURE_REQUESTED', display_name: 'Signature Requested' },
        { fact_kind: 'SIGNATURE_RECEIVED', display_name: 'Signature Received' },
        { fact_kind: 'CONTRACT_EXECUTED', display_name: 'Contract Executed' },
        { fact_kind: 'CONTRACT_AMENDED', display_name: 'Contract Amended' },
        { fact_kind: 'DOCUMENT_FILED', display_name: 'Document Filed' },
        { fact_kind: 'DOCUMENT_SUBMITTED', display_name: 'Document Submitted' },
        { fact_kind: 'DOCUMENT_APPROVED', display_name: 'Document Approved' },
        { fact_kind: 'INVOICE_DRAFTED', display_name: 'Invoice Drafted' },
        { fact_kind: 'INVOICE_REVISED', display_name: 'Invoice Revised' },
        { fact_kind: 'INVOICE_SUBMITTED', display_name: 'Invoice Submitted' },
        { fact_kind: 'INVOICE_REJECTED', display_name: 'Invoice Rejected' },
        { fact_kind: 'PAYMENT_RECORDED', display_name: 'Payment Recorded' },
        { fact_kind: 'PROCESS_INITIATED', display_name: 'Process Initiated' },
        { fact_kind: 'PROCESS_COMPLETED', display_name: 'Process Completed' },
        { fact_kind: 'STAGE_INITIATED', display_name: 'Stage Initiated' },
        { fact_kind: 'STAGE_COMPLETED', display_name: 'Stage Completed' },
    ];

    for (const fk of knownFactKinds) {
        await db
            .insertInto('fact_kind_definitions' as any)
            .values({
                fact_kind: fk.fact_kind,
                display_name: fk.display_name,
                source: 'system',
                confidence: 'high',
                needs_review: false,
                is_known: true,
            })
            .execute();
    }
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable('fact_kind_definitions').ifExists().execute();
}
