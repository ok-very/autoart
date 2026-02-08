/**
 * Finance Narrative Renderer
 *
 * Converts FACT_RECORDED event payloads into human-readable narrative strings
 * for display in the Project Log.
 */

import { formatCents } from '@autoart/shared';

interface FactPayload {
  factKind: string;
  amount?: number;
  currency?: string;
  counterparty?: string;
  budgetName?: string;
  allocationType?: string;
  description?: string;
  category?: string;
  vendor?: string;
  billNumber?: string;
  notes?: string;
  [key: string]: unknown;
}

/**
 * Render a FACT_RECORDED event payload into a human-readable narrative.
 * Returns undefined if the factKind is not recognized.
 */
export function renderFinanceNarrative(payload: FactPayload): string | undefined {
  const { factKind, amount, currency } = payload;
  const amountStr = amount != null ? formatCents(amount, currency || 'CAD') : undefined;

  switch (factKind) {
    case 'INVOICE_PREPARED': {
      const parts = ['Invoice'];
      if (payload.notes) parts.push(payload.notes.replace('Invoice ', ''));
      parts.push('prepared');
      if (amountStr) parts.push(`for ${amountStr}`);
      if (payload.counterparty) parts.push(`(${payload.counterparty})`);
      return parts.join(' ');
    }

    case 'PAYMENT_RECORDED': {
      const parts = ['Payment'];
      if (amountStr) parts.push(`of ${amountStr}`);
      parts.push('recorded');
      if (payload.notes) parts.push(`(${payload.notes.replace('Direction: ', '')})`);
      return parts.join(' ');
    }

    case 'BUDGET_ALLOCATED': {
      const parts = ['Budget'];
      if (payload.budgetName) parts.push(`'${payload.budgetName}'`);
      parts.push('allocated');
      if (amountStr) parts.push(`: ${amountStr}`);
      return parts.join(' ');
    }

    case 'EXPENSE_RECORDED': {
      const parts = ['Expense'];
      if (payload.description) parts.push(`'${payload.description}'`);
      parts.push('recorded');
      if (amountStr) parts.push(`: ${amountStr}`);
      if (payload.category) parts.push(`[${payload.category}]`);
      return parts.join(' ');
    }

    case 'BILL_RECEIVED': {
      const parts = ['Vendor bill'];
      if (payload.billNumber) parts.push(`#${payload.billNumber}`);
      parts.push('received');
      if (payload.vendor) parts.push(`from ${payload.vendor}`);
      if (amountStr) parts.push(`: ${amountStr}`);
      return parts.join(' ');
    }

    default:
      return undefined;
  }
}
