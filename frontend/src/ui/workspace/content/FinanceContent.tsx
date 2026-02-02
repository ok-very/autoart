/**
 * FinanceContent
 *
 * Content adapter for the finance workspace surface.
 * Routes between InvoiceListView/InvoiceDetailView based on selection,
 * with tab navigation for Invoices/Budgets/Expenses.
 */

import { useFinanceStore } from '../../../stores/financeStore';
import { SegmentedControl } from '@autoart/ui';
import { FinanceKPIStrip } from '../../composites/FinanceKPIStrip';
import { InvoiceListView } from '../../composites/InvoiceListView';
import { InvoiceDetailView } from '../../composites/InvoiceDetailView';
import { BudgetView } from '../../composites/BudgetView';
import { BillsListView } from '../../composites/BillsListView';
import { ExpenseListView } from '../../composites/ExpenseListView';
import type { FinanceTab } from '../../../stores/financeStore';

const TAB_OPTIONS = [
  { value: 'invoices', label: 'Invoices' },
  { value: 'budgets', label: 'Budgets' },
  { value: 'bills', label: 'Bills' },
  { value: 'expenses', label: 'Expenses' },
] as const;

export function FinanceContent() {
  const { financeTab, setFinanceTab, selectedInvoiceId } = useFinanceStore();

  return (
    <div className="h-full flex flex-col bg-ws-panel-bg">
      {/* KPI strip — visible on list views only */}
      {!selectedInvoiceId && (
        <div className="shrink-0 border-b border-ws-panel-border">
          <FinanceKPIStrip />
        </div>
      )}

      {/* Tab bar */}
      {!selectedInvoiceId && (
        <div className="shrink-0 px-4 py-2 border-b border-ws-panel-border bg-ws-bg">
          <SegmentedControl
            data={TAB_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
            value={financeTab}
            onChange={(val) => setFinanceTab(val as FinanceTab)}
            size="sm"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {financeTab === 'invoices' && (
          selectedInvoiceId ? <InvoiceDetailView /> : <InvoiceListView />
        )}
        {financeTab === 'budgets' && <BudgetView />}
        {financeTab === 'bills' && <BillsListView />}
        {financeTab === 'expenses' && <ExpenseListView />}
      </div>
    </div>
  );
}
