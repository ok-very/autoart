/**
 * Invoice List Projector
 *
 * Extracts invoice records for a project into a flat row format
 * suitable for CSV export.
 */

import { db } from '@db/client.js';

// ============================================================================
// EXPORT MODEL
// ============================================================================

export interface InvoiceListExportRow {
    invoiceNumber: string;
    client: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    tax: number;
    total: number;
    status: string;
    currency: string;
}

// ============================================================================
// PROJECTION
// ============================================================================

/**
 * Project invoice records for a given project into export rows.
 */
export async function projectInvoiceList(projectId: string): Promise<InvoiceListExportRow[]> {
    const invoiceDef = await db
        .selectFrom('record_definitions')
        .select(['id'])
        .where('name', '=', 'Invoice')
        .executeTakeFirst();

    if (!invoiceDef) return [];

    const invoices = await db
        .selectFrom('records')
        .selectAll()
        .where('definition_id', '=', invoiceDef.id)
        .where('classification_node_id', '=', projectId)
        .execute();

    return invoices.map((r) => {
        const data = r.data as Record<string, unknown>;
        const total = extractAmountCents(data, 'total');
        const subtotal = extractAmountCents(data, 'subtotal');
        const tax = extractAmountCents(data, 'tax_total');
        return {
            invoiceNumber: (data.invoice_number as string) || r.unique_name,
            client: '',
            issueDate: (data.issue_date as string) || '',
            dueDate: (data.due_date as string) || '',
            subtotal,
            tax,
            total,
            status: (data.status as string) || 'Draft',
            currency: (data.currency as string) || 'CAD',
        };
    });
}

// ============================================================================
// HELPERS
// ============================================================================

function extractAmountCents(data: Record<string, unknown>, key: string): number {
    const val = data[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null && 'amount' in val) {
        return (val as { amount: number }).amount;
    }
    return 0;
}
