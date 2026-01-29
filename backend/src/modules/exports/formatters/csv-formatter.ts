/**
 * CSV Formatter
 *
 * Generates CSV output for finance exports.
 * Supports budget summary ("Boss Sheet v1") and invoice list presets.
 */

export type CsvPreset = 'budget-summary' | 'invoice-list';

interface BudgetCsvRow {
  name: string;
  allocationType: string;
  allocated: number;
  spent: number;
  remaining: number;
  utilizationPct: number;
  currency: string;
}

interface InvoiceCsvRow {
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

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Generate CSV for budget summary ("Boss Sheet v1").
 * Stable column layout for spreadsheet consumption.
 */
export function formatBudgetCsv(rows: BudgetCsvRow[]): string {
  const headers = [
    'Budget Name',
    'Allocation Type',
    'Allocated',
    'Spent',
    'Remaining',
    'Utilization %',
    'Currency',
  ];

  const csvRows = rows.map((r) => [
    escapeCsvField(r.name),
    escapeCsvField(r.allocationType),
    formatCents(r.allocated),
    formatCents(r.spent),
    formatCents(r.remaining),
    r.utilizationPct.toFixed(1),
    r.currency,
  ].join(','));

  // Append totals row
  if (rows.length > 0) {
    const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
    const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
    const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
    const totalUtilization = totalAllocated > 0
      ? (totalSpent / totalAllocated) * 100
      : 0;

    csvRows.push([
      'TOTAL',
      '',
      formatCents(totalAllocated),
      formatCents(totalSpent),
      formatCents(totalRemaining),
      totalUtilization.toFixed(1),
      rows[0].currency,
    ].join(','));
  }

  return [headers.join(','), ...csvRows].join('\n');
}

/**
 * Generate CSV for invoice list export.
 */
export function formatInvoiceListCsv(rows: InvoiceCsvRow[]): string {
  const headers = [
    'Invoice #',
    'Client',
    'Issue Date',
    'Due Date',
    'Subtotal',
    'Tax',
    'Total',
    'Status',
    'Currency',
  ];

  const csvRows = rows.map((r) => [
    escapeCsvField(r.invoiceNumber),
    escapeCsvField(r.client),
    r.issueDate,
    r.dueDate,
    formatCents(r.subtotal),
    formatCents(r.tax),
    formatCents(r.total),
    r.status,
    r.currency,
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}
