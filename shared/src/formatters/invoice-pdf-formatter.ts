/**
 * Invoice PDF Formatter
 *
 * Generates HTML for invoice PDF export.
 * Uses Source Serif 4 for content and IBM Plex Mono for amounts,
 * following the AutoArt design system parchment aesthetic.
 */

import { PDF_PAGE_PRESETS, type PdfPagePreset } from '../schemas/exports.js';
import { compilePdfStyles } from './compile-pdf-styles.js';
import { PARCHMENT_TOKENS } from './style-tokens.js';
import { escapeHtml, formatCents, sanitizeClassName } from './format-utils.js';

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
// COMPILED TOKENS
// ============================================================================

const P = compilePdfStyles(PARCHMENT_TOKENS);

// ============================================================================
// HTML GENERATION
// ============================================================================

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
      <td style="padding: 8px 12px; border-bottom: 1px solid ${P.colors.border};">
        <div>${escapeHtml(li.description)}</div>
        <div style="font-size: ${P.sizes.micro}; color: ${P.colors.textSecondary};">${escapeHtml(li.itemType)}</div>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid ${P.colors.border}; text-align: right; font-family: ${P.fonts.monoStack};">${li.qty}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid ${P.colors.border}; text-align: right; font-family: ${P.fonts.monoStack};">${formatCents(li.unitPrice, currency)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid ${P.colors.border}; text-align: right; font-family: ${P.fonts.monoStack};">${li.vatRate}%</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid ${P.colors.border}; text-align: right; font-family: ${P.fonts.monoStack}; font-weight: 600;">${formatCents(li.lineTotal, currency)}</td>
    </tr>
  `).join('');

  const paymentRows = invoice.payments.length > 0 ? invoice.payments.map((p) => `
    <tr>
      <td style="padding: 4px 0; font-size: 12px;">${escapeHtml(p.date)}</td>
      <td style="padding: 4px 0; font-size: 12px;">${escapeHtml(p.method)}</td>
      <td style="padding: 4px 0; font-size: 12px;">${escapeHtml(p.reference)}</td>
      <td style="padding: 4px 0; font-size: 12px; text-align: right; font-family: ${P.fonts.monoStack};">${formatCents(p.amount, currency)}</td>
    </tr>
  `).join('') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    ${P.fontCss}

    ${P.cssText}

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
      border-bottom: 2px solid ${P.colors.text};
    }

    .invoice-title {
      font-size: ${P.sizes.h1};
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .invoice-meta {
      text-align: right;
    }

    .meta-label {
      font-size: ${P.sizes.meta};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${P.colors.textSecondary};
    }

    .meta-value {
      font-family: ${P.fonts.monoStack};
      font-size: 13px;
    }

    .client-block {
      margin-bottom: 32px;
    }

    .section-label {
      font-size: ${P.sizes.meta};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${P.colors.accentSecondary};
      margin-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: 8px 12px;
      text-align: left;
      font-size: ${P.sizes.meta};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: ${P.colors.textSecondary};
      border-bottom: 2px solid ${P.colors.border};
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
      border-top: 2px solid ${P.colors.text};
      font-weight: 600;
      font-size: ${P.sizes.h2};
    }

    .totals-table .amount {
      text-align: right;
      font-family: ${P.fonts.monoStack};
    }

    .payments-section {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid ${P.colors.border};
    }

    .notes-section {
      margin-top: 24px;
      padding: 16px;
      background: rgba(63, 92, 110, 0.04);
      border-left: 2px solid rgba(63, 92, 110, 0.2);
      font-size: 13px;
      color: ${P.colors.textSecondary};
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: ${P.sizes.micro};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .status-draft { background: ${P.colors.border}; color: ${P.colors.text}; }
    .status-sent { background: ${P.colors.accent}; color: white; }
    .status-paid { background: ${P.colors.success}; color: white; }
    .status-overdue { background: ${P.colors.error}; color: white; }
    .status-void { background: #8C8C88; color: white; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="invoice-title">INVOICE</div>
        <div style="margin-top: 4px;">
          <span class="status-badge status-${sanitizeClassName(invoice.status.toLowerCase())}">${escapeHtml(invoice.status)}</span>
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
      ${invoice.client.address ? `<div style="color: ${P.colors.textSecondary};">${escapeHtml(invoice.client.address)}</div>` : ''}
      ${invoice.client.email ? `<div style="color: ${P.colors.textSecondary};">${escapeHtml(invoice.client.email)}</div>` : ''}
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
          <td class="amount" style="color: ${P.colors.success};">-${formatCents(invoice.amountPaid, currency)}</td>
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
