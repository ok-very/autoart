import { useMemo } from 'react';

import { useFinanceRecords } from '../../api/hooks/finance';
import { useRecordDefinitions } from '../../api/hooks/definitions';
import { formatCurrency } from '@autoart/shared';

interface KPI {
  label: string;
  value: string;
  sublabel?: string;
}

function extractCents(data: Record<string, unknown>, key: string): number {
  const val = data[key];
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'amount' in val) {
    return (val as { amount: number }).amount;
  }
  return 0;
}

export function FinanceKPIStrip() {
  const { data: definitions = [] } = useRecordDefinitions();

  const budgetDef = useMemo(() => definitions.find((d) => d.name === 'Budget'), [definitions]);
  const invoiceDef = useMemo(() => definitions.find((d) => d.name === 'Invoice'), [definitions]);
  const billDef = useMemo(() => definitions.find((d) => d.name === 'Vendor Bill'), [definitions]);

  const { data: budgets = [] } = useFinanceRecords({ definitionId: budgetDef?.id, resolve: true });
  const { data: invoices = [] } = useFinanceRecords({ definitionId: invoiceDef?.id, resolve: true });
  const { data: bills = [] } = useFinanceRecords({ definitionId: billDef?.id });

  const kpis = useMemo<KPI[]>(() => {
    const totalAllocated = budgets.reduce(
      (sum, r) => sum + extractCents(r.data as Record<string, unknown>, 'allocated_amount'),
      0,
    );
    const totalSpent = budgets.reduce(
      (sum, r) => sum + extractCents(r.data as Record<string, unknown>, 'spent_amount'),
      0,
    );

    // Outstanding A/R: invoices with status Sent or Overdue
    const outstandingAR = invoices
      .filter((r) => {
        const status = (r.data as Record<string, unknown>).status as string;
        return status === 'Sent' || status === 'Overdue';
      })
      .reduce((sum, r) => sum + extractCents(r.data as Record<string, unknown>, 'total'), 0);

    // Outstanding A/P: bills with status Received or Approved
    const outstandingAP = bills
      .filter((r) => {
        const status = (r.data as Record<string, unknown>).status as string;
        return status === 'Received' || status === 'Approved';
      })
      .reduce((sum, r) => sum + extractCents(r.data as Record<string, unknown>, 'amount'), 0);

    return [
      {
        label: 'Allocated',
        value: formatCurrency({ amount: totalAllocated, currency: 'CAD' }),
      },
      {
        label: 'Spent',
        value: formatCurrency({ amount: totalSpent, currency: 'CAD' }),
      },
      {
        label: 'Outstanding A/R',
        value: formatCurrency({ amount: outstandingAR, currency: 'CAD' }),
        sublabel: `${invoices.filter((r) => ['Sent', 'Overdue'].includes((r.data as Record<string, unknown>).status as string)).length} invoices`,
      },
      {
        label: 'Outstanding A/P',
        value: formatCurrency({ amount: outstandingAP, currency: 'CAD' }),
        sublabel: `${bills.filter((r) => ['Received', 'Approved'].includes((r.data as Record<string, unknown>).status as string)).length} bills`,
      },
    ];
  }, [budgets, invoices, bills]);

  return (
    <div className="grid grid-cols-4 gap-px bg-slate-200">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white px-4 py-3">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            {kpi.label}
          </div>
          <div className="text-base font-mono font-semibold text-slate-800 mt-0.5">
            {kpi.value}
          </div>
          {kpi.sublabel && (
            <div className="text-[10px] text-slate-400 mt-0.5">{kpi.sublabel}</div>
          )}
        </div>
      ))}
    </div>
  );
}
