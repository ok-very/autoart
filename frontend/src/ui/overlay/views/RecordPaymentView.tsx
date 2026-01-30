/**
 * RecordPaymentView
 *
 * Overlay for recording a payment against an invoice.
 * Creates a Payment record and links it to the invoice.
 */

import { useState, useMemo, useCallback } from 'react';

import { useRecordDefinitions } from '../../../api/hooks/definitions';
import { useCreateFinanceRecord, useCreateFinanceLink, useUpdateFinanceRecord } from '../../../api/hooks/finance';
import { useUIStore } from '../../../stores/uiStore';
import { useFinanceStore } from '../../../stores/financeStore';
import { Button, Stack, TextInput, Select } from '@autoart/ui';
import { CurrencyInput } from '@autoart/ui';

export function RecordPaymentView({
  onClose,
  context,
}: {
  onClose?: () => void;
  context?: { invoiceId?: string; currency?: string };
}) {
  const { closeOverlay } = useUIStore();
  const { lastPaymentMethod, setLastPaymentMethod } = useFinanceStore();
  const { data: definitions = [] } = useRecordDefinitions();
  const paymentDef = useMemo(
    () => definitions.find((d) => d.name === 'Payment'),
    [definitions],
  );

  const createRecord = useCreateFinanceRecord();
  const createLink = useCreateFinanceLink();
  const updateInvoice = useUpdateFinanceRecord();

  const invoiceId = context?.invoiceId;
  const currency = context?.currency || 'CAD';

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState(lastPaymentMethod || 'Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [direction, setDirection] = useState('Incoming');
  const [notes, setNotes] = useState('');

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeOverlay();
  }, [onClose, closeOverlay]);

  const handleSubmit = useCallback(async () => {
    if (!paymentDef || amount <= 0) return;

    setLastPaymentMethod(method);

    const result = await createRecord.mutateAsync({
      definitionId: paymentDef.id,
      uniqueName: `Payment ${paymentDate} ${referenceNumber || ''}`.trim(),
      data: {
        payment_date: paymentDate,
        amount: { amount, currency },
        method,
        reference_number: referenceNumber || null,
        direction,
        notes: notes || null,
      },
    });

    // Link payment to invoice
    if (invoiceId) {
      await createLink.mutateAsync({
        sourceRecordId: invoiceId,
        targetRecordId: result.record.id,
        linkType: 'payment',
      });
    }

    handleClose();
  }, [paymentDef, amount, currency, paymentDate, method, referenceNumber, direction, notes, invoiceId, createRecord, createLink, setLastPaymentMethod, handleClose]);

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-slate-700 mb-4">Record Payment</h2>
      <Stack gap="md">
        <CurrencyInput
          label="Amount"
          required
          value={amount}
          currency={currency}
          onChange={setAmount}
        />
        <TextInput
          label="Payment Date"
          type="date"
          required
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
        <Select
          label="Method"
          value={method}
          onChange={(val) => setMethod(val || 'Bank Transfer')}
          data={[
            { label: 'Bank Transfer', value: 'Bank Transfer' },
            { label: 'Cheque', value: 'Cheque' },
            { label: 'Credit Card', value: 'Credit Card' },
            { label: 'Cash', value: 'Cash' },
            { label: 'Other', value: 'Other' },
          ]}
        />
        <Select
          label="Direction"
          value={direction}
          onChange={(val) => setDirection(val || 'Incoming')}
          data={[
            { label: 'Incoming', value: 'Incoming' },
            { label: 'Outgoing', value: 'Outgoing' },
          ]}
        />
        <TextInput
          label="Reference Number"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="e.g. CHQ-1234"
        />
        <TextInput
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={amount <= 0 || !paymentDef || createRecord.isPending}
          >
            {createRecord.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
