/**
 * Seed: Core Record Definitions
 *
 * These are the foundational record types that the system needs.
 * This is REFERENCE DATA - it defines the structure of the system,
 * not user content.
 *
 * These definitions should be:
 * - Stable across environments
 * - Part of the "designed system"
 * - Safe to re-run (idempotent)
 */

import { Kysely } from 'kysely';

import type { Database } from '../schema.js';

export async function seed(db: Kysely<Database>): Promise<void> {
  console.log('  Seeding record definitions...');

  const definitions = [
    {
      name: 'Contact',
      schema_config: JSON.stringify({
        fields: [
          // Core identity - text types with semantic hints
          { key: 'name', type: 'text', label: 'Name', required: true },
          { key: 'email', type: 'text', label: 'Email', renderHint: 'email' },
          { key: 'phone', type: 'text', label: 'Phone', renderHint: 'phone' },
          { key: 'company', type: 'text', label: 'Company/Org' },
          { key: 'role', type: 'text', label: 'Role' },
          // Classification - status with options
          {
            key: 'contactGroup', type: 'status', label: 'Contact Group', options: [
              'Developer/Client', 'Artist/Arts Worker', 'City/Govt', 'Health Care',
              'Architect/Engineer', 'Fabricator/Supplier', 'Selection Panel', 'Miscellaneous',
            ]
          },
          // Free-form notes
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'indigo', icon: '👤' }),
    },
    {
      name: 'Location',
      schema_config: JSON.stringify({
        fields: [
          { key: 'name', type: 'text', label: 'Site Name', required: true },
          { key: 'address', type: 'text', label: 'Address' },
          { key: 'city', type: 'text', label: 'City' },
          { key: 'gps', type: 'text', label: 'GPS Coordinates' },
          { key: 'access_notes', type: 'textarea', label: 'Access Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'emerald', icon: '📍' }),
    },
    {
      name: 'Material',
      schema_config: JSON.stringify({
        fields: [
          { key: 'name', type: 'text', label: 'Material Name', required: true },
          { key: 'sku', type: 'text', label: 'SKU/Part Number' },
          { key: 'supplier', type: 'text', label: 'Supplier' },
          { key: 'unit_cost', type: 'number', label: 'Unit Cost' },
          { key: 'unit', type: 'text', label: 'Unit (ea, kg, m, etc.)' },
        ],
      }),
      styling: JSON.stringify({ color: 'amber', icon: '📦' }),
    },
    {
      name: 'Document',
      schema_config: JSON.stringify({
        fields: [
          { key: 'title', type: 'text', label: 'Document Title', required: true },
          { key: 'type', type: 'select', label: 'Type', options: ['Contract', 'Permit', 'Drawing', 'Report', 'Photo', 'Other'] },
          { key: 'url', type: 'url', label: 'Link/URL' },
          { key: 'date', type: 'date', label: 'Document Date' },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'slate', icon: '📄' }),
    },

    // ==================== FINANCE DEFINITIONS ====================

    {
      name: 'Invoice',
      schema_config: JSON.stringify({
        fields: [
          { key: 'invoice_number', type: 'text', label: 'Invoice Number', required: true },
          { key: 'issue_date', type: 'date', label: 'Issue Date', required: true },
          { key: 'due_date', type: 'date', label: 'Due Date' },
          { key: 'currency', type: 'select', label: 'Currency', options: ['CAD', 'USD', 'EUR'], defaultValue: 'CAD' },
          // Rollup: sum of linked line_item records' line_total field
          { key: 'subtotal', type: 'rollup', label: 'Subtotal', rollupConfig: { linkType: 'line_item', targetField: 'line_total', aggregation: 'sum' } },
          // Rollup: sum of linked line_item records' line_tax field
          { key: 'tax_total', type: 'rollup', label: 'Tax Total', rollupConfig: { linkType: 'line_item', targetField: 'line_tax', aggregation: 'sum' } },
          // Computed: subtotal + tax_total
          { key: 'total', type: 'computed', label: 'Total', formula: '#subtotal + #tax_total' },
          {
            key: 'status', type: 'status', label: 'Status',
            options: ['Draft', 'Sent', 'Paid', 'Overdue', 'Void'],
            statusConfig: {
              Draft: { label: 'Draft', colorClass: 'bg-slate-100 text-slate-700' },
              Sent: { label: 'Sent', colorClass: 'bg-blue-100 text-blue-700' },
              Paid: { label: 'Paid', colorClass: 'bg-green-100 text-green-700' },
              Overdue: { label: 'Overdue', colorClass: 'bg-amber-100 text-amber-700' },
              Void: { label: 'Void', colorClass: 'bg-red-100 text-red-700' },
            },
          },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'blue', icon: '🧾' }),
    },
    {
      name: 'Invoice Line Item',
      schema_config: JSON.stringify({
        fields: [
          { key: 'description', type: 'text', label: 'Description', required: true },
          { key: 'item_type', type: 'select', label: 'Type', options: ['Service', 'Material', 'Expense', 'Honorarium', 'Other'] },
          { key: 'qty', type: 'number', label: 'Qty', required: true },
          { key: 'unit_price', type: 'currency', label: 'Unit Price', currencyDefault: 'CAD' },
          { key: 'vat_rate', type: 'percent', label: 'Tax Rate' },
          // Computed: qty * unit_price (unit_price is in cents, result in cents)
          { key: 'line_total', type: 'computed', label: 'Line Total', formula: '#qty * #unit_price' },
          // Computed: line_total * vat_rate / 100
          { key: 'line_tax', type: 'computed', label: 'Line Tax', formula: '#line_total * #vat_rate / 100' },
        ],
      }),
      styling: JSON.stringify({ color: 'sky', icon: '📋' }),
    },
    {
      name: 'Budget',
      schema_config: JSON.stringify({
        fields: [
          { key: 'name', type: 'text', label: 'Budget Name', required: true },
          {
            key: 'allocation_type', type: 'select', label: 'Allocation Type',
            options: ['Total', 'Artwork', 'Fabrication', 'Installation', 'Contingency', 'Admin', 'Phase'],
          },
          { key: 'allocated_amount', type: 'currency', label: 'Allocated Amount', currencyDefault: 'CAD' },
          // Rollup: sum of linked budget_expense records' amount field
          { key: 'spent_amount', type: 'rollup', label: 'Spent', rollupConfig: { linkType: 'budget_expense', targetField: 'amount', aggregation: 'sum' } },
          // Computed: allocated_amount - spent_amount
          { key: 'remaining', type: 'computed', label: 'Remaining', formula: '#allocated_amount - #spent_amount' },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'emerald', icon: '📊' }),
    },
    {
      name: 'Payment',
      schema_config: JSON.stringify({
        fields: [
          { key: 'payment_date', type: 'date', label: 'Payment Date', required: true },
          { key: 'amount', type: 'currency', label: 'Amount', currencyDefault: 'CAD' },
          {
            key: 'method', type: 'select', label: 'Method',
            options: ['Bank Transfer', 'Cheque', 'Credit Card', 'Cash', 'Other'],
          },
          { key: 'reference_number', type: 'text', label: 'Reference Number' },
          { key: 'direction', type: 'select', label: 'Direction', options: ['Incoming', 'Outgoing'] },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'green', icon: '💳' }),
    },
    {
      name: 'Vendor Bill',
      schema_config: JSON.stringify({
        fields: [
          { key: 'bill_number', type: 'text', label: 'Bill Number', required: true },
          { key: 'received_date', type: 'date', label: 'Received Date' },
          { key: 'due_date', type: 'date', label: 'Due Date' },
          { key: 'amount', type: 'currency', label: 'Amount', currencyDefault: 'CAD' },
          {
            key: 'status', type: 'status', label: 'Status',
            options: ['Received', 'Approved', 'Paid', 'Disputed'],
            statusConfig: {
              Received: { label: 'Received', colorClass: 'bg-slate-100 text-slate-700' },
              Approved: { label: 'Approved', colorClass: 'bg-blue-100 text-blue-700' },
              Paid: { label: 'Paid', colorClass: 'bg-green-100 text-green-700' },
              Disputed: { label: 'Disputed', colorClass: 'bg-red-100 text-red-700' },
            },
          },
          {
            key: 'category', type: 'select', label: 'Category',
            options: ['Material', 'Fabrication', 'Installation', 'Consulting', 'Other'],
          },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'orange', icon: '📨' }),
    },
    {
      name: 'Expense',
      schema_config: JSON.stringify({
        fields: [
          { key: 'description', type: 'text', label: 'Description', required: true },
          { key: 'expense_date', type: 'date', label: 'Date', required: true },
          { key: 'amount', type: 'currency', label: 'Amount', currencyDefault: 'CAD' },
          {
            key: 'category', type: 'select', label: 'Category',
            options: ['Material', 'Travel', 'Equipment', 'Fabrication', 'Installation', 'Consulting', 'Admin', 'Other'],
          },
          { key: 'receipt_url', type: 'url', label: 'Receipt' },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'rose', icon: '🧾' }),
    },
  ];

  for (const def of definitions) {
    // Check if already exists (idempotent)
    const existing = await db
      .selectFrom('record_definitions')
      .select('id')
      .where('name', '=', def.name)
      .executeTakeFirst();

    if (!existing) {
      await db.insertInto('record_definitions').values(def).execute();
    }
  }

  console.log('  ✓ Record definitions seeded');
}
