/**
 * CreateInvoiceView
 *
 * Overlay for creating a new Invoice record.
 * Pre-fills project context, offers client picker and currency selector.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { useRecordDefinitions } from '../../../api/hooks/definitions';
import { useCreateFinanceRecord } from '../../../api/hooks/finance';
import { useContactsByGroup } from '../../../api/hooks/records';
import { useUIStore } from '../../../stores/uiStore';
import { useFinanceStore } from '../../../stores/financeStore';
import { api } from '../../../api/client';
import { Button, Stack, TextInput, Select } from '@autoart/ui';
import { ContactPicker } from '@autoart/ui';

interface InvoiceNumberValidation {
  valid: boolean;
  formatValid: boolean;
  conflicts: string[];
  suggestion?: string;
}

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
  const { data: clients = [], isPending: isLoadingClients } = useContactsByGroup('Developer/Client');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [clientId, setClientId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Invoice number validation (version counter prevents stale responses)
  const [validationStatus, setValidationStatus] = useState<{ valid: boolean; message?: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validationVersionRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = invoiceNumber.trim();
    if (!trimmed) {
      setValidationStatus(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    const version = ++validationVersionRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await api.post<InvoiceNumberValidation>(
          '/records/validate-invoice-number',
          { invoiceNumber: trimmed },
        );
        // Discard stale responses
        if (version !== validationVersionRef.current) return;
        setValidationStatus({
          valid: result.valid,
          message: result.valid
            ? 'Available'
            : result.conflicts.length > 0
              ? 'Invoice number already exists'
              : result.suggestion
                ? `Invalid format. Try: ${result.suggestion}`
                : 'Invalid invoice number format',
        });
      } catch {
        if (version !== validationVersionRef.current) return;
        // Validation endpoint unavailable; allow submission
        setValidationStatus(null);
      } finally {
        if (version === validationVersionRef.current) {
          setIsValidating(false);
        }
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [invoiceNumber]);

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

  const handleCreate = useCallback(async () => {
    if (!invoiceDef || !invoiceNumber.trim()) return;

    const result = await createRecord.mutateAsync({
      definitionId: invoiceDef.id,
      uniqueName: invoiceNumber,
      data: {
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate || null,
        currency,
        status: 'Draft',
        notes: notes || null,
        client_id: clientId,
      },
    });

    setSelectedInvoiceId(result.record.id);
    handleClose();
  }, [invoiceDef, invoiceNumber, issueDate, dueDate, currency, clientId, notes, createRecord, setSelectedInvoiceId, handleClose]);

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-ws-text-secondary mb-4">New Invoice</h2>
      <Stack gap="md">
        <div>
          <TextInput
            label="Invoice Number"
            required
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="INV-001"
          />
          {invoiceNumber.trim() && (
            <div className="mt-1 text-xs">
              {isValidating ? (
                <span className="text-ws-muted">Checking...</span>
              ) : validationStatus ? (
                <span className={validationStatus.valid ? 'text-green-600' : 'text-red-600'}>
                  {validationStatus.message}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <ContactPicker
          label="Client"
          contacts={contactOptions}
          value={clientId}
          onChange={setClientId}
          placeholder="Select client"
          isLoading={isLoadingClients}
        />
        <div className="grid grid-cols-2 gap-4">
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
        </div>
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
            onClick={handleCreate}
            disabled={!invoiceNumber.trim() || !invoiceDef || createRecord.isPending || isValidating || (validationStatus !== null && !validationStatus.valid)}
          >
            {createRecord.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
