import { Plus, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

import { useFinanceRecords } from '../../api/hooks/finance';
import { useRecordDefinitions } from '../../api/hooks/definitions';
import { formatCurrency } from '@autoart/shared';
import { Button } from '@autoart/ui';

interface ExpenseRow {
  id: string;
  description: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  receiptUrl: string | null;
}

function parseExpenseRow(record: { id: string; unique_name: string; data: Record<string, unknown> }): ExpenseRow {
  const data = record.data as Record<string, unknown>;
  const amt = data.amount as { amount: number; currency: string } | number | undefined;
  return {
    id: record.id,
    description: (data.description as string) || record.unique_name,
    date: (data.expense_date as string) || '',
    amount: typeof amt === 'object' && amt !== null ? amt.amount : (amt as number) ?? 0,
    currency: typeof amt === 'object' && amt !== null ? amt.currency : 'CAD',
    category: (data.category as string) || '',
    receiptUrl: (data.receipt_url as string) || null,
  };
}

export function ExpenseListView() {
  const { data: definitions = [] } = useRecordDefinitions();
  const expenseDef = useMemo(
    () => definitions.find((d) => d.name === 'Expense'),
    [definitions],
  );

  const { data: records = [], isLoading } = useFinanceRecords({
    definitionId: expenseDef?.id,
  });

  const expenses = useMemo(() => records.map(parseExpenseRow), [records]);

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  return (
    <div className="flex flex-col h-full">
      <header className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Expenses</h2>
          <span className="text-xs text-slate-400">{expenses.length}</span>
          {expenses.length > 0 && (
            <span className="text-xs font-mono text-slate-500 ml-2">
              Total: {formatCurrency({ amount: total, currency: 'CAD' })}
            </span>
          )}
        </div>
        <Button variant="primary" size="sm" leftSection={<Plus size={14} />}>
          Record Expense
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No expenses recorded</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-2 font-medium text-slate-500 text-xs">Description</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs">Date</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs">Category</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs text-right">Amount</th>
                <th className="px-4 py-2 font-medium text-slate-500 text-xs w-16">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-slate-700">{expense.description}</td>
                  <td className="px-4 py-2.5 text-slate-600">{expense.date}</td>
                  <td className="px-4 py-2.5 text-slate-600">{expense.category}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {formatCurrency({ amount: expense.amount, currency: expense.currency })}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {expense.receiptUrl && (
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
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
