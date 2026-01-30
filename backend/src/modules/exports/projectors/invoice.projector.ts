/**
 * Invoice Projector
 *
 * Transforms an Invoice record + linked line items + linked Contact (client)
 * into an InvoiceExportModel suitable for PDF/HTML rendering.
 */

import { db } from '@db/client.js';

import { resolveComputedFields } from '../../records/computed-fields.service.js';

// ============================================================================
// EXPORT MODEL
// ============================================================================

export interface InvoiceLineItemExport {
  description: string;
  itemType: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
  lineTax: number;
}

export interface InvoiceExportModel {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: string;
  notes: string;

  client: {
    name: string;
    company: string;
    email: string;
    phone: string;
    address: string;
  };

  lineItems: InvoiceLineItemExport[];

  subtotal: number;
  taxTotal: number;
  total: number;

  payments: Array<{
    date: string;
    amount: number;
    method: string;
    reference: string;
  }>;

  amountPaid: number;
  balanceDue: number;
}

// ============================================================================
// PROJECTION
// ============================================================================

/**
 * Project a single invoice into an export model.
 */
export async function projectInvoice(invoiceId: string): Promise<InvoiceExportModel | null> {
  // 1. Fetch the invoice record
  const invoice = await db
    .selectFrom('records')
    .selectAll()
    .where('id', '=', invoiceId)
    .executeTakeFirst();

  if (!invoice) return null;

  const invoiceData = invoice.data as Record<string, unknown>;

  // 2. Fetch the definition for computed field resolution
  const def = await db
    .selectFrom('record_definitions')
    .selectAll()
    .where('id', '=', invoice.definition_id)
    .executeTakeFirst();

  let resolved = invoiceData;
  if (def) {
    const schemaConfig = typeof def.schema_config === 'string'
      ? JSON.parse(def.schema_config)
      : def.schema_config;
    const resolvedRecord = await resolveComputedFields(invoice.id, invoiceData, schemaConfig);
    resolved = { ...invoiceData, ...resolvedRecord._computed };
  }

  // 3. Fetch linked line items
  const lineItemLinks = await db
    .selectFrom('record_links')
    .selectAll()
    .where('source_record_id', '=', invoiceId)
    .where('link_type', '=', 'line_item')
    .execute();

  const lineItemIds = lineItemLinks.map((l) => l.target_record_id);
  const lineItems: InvoiceLineItemExport[] = [];

  if (lineItemIds.length > 0) {
    const lineItemRecords = await db
      .selectFrom('records')
      .selectAll()
      .where('id', 'in', lineItemIds)
      .execute();

    for (const li of lineItemRecords) {
      const liData = li.data as Record<string, unknown>;
      const unitPrice = extractCents(liData, 'unit_price');
      const qty = (liData.qty as number) || 0;
      const vatRate = (liData.vat_rate as number) || 0;
      const lineTotal = qty * unitPrice;
      const lineTax = Math.round(lineTotal * vatRate / 100);

      lineItems.push({
        description: (liData.description as string) || '',
        itemType: (liData.item_type as string) || '',
        qty,
        unitPrice,
        vatRate,
        lineTotal,
        lineTax,
      });
    }
  }

  // 4. Fetch linked client contact
  const clientLinks = await db
    .selectFrom('record_links')
    .selectAll()
    .where('source_record_id', '=', invoiceId)
    .where('link_type', '=', 'client')
    .execute();

  let client = { name: '', company: '', email: '', phone: '', address: '' };
  if (clientLinks.length > 0) {
    const contactRecord = await db
      .selectFrom('records')
      .selectAll()
      .where('id', '=', clientLinks[0].target_record_id)
      .executeTakeFirst();

    if (contactRecord) {
      const cData = contactRecord.data as Record<string, unknown>;
      client = {
        name: (cData.name as string) || '',
        company: (cData.company as string) || '',
        email: (cData.email as string) || '',
        phone: (cData.phone as string) || '',
        address: (cData.address as string) || '',
      };
    }
  }

  // 5. Fetch linked payments
  const paymentLinks = await db
    .selectFrom('record_links')
    .selectAll()
    .where('source_record_id', '=', invoiceId)
    .where('link_type', '=', 'payment')
    .execute();

  const payments: InvoiceExportModel['payments'] = [];
  let amountPaid = 0;

  if (paymentLinks.length > 0) {
    const paymentIds = paymentLinks.map((l) => l.target_record_id);
    const paymentRecords = await db
      .selectFrom('records')
      .selectAll()
      .where('id', 'in', paymentIds)
      .execute();

    for (const p of paymentRecords) {
      const pData = p.data as Record<string, unknown>;
      const amount = extractCents(pData, 'amount');
      payments.push({
        date: (pData.payment_date as string) || '',
        amount,
        method: (pData.method as string) || '',
        reference: (pData.reference_number as string) || '',
      });
      amountPaid += amount;
    }
  }

  // 6. Build export model
  const subtotal = (resolved.subtotal as number) ?? lineItems.reduce((s, li) => s + li.lineTotal, 0);
  const taxTotal = (resolved.tax_total as number) ?? lineItems.reduce((s, li) => s + li.lineTax, 0);
  const total = (resolved.total as number) ?? subtotal + taxTotal;

  return {
    invoiceNumber: (invoiceData.invoice_number as string) || invoice.unique_name,
    issueDate: (invoiceData.issue_date as string) || '',
    dueDate: (invoiceData.due_date as string) || '',
    currency: (invoiceData.currency as string) || 'CAD',
    status: (invoiceData.status as string) || 'Draft',
    notes: (invoiceData.notes as string) || '',
    client,
    lineItems,
    subtotal,
    taxTotal,
    total,
    payments,
    amountPaid,
    balanceDue: total - amountPaid,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function extractCents(data: Record<string, unknown>, key: string): number {
  const val = data[key];
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'amount' in val) {
    return (val as { amount: number }).amount;
  }
  return 0;
}
