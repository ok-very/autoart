/**
 * CreateExpenseView
 *
 * Overlay for recording a new Expense record.
 * Captures description, amount, currency, category, date, vendor, and receipt reference.
 */

import { useState, useMemo, useCallback } from 'react';

import { useRecordDefinitions } from '../../../api/hooks/definitions';
import { useCreateFinanceRecord } from '../../../api/hooks/finance';
import { useUIStore } from '../../../stores/uiStore';
import { Button, Stack, TextInput, Select } from '@autoart/ui';

const CATEGORY_OPTIONS = [
  { label: 'Materials', value: 'Materials' },
  { label: 'Labor', value: 'Labor' },
  { label: 'Travel', value: 'Travel' },
  { label: 'Equipment', value: 'Equipment' },
  { label: 'Supplies', value: 'Supplies' },
  { label: 'Services', value: 'Services' },
  { label: 'Other', value: 'Other' },
];

const CURRENCY_OPTIONS = [
  { label: 'CAD', value: 'CAD' },
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
];

export function CreateExpenseView({
  onClose,
}: {
  onClose?: () => void;
  context?: Record<string, unknown>;
}) {
  const { closeOverlay } = useUIStore();
  const { data: definitions = [] } = useRecordDefinitions();
  const expenseDef = useMemo(
    () => definitions.find((d) => d.name === 'Expense'),
    [definitions],
  );

  const createRecord = useCreateFinanceRecord();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [category, setCategory] = useState('Materials');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendor, setVendor] = useState('');
  const [receiptRef, setReceiptRef] = useState('');

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeOverlay();
  }, [onClose, closeOverlay]);

  const handleCreate = useCallback(async () => {
    if (!expenseDef || !description.trim() || !amount) return;

    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) return;

    await createRecord.mutateAsync({
      definitionId: expenseDef.id,
      uniqueName: description.trim(),
      data: {
        description: description.trim(),
        amount: { amount: cents, currency },
        category,
        expense_date: expenseDate || null,
        vendor: vendor.trim() || null,
        receipt_url: receiptRef.trim() || null,
      },
    });

    handleClose();
  }, [expenseDef, description, amount, currency, category, expenseDate, vendor, receiptRef, createRecord, handleClose]);

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-ws-text-secondary mb-4">Record Expense</h2>
      <Stack gap="md">
        <TextInput
          label="Description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this expense for"
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
          <Select
            label="Category"
            value={category}
            onChange={(val) => setCategory(val || 'Materials')}
            data={CATEGORY_OPTIONS}
          />
          <TextInput
            label="Expense Date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </div>
        <TextInput
          label="Vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Vendor name"
        />
        <TextInput
          label="Receipt Reference"
          value={receiptRef}
          onChange={(e) => setReceiptRef(e.target.value)}
          placeholder="URL or file reference"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!description.trim() || !amount || !expenseDef || createRecord.isPending}
          >
            {createRecord.isPending ? 'Recording...' : 'Record Expense'}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
