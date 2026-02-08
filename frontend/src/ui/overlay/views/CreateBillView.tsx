/**
 * CreateBillView
 *
 * Overlay for creating a new Vendor Bill record.
 * Captures vendor, bill number, amount, currency, due date, status, and category.
 */

import { useState, useMemo, useCallback } from 'react';

import { useRecordDefinitions } from '../../../api/hooks/definitions';
import { useCreateFinanceRecord } from '../../../api/hooks/finance';
import { useUIStore } from '../../../stores/uiStore';
import { Button, Stack, TextInput, Select } from '@autoart/ui';

const STATUS_OPTIONS = [
  { label: 'Received', value: 'Received' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Disputed', value: 'Disputed' },
];

const CURRENCY_OPTIONS = [
  { label: 'CAD', value: 'CAD' },
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
];

export function CreateBillView({
  onClose,
}: {
  onClose?: () => void;
  context?: Record<string, unknown>;
}) {
  const { closeOverlay } = useUIStore();
  const { data: definitions = [] } = useRecordDefinitions();
  const billDef = useMemo(
    () => definitions.find((d) => d.name === 'Vendor Bill'),
    [definitions],
  );

  const createRecord = useCreateFinanceRecord();

  const [vendorName, setVendorName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('Received');
  const [category, setCategory] = useState('');

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeOverlay();
  }, [onClose, closeOverlay]);

  const handleCreate = useCallback(async () => {
    if (!billDef || !vendorName.trim() || !billNumber.trim() || !amount) return;

    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) return;

    await createRecord.mutateAsync({
      definitionId: billDef.id,
      uniqueName: billNumber.trim(),
      data: {
        vendor: vendorName.trim(),
        bill_number: billNumber.trim(),
        amount: { amount: cents, currency },
        currency,
        due_date: dueDate || null,
        status,
        category: category.trim() || null,
      },
    });

    handleClose();
  }, [billDef, vendorName, billNumber, amount, currency, dueDate, status, category, createRecord, handleClose]);

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-ws-text-secondary mb-4">New Vendor Bill</h2>
      <Stack gap="md">
        <TextInput
          label="Vendor"
          required
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="Vendor name"
        />
        <TextInput
          label="Bill Number"
          required
          value={billNumber}
          onChange={(e) => setBillNumber(e.target.value)}
          placeholder="BILL-001"
        />
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="Amount"
            type="number"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <Select
            label="Currency"
            value={currency}
            onChange={(val) => setCurrency(val || 'CAD')}
            data={CURRENCY_OPTIONS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(val) => setStatus(val || 'Received')}
            data={STATUS_OPTIONS}
          />
        </div>
        <TextInput
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Materials, Framing"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!vendorName.trim() || !billNumber.trim() || !amount || !billDef || createRecord.isPending}
          >
            {createRecord.isPending ? 'Creating...' : 'Create Bill'}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
