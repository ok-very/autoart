import { Kysely } from 'kysely';

import type { Database } from '../schema.js';

/**
 * Migration 029: Update Fact Kind Definitions to 7 Canonical Families
 *
 * Updates the fact_kind_definitions table to use the 12 canonical fact kinds
 * from the 7 canonical families instead of the original 26 kinds.
 *
 * Old kinds are deprecated (marked needs_review=true), new kinds are added.
 */

export async function up(db: Kysely<Database>): Promise<void> {
    // Deprecate old fact kinds that no longer exist in canonical schema
    const deprecatedKinds = [
        'AGENDA_PREPARED',
        'MATERIALS_SENT',
        'REMINDER_SENT',
        'FOLLOWED_UP',
        'MEETING_RESCHEDULED',
        'CONTRACT_DRAFTED',
        'CONTRACT_SENT',
        'SIGNATURE_REQUESTED',
        'SIGNATURE_RECEIVED',
        'CONTRACT_AMENDED',
        'DOCUMENT_FILED',
        'DOCUMENT_APPROVED',
        'INVOICE_DRAFTED',
        'INVOICE_REVISED',
        'INVOICE_SUBMITTED',
        'INVOICE_REJECTED',
        'STAGE_INITIATED',
        'STAGE_COMPLETED',
    ];

    await db
        .updateTable('fact_kind_definitions' as any)
        .set({
            needs_review: true,
            is_known: false,
        })
        .where('fact_kind', 'in', deprecatedKinds)
        .execute();

    // Add new canonical fact kinds (12 kinds in 7 families)
    const canonicalFactKinds = [
        // 1. Communication
        { fact_kind: 'INFORMATION_SENT', display_name: 'Information Sent', description: 'Requests, submissions, reminders, follow-ups' },
        // 2. Artifacts
        { fact_kind: 'DOCUMENT_PREPARED', display_name: 'Document Prepared', description: 'Agendas, budgets, templates prepared' },
        { fact_kind: 'DOCUMENT_SUBMITTED', display_name: 'Document Submitted', description: 'Documents submitted to external parties' },
        // 3. Meetings
        { fact_kind: 'MEETING_SCHEDULED', display_name: 'Meeting Scheduled', description: 'Meeting scheduled or coordinated' },
        { fact_kind: 'MEETING_HELD', display_name: 'Meeting Held', description: 'Meeting occurred' },
        { fact_kind: 'MEETING_CANCELLED', display_name: 'Meeting Cancelled', description: 'Scheduled meeting cancelled' },
        // 4. Decisions
        { fact_kind: 'DECISION_RECORDED', display_name: 'Decision Recorded', description: 'Milestones, approvals, selections' },
        // 5. Financial
        { fact_kind: 'INVOICE_PREPARED', display_name: 'Invoice Prepared', description: 'Invoice or honorarium drafted' },
        { fact_kind: 'PAYMENT_RECORDED', display_name: 'Payment Recorded', description: 'Payment received or made' },
        // 6. Contracts
        { fact_kind: 'CONTRACT_EXECUTED', display_name: 'Contract Executed', description: 'Contract fully executed' },
        // 7. Process
        { fact_kind: 'PROCESS_INITIATED', display_name: 'Process Initiated', description: 'Project/process started' },
        { fact_kind: 'PROCESS_COMPLETED', display_name: 'Process Completed', description: 'Project/process finished' },
    ];

    for (const fk of canonicalFactKinds) {
        // Use upsert to handle existing kinds
        await db
            .insertInto('fact_kind_definitions' as any)
            .values({
                fact_kind: fk.fact_kind,
                display_name: fk.display_name,
                description: fk.description,
                source: 'system',
                confidence: 'high',
                needs_review: false,
                is_known: true,
            })
            .onConflict((oc) =>
                oc.column('fact_kind').doUpdateSet({
                    display_name: fk.display_name,
                    description: fk.description,
                    is_known: true,
                    needs_review: false,
                })
            )
            .execute();
    }
}

export async function down(db: Kysely<Database>): Promise<void> {
    // Revert deprecated kinds back to known
    const deprecatedKinds = [
        'AGENDA_PREPARED',
        'MATERIALS_SENT',
        'REMINDER_SENT',
        'FOLLOWED_UP',
    ];

    await db
        .updateTable('fact_kind_definitions' as any)
        .set({
            needs_review: false,
            is_known: true,
        })
        .where('fact_kind', 'in', deprecatedKinds)
        .execute();

    // Remove new canonical kinds (except those that existed before)
    const newKinds = [
        'INFORMATION_SENT',
        'DOCUMENT_PREPARED',
        'DECISION_RECORDED',
        'INVOICE_PREPARED',
    ];

    await db
        .deleteFrom('fact_kind_definitions' as any)
        .where('fact_kind', 'in', newKinds)
        .execute();
}
