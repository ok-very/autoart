import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { useFinanceRecords } from '../../api/hooks/finance';
import { useRecordDefinitions } from '../../api/hooks/definitions';
import { useUIStore } from '../../stores/uiStore';
import { formatCurrency } from '@autoart/shared';
import { Button } from '@autoart/ui';

interface BudgetRow {
  id: string;
  name: string;
  allocationType: string;
  allocated: number; // cents
  spent: number; // cents (rollup)
  remaining: number; // cents (computed)
  currency: string;
}

function parseBudgetRow(record: { id: string; data: Record<string, unknown>; unique_name: string }): BudgetRow {
  const data = record.data as Record<string, unknown>;
  const allocated = extractCents(data.allocated_amount);
  const spent = (data.spent_amount as number) ?? 0;
  const remaining = (data.remaining as number) ?? allocated - spent;

  return {
    id: record.id,
    name: (data.name as string) || record.unique_name,
    allocationType: (data.allocation_type as string) || 'Total',
    allocated,
    spent,
    remaining,
    currency: 'CAD',
  };
}

function extractCents(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'amount' in val) {
    return (val as { amount: number }).amount;
  }
  return 0;
}

function utilizationPercent(spent: number, allocated: number): number {
  if (allocated <= 0) return 0;
  return Math.min(100, Math.round((spent / allocated) * 100));
}

export function BudgetView() {
  const openOverlay = useUIStore((s) => s.openOverlay);
  const { data: definitions = [] } = useRecordDefinitions();
  const budgetDef = useMemo(
    () => definitions.find((d) => d.name === 'Budget'),
    [definitions],
  );

  const { data: records = [], isLoading } = useFinanceRecords({
    definitionId: budgetDef?.id,
    resolve: true,
  });

  const budgets = useMemo(() => records.map(parseBudgetRow), [records]);

  const totals = useMemo(() => {
    const allocated = budgets.reduce((sum, b) => sum + b.allocated, 0);
    const spent = budgets.reduce((sum, b) => sum + b.spent, 0);
    return { allocated, spent, remaining: allocated - spent };
  }, [budgets]);

  const handleAllocate = useCallback(
    () => openOverlay('allocate-budget', {}),
    [openOverlay],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Budgets</h2>
          <span className="text-xs text-slate-400">{budgets.length}</span>
        </div>
        <Button variant="primary" size="sm" leftSection={<Plus size={14} />} onClick={handleAllocate}>
          Allocate
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No budget allocations</div>
        ) : (
          <div className="p-4 space-y-2">
            {budgets.map((budget) => {
              const pct = utilizationPercent(budget.spent, budget.allocated);
              const isOver = budget.remaining < 0;
              return (
                <div
                  key={budget.id}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        {budget.name}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {budget.allocationType}
                      </span>
                    </div>
                    <span className={clsx(
                      'text-xs font-medium',
                      isOver ? 'text-red-600' : 'text-slate-500',
                    )}>
                      {pct}% used
                    </span>
                  </div>

                  {/* Utilization bar */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        isOver ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400',
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Allocated</span>
                      <p className="font-mono text-slate-700 mt-0.5">
                        {formatCurrency({ amount: budget.allocated, currency: budget.currency })}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Spent</span>
                      <p className="font-mono text-slate-700 mt-0.5">
                        {formatCurrency({ amount: budget.spent, currency: budget.currency })}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Remaining</span>
                      <p className={clsx(
                        'font-mono mt-0.5',
                        isOver ? 'text-red-600' : 'text-slate-700',
                      )}>
                        {formatCurrency({ amount: budget.remaining, currency: budget.currency })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Total row */}
            <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
              <div className="text-xs font-medium text-slate-500 mb-2">Project Total</div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Allocated</span>
                  <p className="font-mono text-slate-900 font-semibold mt-0.5">
                    {formatCurrency({ amount: totals.allocated, currency: 'CAD' })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Spent</span>
                  <p className="font-mono text-slate-900 font-semibold mt-0.5">
                    {formatCurrency({ amount: totals.spent, currency: 'CAD' })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Remaining</span>
                  <p className={clsx(
                    'font-mono font-semibold mt-0.5',
                    totals.remaining < 0 ? 'text-red-600' : 'text-slate-900',
                  )}>
                    {formatCurrency({ amount: totals.remaining, currency: 'CAD' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
