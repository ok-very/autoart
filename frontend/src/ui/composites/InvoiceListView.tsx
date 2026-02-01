import { clsx } from 'clsx';
import { Plus, Filter } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { useFinanceRecords } from '../../api/hooks/finance';
import { useRecordDefinitions } from '../../api/hooks/definitions';
import { useFinanceStore } from '../../stores/financeStore';
import { useUIStore } from '../../stores/uiStore';
import { formatCurrency } from '@autoart/shared';
import { Button } from '@autoart/ui';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  total: number | null;
  currency: string;
  status: string;
  dueDate: string;
  issueDate: string;
}

function parseInvoiceRow(record: { id: string; unique_name: string; data: Record<string, unknown>; _computed?: Record<string, unknown> }): InvoiceRow {
  const data = record.data as Record<string, unknown>;
  const computed = (record as any)._computed as Record<string, unknown> | undefined;
  return {
    id: record.id,
    invoiceNumber: (data.invoice_number as string) || record.unique_name,
    clientName: '', // resolved from linked Contact in detail view
    total: (computed?.total as number) ?? (data.total as number) ?? null,
    currency: (data.currency as string) || 'CAD',
    status: (data.status as string) || 'Draft',
    dueDate: (data.due_date as string) || '',
    issueDate: (data.issue_date as string) || '',
  };
}

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-amber-100 text-amber-700',
  Void: 'bg-red-100 text-red-700',
};

export function InvoiceListView() {
  const { filters, setSelectedInvoiceId } = useFinanceStore();
  const openOverlay = useUIStore((s) => s.openOverlay);

  const { data: definitions = [] } = useRecordDefinitions();
  const invoiceDef = useMemo(
    () => definitions.find((d) => d.name === 'Invoice'),
    [definitions],
  );

  const { data: records = [], isLoading } = useFinanceRecords({
    definitionId: invoiceDef?.id,
    resolve: true,
  });

  const invoices = useMemo(
    () => records.map(parseInvoiceRow),
    [records],
  );

  // Apply client-side status filter
  const filteredInvoices = useMemo(() => {
    if (!filters.status) return invoices;
    return invoices.filter((inv) => inv.status === filters.status);
  }, [invoices, filters.status]);

  const handleRowClick = useCallback(
    (id: string) => setSelectedInvoiceId(id),
    [setSelectedInvoiceId],
  );

  const handleCreate = useCallback(
    () => openOverlay('create-invoice', {}),
    [openOverlay],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <header className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Invoices</h2>
          <span className="text-xs text-slate-400">
            {filteredInvoices.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftSection={<Filter size={14} />}>
            Filter
          </Button>
          <Button variant="primary" size="sm" leftSection={<Plus size={14} />} onClick={handleCreate}>
            New Invoice
          </Button>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No invoices</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-2 font-medium text-slate-500 text-xs">Number</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs">Issue Date</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs">Due Date</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs text-right">Total</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => handleRowClick(inv.id)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {inv.issueDate}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {inv.dueDate}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {inv.total !== null
                      ? formatCurrency({ amount: inv.total, currency: inv.currency })
                      : '\u2014'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={clsx(
                      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                      STATUS_COLORS[inv.status] || 'bg-slate-100 text-slate-600',
                    )}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
