/**
 * Import Workbench Store
 *
 * Zustand store for Import Workbench state.
 * Manages session, plan, and selection state.
 */

import { create } from 'zustand';
import type { ImportSession, ImportPlan } from '../api/hooks/imports';

interface ImportWorkbenchState {
    // Session state
    session: ImportSession | null;
    plan: ImportPlan | null;

    // Selection state
    selectedItemId: string | null;

    // Actions
    setSession: (session: ImportSession | null) => void;
    setPlan: (plan: ImportPlan | null) => void;
    setSelectedItemId: (id: string | null) => void;
    reset: () => void;
}

export const useImportWorkbenchStore = create<ImportWorkbenchState>((set) => ({
    // Initial state
    session: null,
    plan: null,
    selectedItemId: null,

    // Actions
    setSession: (session) => set({ session }),
    setPlan: (plan) => set({ plan }),
    setSelectedItemId: (selectedItemId) => set({ selectedItemId }),
    reset: () => set({ session: null, plan: null, selectedItemId: null }),
}));
