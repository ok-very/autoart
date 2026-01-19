/**
 * Collection Store
 *
 * Zustand store for Export Workbench Collection System.
 * Manages collections of selected data across panels for export.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '@autoart/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SelectionType = 'record' | 'field' | 'node' | 'action' | 'event' | 'artist';

export interface SelectionReference {
    id: string;
    type: SelectionType;
    sourceId: string;           // Record ID, Node ID, etc.
    fieldKey?: string;          // For field-level selections
    displayLabel: string;       // Human-readable label
    value?: unknown;            // Cached value at selection time
}

export type TemplatePreset = 'bfa_rtf' | 'csv' | 'google_docs' | 'custom';

export interface Collection {
    id: string;
    name: string;
    templatePreset: TemplatePreset;
    selections: SelectionReference[];
    createdAt: string;
    updatedAt: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CollectionState {
    // State
    collections: Map<string, Collection>;
    activeCollectionId: string | null;
    isCollecting: boolean;

    // Derived getters
    // Derived getters (removed from state to prevent stale access)
    // Use deriveActiveCollection(state) or explicit lookups instead

    // Collection management
    createCollection: (name?: string) => string;
    deleteCollection: (id: string) => void;
    setActiveCollection: (id: string | null) => void;
    renameCollection: (id: string, name: string) => void;
    setTemplatePreset: (id: string, preset: TemplatePreset) => void;

    // Selection mode
    startCollecting: () => void;
    stopCollecting: () => void;
    toggleCollecting: () => void;

    // Selection management
    addToCollection: (ref: Omit<SelectionReference, 'id'>) => void;
    removeFromCollection: (selectionId: string) => void;
    reorderSelections: (startIndex: number, endIndex: number) => void;
    clearSelections: () => void;

    // Utilities
    isInCollection: (sourceId: string, fieldKey?: string) => boolean;
    getSelectionCount: () => number;
}

export const useCollectionStore = create<CollectionState>()(
    persist(
        (set, get) => ({
            collections: new Map(),
            activeCollectionId: null,
            isCollecting: false,

            createCollection: (name) => {
                const id = generateId();
                const now = new Date().toISOString();
                const collection: Collection = {
                    id,
                    name: name || `Collection ${get().collections.size + 1}`,
                    templatePreset: 'bfa_rtf',
                    selections: [],
                    createdAt: now,
                    updatedAt: now,
                };
                set((state) => {
                    const next = new Map(state.collections);
                    next.set(id, collection);
                    return { collections: next, activeCollectionId: id };
                });
                return id;
            },

            deleteCollection: (id) =>
                set((state) => {
                    const next = new Map(state.collections);
                    next.delete(id);
                    return {
                        collections: next,
                        activeCollectionId: state.activeCollectionId === id ? null : state.activeCollectionId,
                        isCollecting: state.activeCollectionId === id ? false : state.isCollecting,
                    };
                }),

            setActiveCollection: (id) =>
                set({ activeCollectionId: id, isCollecting: false }),

            renameCollection: (id, name) =>
                set((state) => {
                    const collection = state.collections.get(id);
                    if (!collection) return state;
                    const next = new Map(state.collections);
                    next.set(id, { ...collection, name, updatedAt: new Date().toISOString() });
                    return { collections: next };
                }),

            setTemplatePreset: (id, preset) =>
                set((state) => {
                    const collection = state.collections.get(id);
                    if (!collection) return state;
                    const next = new Map(state.collections);
                    next.set(id, { ...collection, templatePreset: preset, updatedAt: new Date().toISOString() });
                    return { collections: next };
                }),

            startCollecting: () =>
                set((state) => {
                    // If no active collection, create one
                    if (!state.activeCollectionId) {
                        const id = get().createCollection();
                        return { isCollecting: true, activeCollectionId: id };
                    }
                    return { isCollecting: true };
                }),

            stopCollecting: () => set({ isCollecting: false }),

            toggleCollecting: () =>
                set((state) => {
                    if (state.isCollecting) {
                        return { isCollecting: false };
                    }
                    // If no active collection, create one
                    if (!state.activeCollectionId) {
                        const id = get().createCollection();
                        return { isCollecting: true, activeCollectionId: id };
                    }
                    return { isCollecting: true };
                }),

            addToCollection: (ref) =>
                set((state) => {
                    const collection = state.activeCollectionId
                        ? state.collections.get(state.activeCollectionId)
                        : null;
                    if (!collection) return state;

                    // Check for duplicates
                    const exists = collection.selections.some(
                        (s) => s.sourceId === ref.sourceId && s.fieldKey === ref.fieldKey
                    );
                    if (exists) return state;

                    const selection: SelectionReference = { ...ref, id: generateId() };
                    const next = new Map(state.collections);
                    next.set(collection.id, {
                        ...collection,
                        selections: [...collection.selections, selection],
                        updatedAt: new Date().toISOString(),
                    });
                    return { collections: next };
                }),

            removeFromCollection: (selectionId) =>
                set((state) => {
                    const collection = state.activeCollectionId
                        ? state.collections.get(state.activeCollectionId)
                        : null;
                    if (!collection) return state;

                    const next = new Map(state.collections);
                    next.set(collection.id, {
                        ...collection,
                        selections: collection.selections.filter((s) => s.id !== selectionId),
                        updatedAt: new Date().toISOString(),
                    });
                    return { collections: next };
                }),

            reorderSelections: (startIndex, endIndex) =>
                set((state) => {
                    const collection = state.activeCollectionId
                        ? state.collections.get(state.activeCollectionId)
                        : null;
                    if (!collection) return state;

                    const selections = [...collection.selections];
                    const [removed] = selections.splice(startIndex, 1);
                    selections.splice(endIndex, 0, removed);

                    const next = new Map(state.collections);
                    next.set(collection.id, {
                        ...collection,
                        selections,
                        updatedAt: new Date().toISOString(),
                    });
                    return { collections: next };
                }),

            clearSelections: () =>
                set((state) => {
                    const collection = state.activeCollectionId
                        ? state.collections.get(state.activeCollectionId)
                        : null;
                    if (!collection) return state;

                    const next = new Map(state.collections);
                    next.set(collection.id, {
                        ...collection,
                        selections: [],
                        updatedAt: new Date().toISOString(),
                    });
                    return { collections: next };
                }),

            isInCollection: (sourceId, fieldKey) => {
                const { activeCollectionId, collections } = get();
                const collection = activeCollectionId ? collections.get(activeCollectionId) : null;
                if (!collection) return false;
                return collection.selections.some(
                    (s) => s.sourceId === sourceId && (fieldKey === undefined || s.fieldKey === fieldKey)
                );
            },

            getSelectionCount: () => {
                const { activeCollectionId, collections } = get();
                const collection = activeCollectionId ? collections.get(activeCollectionId) : null;
                return collection?.selections.length ?? 0;
            },
        }),
        {
            name: 'collection-storage',
            version: 1,
            partialize: (state) => ({
                collections: Array.from(state.collections.entries()),
                activeCollectionId: state.activeCollectionId,
            }),
            // Rehydrate Map from array
            merge: (persistedState, currentState) => {
                const persisted = persistedState as any;
                return {
                    ...currentState,
                    collections: new Map(persisted?.collections ?? []),
                    activeCollectionId: persisted?.activeCollectionId ?? null,
                };
            },
        }
    )
);
