/**
 * AllocateBudgetView
 *
 * Overlay for creating a new Budget allocation record.
 * Captures budget name, allocation type, amount, and currency.
 */

import { useState, useMemo, useCallback } from 'react';

import { useRecordDefinitions } from '../../../api/hooks/definitions';
import { useCreateFinanceRecord } from '../../../api/hooks/finance';
import { useUIStore } from '../../../stores/uiStore';
import { Button, Stack, TextInput, Select } from '@autoart/ui';

const ALLOCATION_TYPE_OPTIONS = [
  { label: 'Total', value: 'Total' },
  { label: 'Monthly', value: 'Monthly' },
  { label: 'Per Item', value: 'Per Item' },
  { label: 'Category', value: 'Category' },
];

const CURRENCY_OPTIONS = [
  { label: 'CAD', value: 'CAD' },
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
];

export function AllocateBudgetView({
  onClose,
}: {
  onClose?: () => void;
  context?: Record<string, unknown>;
}) {
  const { closeOverlay } = useUIStore();
  const { data: definitions = [] } = useRecordDefinitions();
  const budgetDef = useMemo(
    () => definitions.find((d) => d.name === 'Budget'),
    [definitions],
  );

  const createRecord = useCreateFinanceRecord();

  const [budgetName, setBudgetName] = useState('');
  const [allocationType, setAllocationType] = useState('Total');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeOverlay();
  }, [onClose, closeOverlay]);

  const handleCreate = useCallback(async () => {
    if (!budgetDef || !budgetName.trim() || !allocatedAmount) return;

    const cents = Math.round(parseFloat(allocatedAmount) * 100);
    if (isNaN(cents) || cents <= 0) return;

    await createRecord.mutateAsync({
      definitionId: budgetDef.id,
      uniqueName: budgetName.trim(),
      data: {
        name: budgetName.trim(),
        allocation_type: allocationType,
        allocated_amount: { amount: cents, currency },
        currency,
      },
    });

    handleClose();
  }, [budgetDef, budgetName, allocationType, allocatedAmount, currency, createRecord, handleClose]);

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-ws-text-secondary mb-4">Allocate Budget</h2>
      <Stack gap="md">
        <TextInput
          label="Budget Name"
          required
          value={budgetName}
          onChange={(e) => setBudgetName(e.target.value)}
          placeholder="e.g. Q1 Materials"
        />
        <Select
          label="Allocation Type"
          value={allocationType}
          onChange={(val) => setAllocationType(val || 'Total')}
          data={ALLOCATION_TYPE_OPTIONS}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="Allocated Amount"
            type="number"
            required
            value={allocatedAmount}
            onChange={(e) => setAllocatedAmount(e.target.value)}
            placeholder="0.00"
          />
          <Select
            label="Currency"
            value={currency}
            onChange={(val) => setCurrency(val || 'CAD')}
            data={CURRENCY_OPTIONS}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!budgetName.trim() || !allocatedAmount || !budgetDef || createRecord.isPending}
          >
            {createRecord.isPending ? 'Allocating...' : 'Allocate Budget'}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
