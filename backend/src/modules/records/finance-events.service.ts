/**
 * Finance Events Service
 *
 * Emits FACT_RECORDED events for finance operations via the events table.
 * These events appear in the Project Log alongside workflow events.
 *
 * Finance records (Invoice, Budget, Bill, Expense, Payment) are created
 * via the Records API, but the corresponding domain facts are emitted here
 * to maintain the immutable event trail.
 */

import { sql } from 'kysely';

import type { ContextType } from '@autoart/shared';

import { db } from '../../db/client.js';

interface EmitFactOptions {
  contextId: string;
  contextType: ContextType;
  actorId: string | null;
  factKind: string;
  payload: Record<string, unknown>;
}

/**
 * Emit a FACT_RECORDED event with a financial factKind.
 * Creates an event directly in the events table (no Action needed).
 */
export async function emitFinanceFact(options: EmitFactOptions): Promise<string> {
  const { contextId, contextType, actorId, factKind, payload } = options;

  const factPayload = {
    factKind,
    occurredAt: new Date().toISOString(),
    source: 'system' as const,
    confidence: 'high' as const,
    ...payload,
  };

  const result = await db
    .insertInto('events')
    .values({
      context_id: contextId,
      context_type: contextType,
      action_id: null,
      type: 'FACT_RECORDED',
      payload: sql`${JSON.stringify(factPayload)}::jsonb`,
      actor_id: actorId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return result.id;
}

/**
 * Emit INVOICE_PREPARED fact when an invoice is created.
 */
export async function emitInvoiceCreated(params: {
  contextId: string;
  actorId: string | null;
  counterparty?: string;
  amount?: number;
  currency?: string;
  invoiceNumber?: string;
}): Promise<string> {
  return emitFinanceFact({
    contextId: params.contextId,
    contextType: 'project',
    actorId: params.actorId,
    factKind: 'INVOICE_PREPARED',
    payload: {
      counterparty: params.counterparty,
      amount: params.amount,
      currency: params.currency,
      notes: params.invoiceNumber ? `Invoice #${params.invoiceNumber}` : undefined,
    },
  });
}

/**
 * Emit PAYMENT_RECORDED fact when a payment is recorded.
 */
export async function emitPaymentRecorded(params: {
  contextId: string;
  actorId: string | null;
  counterparty?: string;
  amount?: number;
  currency?: string;
  direction?: string;
}): Promise<string> {
  return emitFinanceFact({
    contextId: params.contextId,
    contextType: 'project',
    actorId: params.actorId,
    factKind: 'PAYMENT_RECORDED',
    payload: {
      counterparty: params.counterparty,
      amount: params.amount,
      currency: params.currency,
      notes: params.direction ? `Direction: ${params.direction}` : undefined,
    },
  });
}

/**
 * Emit BUDGET_ALLOCATED fact when a budget is created.
 */
export async function emitBudgetAllocated(params: {
  contextId: string;
  actorId: string | null;
  budgetName?: string;
  allocationType?: string;
  amount?: number;
  currency?: string;
}): Promise<string> {
  return emitFinanceFact({
    contextId: params.contextId,
    contextType: 'project',
    actorId: params.actorId,
    factKind: 'BUDGET_ALLOCATED',
    payload: {
      budgetName: params.budgetName,
      allocationType: params.allocationType,
      amount: params.amount,
      currency: params.currency,
    },
  });
}

/**
 * Emit EXPENSE_RECORDED fact when an expense is recorded.
 */
export async function emitExpenseRecorded(params: {
  contextId: string;
  actorId: string | null;
  description?: string;
  category?: string;
  amount?: number;
  currency?: string;
}): Promise<string> {
  return emitFinanceFact({
    contextId: params.contextId,
    contextType: 'project',
    actorId: params.actorId,
    factKind: 'EXPENSE_RECORDED',
    payload: {
      description: params.description,
      category: params.category,
      amount: params.amount,
      currency: params.currency,
    },
  });
}

/**
 * Emit BILL_RECEIVED fact when a vendor bill is recorded.
 */
export async function emitBillReceived(params: {
  contextId: string;
  actorId: string | null;
  vendor?: string;
  billNumber?: string;
  amount?: number;
  currency?: string;
}): Promise<string> {
  return emitFinanceFact({
    contextId: params.contextId,
    contextType: 'project',
    actorId: params.actorId,
    factKind: 'BILL_RECEIVED',
    payload: {
      vendor: params.vendor,
      billNumber: params.billNumber,
      amount: params.amount,
      currency: params.currency,
    },
  });
}
