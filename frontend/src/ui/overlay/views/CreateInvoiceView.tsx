/**
 * CreateInvoiceView
 *
 * Overlay for creating a new Invoice record with line items.
 * Includes header metadata, editable line items table, and auto-calculated totals.
 */

import { useState, useMemo, useCallback } from 'react';

import { useRecordDefinitions } from '../../../api/hooks/definitions';
import { useCreateFinanceRecord } from '../../../api/hooks/finance';
import { useContactsByGroup } from '../../../api/hooks/records';
import { useUIStore } from '../../../stores/uiStore';
import { useFinanceStore } from '../../../stores/financeStore';
import { formatCurrency } from '@autoart/shared';
import { Button, Stack, TextInput, Select } from '@autoart/ui';
import { ContactPicker } from '@autoart/ui';
import { LineItemTable, type LineItem } from '../../composites/LineItemTable';

// Tax rate presets
const TAX_OPTIONS = [
  { label: 'No Tax', value: '0' },
  { label: '5% GST', value: '0.05' },
  { label: '13% HST (Ontario)', value: '0.13' },
  { label: '15% HST (Atlantic)', value: '0.15' },
];

export function CreateInvoiceView({
  onClose,
}: {
  onClose?: () => void;
  context?: Record<string, unknown>;
}) {
  const { closeOverlay } = useUIStore();
  const { setSelectedInvoiceId } = useFinanceStore();
  const { data: definitions = [] } = useRecordDefinitions();
  const invoiceDef = useMemo(
    () => definitions.find((d) => d.name === 'Invoice'),
    [definitions],
  );

  const createRecord = useCreateFinanceRecord();
  const { data: clients = [] } = useContactsByGroup('Developer/Client');

  // Header fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [clientId, setClientId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
  ]);

  // Tax rate
  const [taxRate, setTaxRate] = useState('0');

  // Computed totals
  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [lineItems],
  );
  const taxAmount = useMemo(() => subtotal * parseFloat(taxRate), [subtotal, taxRate]);
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const contactOptions = useMemo(
    () =>
      clients.map((c) => ({
        id: c.id,
        name: (c.data as Record<string, unknown>).name as string || c.unique_name,
        company: (c.data as Record<string, unknown>).company as string | undefined,
      })),
    [clients],
  );

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeOverlay();
  }, [onClose, closeOverlay]);

  // Validation: require invoice number and at least one line item with description
  const isValid = useMemo(() => {
    if (!invoiceNumber.trim()) return false;
    if (!invoiceDef) return false;
    const hasValidLineItem = lineItems.some((item) => item.description.trim() && item.quantity > 0);
    return hasValidLineItem;
  }, [invoiceNumber, invoiceDef, lineItems]);

  const handleCreate = useCallback(async () => {
    if (!isValid) return;

    const result = await createRecord.mutateAsync({
      definitionId: invoiceDef!.id,
      uniqueName: invoiceNumber,
      data: {
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate || null,
        currency,
        status: 'Draft',
        notes: notes || null,
        client_id: clientId,
        // Line items and totals
        line_items: lineItems
          .filter((item) => item.description.trim())
          .map(({ id, ...rest }) => rest), // strip internal id
        subtotal,
        tax_rate: parseFloat(taxRate),
        tax_amount: taxAmount,
        total,
      },
    });

    setSelectedInvoiceId(result.record.id);
    handleClose();
  }, [isValid, invoiceDef, invoiceNumber, issueDate, dueDate, currency, clientId, notes, lineItems, subtotal, taxRate, taxAmount, total, createRecord, setSelectedInvoiceId, handleClose]);

  return (
    <div className="p-6 max-h-[80vh] overflow-y-auto">
      <h2 className="text-base font-semibold text-[var(--ws-text-secondary,#5a5a57)] mb-4">New Invoice</h2>

      <Stack gap="md">
        {/* Header Fields */}
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="Invoice Number"
            required
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="INV-2026-001"
          />
          <ContactPicker
            label="Client"
            contacts={contactOptions}
            value={clientId}
            onChange={setClientId}
            placeholder="Select client"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <TextInput
            label="Issue Date"
            type="date"
            required
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <TextInput
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Select
            label="Currency"
            value={currency}
            onChange={(val) => setCurrency(val || 'CAD')}
            data={[
              { label: 'CAD', value: 'CAD' },
              { label: 'USD', value: 'USD' },
              { label: 'EUR', value: 'EUR' },
            ]}
          />
        </div>

        {/* Line Items Section */}
        <div>
          <label className="block text-sm font-medium text-[var(--ws-fg,#1e293b)] mb-2">
            Line Items <span className="text-[var(--ws-color-error,#8c4a4a)]">*</span>
          </label>
          <LineItemTable
            items={lineItems}
            onChange={setLineItems}
            currency={currency}
            disabled={createRecord.isPending}
          />
        </div>

        {/* Totals Section */}
        <div className="bg-[var(--ws-panel-bg,#f8fafc)] rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--ws-text-secondary,#5a5a57)]">Subtotal</span>
            <span className="font-mono">{formatCurrency({ amount: subtotal, currency })}</span>
          </div>
          <div className="flex justify-between items-center text-sm gap-4">
            <span className="text-[var(--ws-text-secondary,#5a5a57)]">Tax</span>
            <div className="flex items-center gap-2">
              <Select
                value={taxRate}
                onChange={(val) => setTaxRate(val || '0')}
                data={TAX_OPTIONS}
                size="sm"
              />
              <span className="font-mono w-24 text-right">
                {formatCurrency({ amount: taxAmount, currency })}
              </span>
            </div>
          </div>
          <div className="border-t border-[var(--ws-panel-border,#e2e8f0)] pt-2 flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono text-base">{formatCurrency({ amount: total, currency })}</span>
          </div>
        </div>

        {/* Notes */}
        <TextInput
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes for this invoice"
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!isValid || createRecord.isPending}
          >
            {createRecord.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
