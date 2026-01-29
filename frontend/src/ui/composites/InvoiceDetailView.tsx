import { clsx } from 'clsx';
import { ArrowLeft, Download, CreditCard } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { useFinanceRecord, useLinkedRecords } from '../../api/hooks/finance';
import { useUpdateFinanceRecord } from '../../api/hooks/finance';
import { useFinanceStore } from '../../stores/financeStore';
import { useUIStore } from '../../stores/uiStore';
import { formatCurrency } from '@autoart/shared';
import { Button, Badge } from '@autoart/ui';
import { LineItemEditor } from './LineItemEditor';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-amber-100 text-amber-700',
  Void: 'bg-red-100 text-red-700',
};

export function InvoiceDetailView() {
  const { selectedInvoiceId, setSelectedInvoiceId } = useFinanceStore();
  const openOverlay = useUIStore((s) => s.openOverlay);

  const { data: invoiceResult, isLoading } = useFinanceRecord(selectedInvoiceId);
  const { data: lineItems = [] } = useLinkedRecords(selectedInvoiceId, 'line_item');
  const { data: payments = [] } = useLinkedRecords(selectedInvoiceId, 'payment');

  const updateMutation = useUpdateFinanceRecord();

  const invoice = invoiceResult?.record;
  const computed = invoiceResult?._computed;
  const invoiceData = invoice?.data as Record<string, unknown> | undefined;

  const currency = (invoiceData?.currency as string) || 'CAD';
  const subtotal = (computed?.subtotal as number) ?? 0;
  const taxTotal = (computed?.tax_total as number) ?? 0;
  const total = (computed?.total as number) ?? 0;
  const status = (invoiceData?.status as string) || 'Draft';

  const handleBack = useCallback(
    () => setSelectedInvoiceId(null),
    [setSelectedInvoiceId],
  );

  const handleMarkPaid = useCallback(() => {
    if (!selectedInvoiceId) return;
    openOverlay('record-payment', { invoiceId: selectedInvoiceId, currency });
  }, [selectedInvoiceId, currency, openOverlay]);

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!selectedInvoiceId || !invoiceData) return;
      updateMutation.mutate({
        id: selectedInvoiceId,
        data: { ...invoiceData, status: newStatus },
      });
    },
    [selectedInvoiceId, invoiceData, updateMutation],
  );

  if (!selectedInvoiceId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Loading invoice...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-slate-400">Invoice not found</p>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700">
                {(invoiceData?.invoice_number as string) || invoice.unique_name}
              </h2>
              <span className={clsx(
                'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                STATUS_COLORS[status] || 'bg-slate-100 text-slate-600',
              )}>
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Issued {(invoiceData?.issue_date as string) || '\u2014'}
              {invoiceData?.due_date && ` \u00B7 Due ${invoiceData.due_date as string}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status === 'Draft' && (
              <Button variant="secondary" size="sm" onClick={() => handleStatusChange('Sent')}>
                Mark Sent
              </Button>
            )}
            {(status === 'Sent' || status === 'Overdue') && (
              <Button variant="primary" size="sm" leftSection={<CreditCard size={14} />} onClick={handleMarkPaid}>
                Record Payment
              </Button>
            )}
            <Button variant="ghost" size="sm" leftSection={<Download size={14} />}>
              PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Line Items */}
        <section>
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Line Items
          </h3>
          <LineItemEditor
            invoiceId={selectedInvoiceId}
            lineItems={lineItems}
            currency={currency}
          />
        </section>

        {/* Totals */}
        <section className="max-w-sm ml-auto">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex justify-between px-4 py-2 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono text-slate-700">
                {formatCurrency({ amount: subtotal, currency })}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2 text-sm border-t border-slate-100">
              <span className="text-slate-500">Tax</span>
              <span className="font-mono text-slate-700">
                {formatCurrency({ amount: taxTotal, currency })}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-sm font-semibold border-t border-slate-200 bg-slate-50">
              <span className="text-slate-700">Total</span>
              <span className="font-mono text-slate-900">
                {formatCurrency({ amount: total, currency })}
              </span>
            </div>
          </div>
        </section>

        {/* Payments */}
        {payments.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Payments
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {payments.map((payment) => {
                const pd = payment.data as Record<string, unknown>;
                const amt = pd.amount as { amount: number; currency: string } | number;
                const amountCents = typeof amt === 'object' ? amt.amount : (amt as number) ?? 0;
                return (
                  <div key={payment.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 last:border-0 text-sm">
                    <div>
                      <span className="text-slate-700">
                        {(pd.payment_date as string) || '\u2014'}
                      </span>
                      <span className="text-slate-400 ml-2">
                        {(pd.method as string) || ''}
                      </span>
                    </div>
                    <span className="font-mono text-slate-700">
                      {formatCurrency({ amount: amountCents, currency })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Notes */}
        {invoiceData?.notes && (
          <section>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Notes
            </h3>
            <p className="text-sm text-slate-600">{invoiceData.notes as string}</p>
          </section>
        )}
      </div>
    </div>
  );
}
