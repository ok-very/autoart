/**
 * Invoice PDF Formatter
 *
 * Generates HTML for invoice PDF export.
 * Uses Source Serif 4 for content and IBM Plex Mono for amounts,
 * following the AutoArt design system parchment aesthetic.
 */

import { PDF_PAGE_PRESETS, PDF_DEFAULT_MARGINS, type PdfPagePreset } from '../schemas/exports.js';

// ============================================================================
// INVOICE EXPORT MODEL (duplicated here for shared access)
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
// HTML GENERATION
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCents(cents: number, currency: string): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generate invoice HTML for PDF rendering via AutoHelper.
 */
export function generateInvoicePdfHtml(
  invoice: InvoiceExportModel,
  config: {
    pagePreset?: PdfPagePreset;
    autoHelperBaseUrl: string;
  }
): string {
  const preset = config.pagePreset || 'letter';
  const pageConfig = PDF_PAGE_PRESETS[preset];
  const { currency } = invoice;

  const lineItemRows = invoice.lineItems.map((li) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #D6D2CB;">
        <div>${escapeHtml(li.description)}</div>
        <div style="font-size: 11px; color: #5A5A57;">${escapeHtml(li.itemType)}</div>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #D6D2CB; text-align: right; font-family: 'IBM Plex Mono', monospace;">${li.qty}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #D6D2CB; text-align: right; font-family: 'IBM Plex Mono', monospace;">${formatCents(li.unitPrice, currency)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #D6D2CB; text-align: right; font-family: 'IBM Plex Mono', monospace;">${li.vatRate}%</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #D6D2CB; text-align: right; font-family: 'IBM Plex Mono', monospace; font-weight: 600;">${formatCents(li.lineTotal, currency)}</td>
    </tr>
  `).join('');

  const paymentRows = invoice.payments.length > 0 ? invoice.payments.map((p) => `
    <tr>
      <td style="padding: 4px 0; font-size: 12px;">${escapeHtml(p.date)}</td>
      <td style="padding: 4px 0; font-size: 12px;">${escapeHtml(p.method)}</td>
      <td style="padding: 4px 0; font-size: 12px;">${escapeHtml(p.reference)}</td>
      <td style="padding: 4px 0; font-size: 12px; text-align: right; font-family: 'IBM Plex Mono', monospace;">${formatCents(p.amount, currency)}</td>
    </tr>
  `).join('') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Source Serif 4', serif;
      font-size: 14px;
      line-height: 1.5;
      color: #2E2E2C;
      background: #F5F2ED;
    }

    .page {
      width: ${pageConfig.width}px;
      min-height: ${pageConfig.height}px;
      padding: 48px;
      background: white;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2E2E2C;
    }

    .invoice-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .invoice-meta {
      text-align: right;
    }

    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5A5A57;
    }

    .meta-value {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
    }

    .client-block {
      margin-bottom: 32px;
    }

    .section-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8A5A3C;
      margin-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: 8px 12px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #5A5A57;
      border-bottom: 2px solid #D6D2CB;
      font-weight: 600;
    }

    th.right { text-align: right; }

    .totals {
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
    }

    .totals-table {
      width: 280px;
    }

    .totals-table td {
      padding: 4px 0;
    }

    .totals-table .total-row td {
      padding-top: 8px;
      border-top: 2px solid #2E2E2C;
      font-weight: 600;
      font-size: 16px;
    }

    .totals-table .amount {
      text-align: right;
      font-family: 'IBM Plex Mono', monospace;
    }

    .payments-section {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #D6D2CB;
    }

    .notes-section {
      margin-top: 24px;
      padding: 16px;
      background: rgba(63, 92, 110, 0.04);
      border-left: 2px solid rgba(63, 92, 110, 0.2);
      font-size: 13px;
      color: #5A5A57;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .status-draft { background: #D6D2CB; color: #2E2E2C; }
    .status-sent { background: #3F5C6E; color: white; }
    .status-paid { background: #6F7F5C; color: white; }
    .status-overdue { background: #8C4A4A; color: white; }
    .status-void { background: #8C8C88; color: white; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="invoice-title">INVOICE</div>
        <div style="margin-top: 4px;">
          <span class="status-badge status-${invoice.status.toLowerCase()}">${escapeHtml(invoice.status)}</span>
        </div>
      </div>
      <div class="invoice-meta">
        <div>
          <div class="meta-label">Invoice Number</div>
          <div class="meta-value">${escapeHtml(invoice.invoiceNumber)}</div>
        </div>
        <div style="margin-top: 8px;">
          <div class="meta-label">Issue Date</div>
          <div class="meta-value">${escapeHtml(invoice.issueDate)}</div>
        </div>
        <div style="margin-top: 8px;">
          <div class="meta-label">Due Date</div>
          <div class="meta-value">${escapeHtml(invoice.dueDate)}</div>
        </div>
      </div>
    </div>

    <div class="client-block">
      <div class="section-label">Bill To</div>
      ${invoice.client.name ? `<div style="font-weight: 600;">${escapeHtml(invoice.client.name)}</div>` : ''}
      ${invoice.client.company ? `<div>${escapeHtml(invoice.client.company)}</div>` : ''}
      ${invoice.client.address ? `<div style="color: #5A5A57;">${escapeHtml(invoice.client.address)}</div>` : ''}
      ${invoice.client.email ? `<div style="color: #5A5A57;">${escapeHtml(invoice.client.email)}</div>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">Tax</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-table">
        <tr>
          <td>Subtotal</td>
          <td class="amount">${formatCents(invoice.subtotal, currency)}</td>
        </tr>
        <tr>
          <td>Tax</td>
          <td class="amount">${formatCents(invoice.taxTotal, currency)}</td>
        </tr>
        <tr class="total-row">
          <td>Total</td>
          <td class="amount">${formatCents(invoice.total, currency)}</td>
        </tr>
        ${invoice.amountPaid > 0 ? `
        <tr>
          <td>Paid</td>
          <td class="amount" style="color: #6F7F5C;">-${formatCents(invoice.amountPaid, currency)}</td>
        </tr>
        <tr style="font-weight: 600;">
          <td>Balance Due</td>
          <td class="amount">${formatCents(invoice.balanceDue, currency)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${paymentRows ? `
    <div class="payments-section">
      <div class="section-label">Payment History</div>
      <table style="margin-top: 8px;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Method</th>
            <th>Reference</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${paymentRows}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${invoice.notes ? `
    <div class="notes-section">
      ${escapeHtml(invoice.notes)}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}
