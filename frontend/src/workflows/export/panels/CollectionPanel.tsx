/**
 * Collection Panel
 * 
 * Left sidebar panel for managing collections in the Export Workbench.
 * Shows only the list of collections - controls are in center panel.
 */

import { Plus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';

import { useCollectionStore, type Collection } from '../../../stores';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollectionPanel() {
    const {
        collections,
        activeCollectionId,
        createCollection,
        deleteCollection,
        setActiveCollection,
    } = useCollectionStore();

    const handleCreateCollection = useCallback(() => {
        createCollection();
    }, [createCollection]);

    const handleDeleteCollection = useCallback((id: string) => {
        deleteCollection(id);
    }, [deleteCollection]);

    const collectionsList = Array.from(collections.values());

    return (
        <div className="flex flex-col h-full bg-ws-panel-bg">
            {/* Header */}
            <div className="p-3 border-b border-ws-panel-border bg-ws-bg">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ws-text-secondary uppercase tracking-wider">
                        Collections
                    </span>
                    <button
                        onClick={handleCreateCollection}
                        className="p-1 rounded hover:bg-slate-200 text-ws-text-secondary hover:text-ws-text-secondary transition-colors"
                        title="New collection"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Collections List */}
            <div className="flex-1 overflow-y-auto">
                {collectionsList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-ws-muted">
                        No collections yet. Click + to create one.
                    </div>
                ) : (
                    collectionsList.map((collection) => (
                        <CollectionListItem
                            key={collection.id}
                            collection={collection}
                            isActive={collection.id === activeCollectionId}
                            onClick={() => setActiveCollection(collection.id)}
                            onDelete={() => handleDeleteCollection(collection.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Collection List Item
// ---------------------------------------------------------------------------

interface CollectionListItemProps {
    collection: Collection;
    isActive: boolean;
    onClick: () => void;
    onDelete: () => void;
}

function CollectionListItem({ collection, isActive, onClick, onDelete }: CollectionListItemProps) {
    return (
        <div
            onClick={onClick}
            className={`
                group px-3 py-2 cursor-pointer flex items-center justify-between
                ${isActive
                    ? 'bg-emerald-50 border-l-2 border-l-emerald-500'
                    : 'hover:bg-ws-bg border-l-2 border-l-transparent'
                }
            `}
        >
            <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium truncate ${isActive ? 'text-emerald-800' : 'text-ws-text-secondary'}`}>
                    {collection.name}
                </div>
                <div className="text-[10px] text-ws-muted">
                    {collection.selections.length} items
                </div>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-ws-muted hover:text-red-500 transition-all"
                title="Delete collection"
            >
                <Trash2 size={12} />
            </button>
        </div>
    );
}
