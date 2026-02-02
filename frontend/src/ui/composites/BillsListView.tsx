import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { useFinanceRecords } from '../../api/hooks/finance';
import { useRecordDefinitions } from '../../api/hooks/definitions';
import { useFinanceStore } from '../../stores/financeStore';
import { useUIStore } from '../../stores/uiStore';
import { formatCurrency } from '@autoart/shared';
import { Button } from '@autoart/ui';

interface BillRow {
  id: string;
  billNumber: string;
  vendor: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  category: string;
}

function parseBillRow(record: { id: string; unique_name: string; data: Record<string, unknown> }): BillRow {
  const data = record.data as Record<string, unknown>;
  const amt = data.amount as { amount: number; currency: string } | number | undefined;
  return {
    id: record.id,
    billNumber: (data.bill_number as string) || record.unique_name,
    vendor: '',
    amount: typeof amt === 'object' && amt !== null ? amt.amount : (amt as number) ?? 0,
    currency: typeof amt === 'object' && amt !== null ? amt.currency : 'CAD',
    status: (data.status as string) || 'Received',
    dueDate: (data.due_date as string) || '',
    category: (data.category as string) || '',
  };
}

const STATUS_COLORS: Record<string, string> = {
  Received: 'bg-slate-100 text-ws-text-secondary',
  Approved: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Disputed: 'bg-red-100 text-red-700',
};

export function BillsListView() {
  const { setSelectedBillId } = useFinanceStore();
  const openOverlay = useUIStore((s) => s.openOverlay);
  const { data: definitions = [] } = useRecordDefinitions();
  const billDef = useMemo(
    () => definitions.find((d) => d.name === 'Vendor Bill'),
    [definitions],
  );

  const { data: records = [], isLoading } = useFinanceRecords({
    definitionId: billDef?.id,
  });

  const bills = useMemo(() => records.map(parseBillRow), [records]);

  const handleRowClick = useCallback(
    (id: string) => setSelectedBillId(id),
    [setSelectedBillId],
  );

  return (
    <div className="flex flex-col h-full">
      <header className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-ws-panel-border bg-ws-panel-bg">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ws-text-secondary">Vendor Bills</h2>
          <span className="text-xs text-ws-muted">{bills.length}</span>
        </div>
        <Button variant="primary" size="sm" leftSection={<Plus size={14} />} onClick={() => openOverlay('create-bill', {})}>
          New Bill
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-ws-muted">Loading bills...</div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center text-sm text-ws-muted">No vendor bills</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ws-panel-border text-left">
                <th className="px-4 py-2 font-medium text-ws-text-secondary text-xs">Bill #</th>
                <th className="px-4 py-2 font-medium text-ws-text-secondary text-xs">Category</th>
                <th className="px-4 py-2 font-medium text-ws-text-secondary text-xs">Due Date</th>
                <th className="px-4 py-2 font-medium text-ws-text-secondary text-xs text-right">Amount</th>
                <th className="px-4 py-2 font-medium text-ws-text-secondary text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr
                  key={bill.id}
                  onClick={() => handleRowClick(bill.id)}
                  className="border-b border-slate-50 hover:bg-ws-bg cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-ws-text-secondary">{bill.billNumber}</td>
                  <td className="px-4 py-2.5 text-ws-text-secondary">{bill.category}</td>
                  <td className="px-4 py-2.5 text-ws-text-secondary">{bill.dueDate}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-ws-text-secondary">
                    {formatCurrency({ amount: bill.amount, currency: bill.currency })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={clsx(
                      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                      STATUS_COLORS[bill.status] || 'bg-slate-100 text-ws-text-secondary',
                    )}>
                      {bill.status}
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
