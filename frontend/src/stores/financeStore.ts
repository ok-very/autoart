import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FinanceTab = 'invoices' | 'budgets' | 'bills' | 'expenses';

interface FinanceFilters {
  status?: string;
  definitionId?: string;
  clientContactId?: string;
  dateRange?: { from?: string; to?: string };
}

interface FinanceState {
  // Selection
  selectedInvoiceId: string | null;
  selectedBillId: string | null;

  // Filters (persisted)
  filters: FinanceFilters;

  // Navigation (persisted)
  financeTab: FinanceTab;

  // Defaults (persisted)
  lastPaymentMethod: string | null;

  // Actions
  setSelectedInvoiceId: (id: string | null) => void;
  setSelectedBillId: (id: string | null) => void;
  setFilters: (filters: Partial<FinanceFilters>) => void;
  clearFilters: () => void;
  setFinanceTab: (tab: FinanceTab) => void;
  setLastPaymentMethod: (method: string) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      selectedInvoiceId: null,
      selectedBillId: null,
      filters: {},
      financeTab: 'invoices',
      lastPaymentMethod: null,

      setSelectedInvoiceId: (id) => set({ selectedInvoiceId: id }),
      setSelectedBillId: (id) => set({ selectedBillId: id }),
      setFilters: (partial) =>
        set((state) => ({ filters: { ...state.filters, ...partial } })),
      clearFilters: () => set({ filters: {} }),
      setFinanceTab: (tab) => set({ financeTab: tab }),
      setLastPaymentMethod: (method) => set({ lastPaymentMethod: method }),
    }),
    {
      name: 'finance-store',
      version: 1,
      partialize: (state) => ({
        filters: state.filters,
        financeTab: state.financeTab,
        lastPaymentMethod: state.lastPaymentMethod,
      }),
    },
  ),
);
