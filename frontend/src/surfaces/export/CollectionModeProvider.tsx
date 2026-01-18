/**
 * Collection Mode Provider
 * 
 * Context provider that manages collection mode state and provides
 * callbacks for adding/removing items from the active collection.
 * Wraps the app to enable interactive selection across panels.
 */

import { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { useCollectionStore, type SelectionReference } from '../../stores';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectionModeContextValue {
    isCollecting: boolean;
    addToCollection: (ref: Omit<SelectionReference, 'id'>) => void;
    removeFromCollection: (selectionId: string) => void;
    isInCollection: (sourceId: string, fieldKey?: string) => boolean;
    selectionCount: number;
    startCollecting: () => void;
    stopCollecting: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CollectionModeContext = createContext<CollectionModeContextValue | null>(null);

export function useCollectionMode() {
    const ctx = useContext(CollectionModeContext);
    if (!ctx) {
        throw new Error('useCollectionMode must be used within CollectionModeProvider');
    }
    return ctx;
}

// Safe hook that doesn't throw - for optional usage
export function useCollectionModeOptional() {
    return useContext(CollectionModeContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface CollectionModeProviderProps {
    children: ReactNode;
}

export function CollectionModeProvider({ children }: CollectionModeProviderProps) {
    const store = useCollectionStore();

    const {
        isCollecting,
        addToCollection: storeAdd,
        removeFromCollection: storeRemove,
        isInCollection: storeIsIn,
        getSelectionCount,
        startCollecting,
        stopCollecting,
    } = store;

    // Escape key to exit collection mode
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && isCollecting) {
                stopCollecting();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCollecting, stopCollecting]);

    const addToCollection = useCallback(
        (ref: Omit<SelectionReference, 'id'>) => {
            storeAdd(ref);
        },
        [storeAdd]
    );

    const removeFromCollection = useCallback(
        (selectionId: string) => {
            storeRemove(selectionId);
        },
        [storeRemove]
    );

    const isInCollection = useCallback(
        (sourceId: string, fieldKey?: string) => {
            return storeIsIn(sourceId, fieldKey);
        },
        [storeIsIn]
    );

    const value: CollectionModeContextValue = {
        isCollecting,
        addToCollection,
        removeFromCollection,
        isInCollection,
        selectionCount: getSelectionCount(),
        startCollecting,
        stopCollecting,
    };

    return (
        <CollectionModeContext.Provider value={value}>
            {children}
        </CollectionModeContext.Provider>
    );
}
