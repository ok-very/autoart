/**
 * Overdue Detection Service
 *
 * Checks for invoices past their due_date with status != Paid/Void,
 * updates their status to Overdue, and emits a FACT_RECORDED event.
 *
 * Designed to be called on a daily schedule or on-demand.
 */

import { sql } from 'kysely';

import { db } from '../../db/client.js';
import { emitFinanceFact } from './finance-events.service.js';

interface OverdueResult {
  checked: number;
  overdueFound: number;
  updated: string[];
}

/**
 * Scan all Invoice records for overdue status.
 *
 * An invoice is overdue when:
 * - status is 'Sent' (not Draft, Paid, Void, or already Overdue)
 * - due_date is in the past
 */
export async function detectOverdueInvoices(): Promise<OverdueResult> {
  const today = new Date().toISOString().slice(0, 10);

  // Find the Invoice definition
  const invoiceDef = await db
    .selectFrom('record_definitions')
    .select(['id'])
    .where('name', '=', 'Invoice')
    .executeTakeFirst();

  if (!invoiceDef) {
    return { checked: 0, overdueFound: 0, updated: [] };
  }

  // Find invoices with status 'Sent' and due_date in the past
  const candidates = await db
    .selectFrom('records')
    .selectAll()
    .where('definition_id', '=', invoiceDef.id)
    .where(sql`data->>'status'`, '=', 'Sent')
    .where(sql`data->>'due_date'`, '<', today)
    .execute();

  const updated: string[] = [];

  for (const record of candidates) {
    const data = record.data as Record<string, unknown>;

    // Update status to Overdue
    const updatedData = { ...data, status: 'Overdue' };
    await db
      .updateTable('records')
      .set({ data: sql`${JSON.stringify(updatedData)}::jsonb` })
      .where('id', '=', record.id)
      .execute();

    // Emit overdue fact event if classified to a project
    if (record.classification_node_id) {
      await emitFinanceFact({
        contextId: record.classification_node_id,
        contextType: 'project',
        actorId: null,
        factKind: 'INVOICE_PREPARED',
        payload: {
          counterparty: data.client_name as string | undefined,
          amount: (data.total as number) ?? undefined,
          currency: (data.currency as string) || 'CAD',
          notes: `Invoice #${data.invoice_number || record.unique_name} is overdue (due ${data.due_date})`,
        },
      });
    }

    updated.push(record.id);
  }

  return {
    checked: candidates.length,
    overdueFound: updated.length,
    updated,
  };
}
