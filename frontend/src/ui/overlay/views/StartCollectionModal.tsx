/**
 * StartCollectionModal
 *
 * Transient modal that prompts the user to start a new export collection.
 * Shown when user switches to "Aggregate" mode with no active collection.
 */

import { FolderPlus } from 'lucide-react';
import { useState } from 'react';

import { useCollectionStore } from '../../../stores';

interface StartCollectionModalProps {
    onClose: () => void;
    onSubmit?: () => void;
}

export function StartCollectionModal({ onClose, onSubmit }: StartCollectionModalProps) {
    const [name, setName] = useState('');
    const { createCollection, startCollecting } = useCollectionStore();

    const handleStart = () => {
        const collectionName = name.trim() || undefined;
        createCollection(collectionName);
        startCollecting();
        onSubmit?.();
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleStart();
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <FolderPlus size={24} className="text-amber-600" />
                </div>
                <div>
                    <h2 className="text-ws-h2 font-semibold text-ws-fg">Start New Collection</h2>
                    <p className="text-sm text-ws-text-secondary">
                        Create a collection to gather items for export
                    </p>
                </div>
            </div>

            {/* Name Input */}
            <div className="mb-6">
                <label className="block text-xs font-medium text-ws-text-secondary mb-2">
                    Collection Name <span className="text-ws-muted font-normal">(optional)</span>
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., Q1 Report Data"
                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    autoFocus
                />
            </div>

            {/* Info */}
            <div className="mb-6 p-3 bg-ws-bg rounded-lg border border-ws-panel-border">
                <p className="text-xs text-ws-text-secondary">
                    Once started, click on fields or records to add them to your collection.
                    Items will appear in the Export panel with <span className="text-amber-600 font-medium">amber highlighting</span>.
                </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-ws-text-secondary hover:text-ws-fg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleStart}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-2"
                >
                    <FolderPlus size={16} />
                    Start Collecting
                </button>
            </div>

            {/* Keyboard hint */}
            <div className="mt-4 pt-4 border-t border-ws-panel-border text-xs text-ws-muted text-center">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-ws-text-secondary">Enter</kbd> to start, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-ws-text-secondary">Esc</kbd> to cancel
            </div>
        </div>
    );
}
