/**
 * Collection Panel
 * 
 * Sidebar panel for managing collections in the Export Workbench.
 * Shows list of collections, active collection selections, and controls.
 */

import { Plus, Trash2, Play, Square, FolderOpen } from 'lucide-react';
import { useCallback } from 'react';

import { useCollectionStore, type Collection } from '../../stores';
import { CollectionItemCard } from './CollectionItemCard';
import { TemplatePresetSelector } from './TemplatePresetSelector';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollectionPanel() {
    const {
        collections,
        activeCollectionId,
        activeCollection,
        isCollecting,
        createCollection,
        deleteCollection,
        setActiveCollection,
        removeFromCollection,
        startCollecting,
        stopCollecting,
        setTemplatePreset,
    } = useCollectionStore();

    const handleCreateCollection = useCallback(() => {
        createCollection();
    }, [createCollection]);

    const handleDeleteCollection = useCallback((id: string) => {
        deleteCollection(id);
    }, [deleteCollection]);

    const collectionsList = Array.from(collections.values());

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-3 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Collections
                    </span>
                    <button
                        onClick={handleCreateCollection}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                        title="New collection"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Collections List */}
            <div className="flex-shrink-0 max-h-40 overflow-y-auto border-b border-slate-200">
                {collectionsList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                        No collections yet
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

            {/* Active Collection Content */}
            {activeCollection ? (
                <>
                    {/* Collection Header */}
                    <div className="p-3 border-b border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <input
                                type="text"
                                value={activeCollection.name}
                                className="text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-none"
                                readOnly
                            />
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                {activeCollection.selections.length} items
                            </span>
                        </div>

                        {/* Template Selector */}
                        <TemplatePresetSelector
                            value={activeCollection.templatePreset}
                            onChange={(preset) => setTemplatePreset(activeCollection.id, preset)}
                        />
                    </div>

                    {/* Collection Mode Toggle */}
                    <div className="p-3 border-b border-slate-100">
                        <button
                            onClick={isCollecting ? stopCollecting : startCollecting}
                            className={`
                w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isCollecting
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                }
              `}
                        >
                            {isCollecting ? (
                                <>
                                    <Square size={14} />
                                    Stop Collecting
                                </>
                            ) : (
                                <>
                                    <Play size={14} />
                                    Start Collecting
                                </>
                            )}
                        </button>
                        {isCollecting && (
                            <p className="mt-2 text-[10px] text-amber-600 text-center">
                                Click items in panels to add them. Press Escape to stop.
                            </p>
                        )}
                    </div>

                    {/* Selected Items */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {activeCollection.selections.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-center">
                                <div>
                                    <FolderOpen size={32} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-xs text-slate-400">
                                        No items in collection
                                    </p>
                                    <p className="text-[10px] text-slate-300 mt-1">
                                        Click "Start Collecting" to add items
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeCollection.selections.map((item) => (
                                    <CollectionItemCard
                                        key={item.id}
                                        item={item}
                                        onRemove={removeFromCollection}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-center p-4">
                    <div>
                        <FolderOpen size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs text-slate-400">
                            Create or select a collection
                        </p>
                    </div>
                </div>
            )}
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
                    : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                }
      `}
        >
            <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium truncate ${isActive ? 'text-emerald-800' : 'text-slate-700'}`}>
                    {collection.name}
                </div>
                <div className="text-[10px] text-slate-400">
                    {collection.selections.length} items
                </div>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                title="Delete collection"
            >
                <Trash2 size={12} />
            </button>
        </div>
    );
}
