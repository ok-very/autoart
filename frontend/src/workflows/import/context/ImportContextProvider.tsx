/**
 * Import Context Provider
 *
 * Provides shared state for all import-related panels:
 * - ImportPreview (wizard step 5)
 * - SelectionInspector (when viewing import_item)
 * - ClassificationPanel
 *
 * This enables panel coordination - when you select an item in ImportPreview,
 * the SelectionInspector updates; when ClassificationPanel resolves items,
 * the plan updates everywhere.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { ImportSession, ImportPlan } from '../../api/hooks/imports';

export interface ImportContextValue {
    // Session & Plan
    session: ImportSession | null;
    plan: ImportPlan | null;

    // Selection
    selectedItemId: string | null;
    selectItem: (itemId: string | null) => void;

    // Plan mutations
    updatePlan: (plan: ImportPlan) => void;

    // Tab state (for inspector)
    inspectorTab: string;
    setInspectorTab: (tab: string) => void;
}

const ImportContext = createContext<ImportContextValue | null>(null);

/**
 * Hook to access import context. Throws if not within provider.
 */
export function useImportContext(): ImportContextValue {
    const ctx = useContext(ImportContext);
    if (!ctx) {
        throw new Error('useImportContext must be used within ImportContextProvider');
    }
    return ctx;
}

/**
 * Optional hook - returns null if not within provider.
 * Use this in components that may or may not be in import context.
 */
export function useImportContextOptional(): ImportContextValue | null {
    return useContext(ImportContext);
}

interface ImportContextProviderProps {
    children: ReactNode;
    value: ImportContextValue;
}

export function ImportContextProvider({ children, value }: ImportContextProviderProps) {
    return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>;
}
