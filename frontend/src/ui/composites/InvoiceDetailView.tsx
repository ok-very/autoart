import { clsx } from 'clsx';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { formatCurrency, renderFact, type BaseFactPayload, type Event } from '@autoart/shared';
import { Button } from '@autoart/ui';

import { useFinanceRecord, useLinkedRecords, useRecordEvents } from '../../api/hooks/finance';
import { useUpdateFinanceRecord } from '../../api/hooks/finance';
import { useFinanceStore } from '../../stores/financeStore';
import { useUIStore } from '../../stores/uiStore';
import type { DataRecord } from '../../types';
import { getEventFormatter } from '../projectLog/eventFormatters';
import { LineItemEditor } from './LineItemEditor';
import { ExportMenu } from './ExportMenu';
import { InvoicePreviewView } from './InvoicePreviewView';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-amber-100 text-amber-700',
  Void: 'bg-red-100 text-red-700',
};

/**
 * Format timestamp as relative time for the history section.
 */
function formatRelativeTime(dateValue: string | Date): string {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Renders the history timeline for an invoice record.
 * Shows FACT_RECORDED events that reference this record's ID.
 * Displays nothing when empty (silence is a feature).
 */
function InvoiceHistorySection({ record }: { record: DataRecord }) {
  const { data: events, isLoading } = useRecordEvents(record);

  if (isLoading) {
    return (
      <section>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          History
        </h3>
        <div className="flex items-center gap-2 py-3">
          <Loader2 size={14} className="text-slate-400 animate-spin" />
          <span className="text-xs text-slate-400">Loading history...</span>
        </div>
      </section>
    );
  }

  // Empty: show nothing (design system: silence is a feature)
  if (!events || events.length === 0) return null;

  return (
    <section>
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
        History
      </h3>
      <div className="space-y-0">
        {events.map((event: Event) => {
          const payload = event.payload as Record<string, unknown>;
          const formatter = getEventFormatter(event.type, payload);
          const Icon = formatter.icon;

          let narrative: string | null = null;
          try {
            narrative = renderFact(payload as BaseFactPayload);
          } catch {
            narrative = formatter.summarize(payload);
          }

          const occurredAt = event.occurredAt instanceof Date
            ? event.occurredAt
            : String(event.occurredAt);

          return (
            <div
              key={event.id}
              className="flex items-start gap-2.5 py-2 first:pt-0"
            >
              <div
                className={clsx(
                  'shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center',
                  formatter.dotBgClass,
                )}
              >
                <Icon size={12} className={formatter.dotTextClass} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-600">
                  {narrative || formatter.label}
                </span>
              </div>
              <span className="shrink-0 text-xs text-slate-400 ml-auto">
                {formatRelativeTime(occurredAt)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function InvoiceDetailView() {
  const { selectedInvoiceId, setSelectedInvoiceId } = useFinanceStore();
  const openOverlay = useUIStore((s) => s.openOverlay);

  const { data: invoiceResult, isLoading } = useFinanceRecord(selectedInvoiceId);
  const { data: lineItems = [] } = useLinkedRecords(selectedInvoiceId, 'line_item');
  const { data: payments = [] } = useLinkedRecords(selectedInvoiceId, 'payment');

  const updateMutation = useUpdateFinanceRecord();
  const [showPreview, setShowPreview] = useState(false);

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

  if (showPreview) {
    return <InvoicePreviewView invoiceId={selectedInvoiceId} onClose={() => setShowPreview(false)} />;
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
              {invoiceData?.due_date ? ` \u00B7 Due ${invoiceData.due_date as string}` : null}
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
            <ExportMenu
              invoiceId={selectedInvoiceId}
              invoiceNumber={(invoiceData?.invoice_number as string) || invoice.unique_name}
              onPreview={() => setShowPreview(true)}
            />
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
                const amountCents = typeof amt === 'object' && amt !== null ? amt.amount : (amt as number) ?? 0;
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
        {invoiceData?.notes ? (
          <section>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Notes
            </h3>
            <p className="text-sm text-slate-600">{invoiceData.notes as string}</p>
          </section>
        ) : null}

        {/* History */}
        <InvoiceHistorySection record={invoice} />
      </div>
    </div>
  );
}
