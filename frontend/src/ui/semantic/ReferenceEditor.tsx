/**
 * ReferenceEditor - Semantic Component for record links and references
 *
 * Responsibilities:
 * - Fetches reference/link status
 * - Handles creation and deletion of links
 * - Renders the UI state (resolved, broken, empty)
 */

import { clsx } from 'clsx';
import { Link2, X, ExternalLink, RefreshCw } from 'lucide-react';
import { useState, useRef, useCallback, useMemo } from 'react';

import {
    useAddActionReference,
    useRemoveActionReference,
} from '../../api/hooks/actionReferences';
import {
    useRecord,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { SearchResult } from '../../types';
import { RecordSearchCombobox } from '../editor/RecordSearchCombobox';

export interface ReferenceEditorProps {
    /** The reference value — a record ID for direct links */
    value: string;
    /** The field key for this link field */
    fieldKey: string;
    /** The Action ID this field belongs to (for action references) */
    actionId?: string;
    /** The Record ID this field belongs to (for direct links) */
    currentRecordId?: string;
    /** Callback when the field value changes (record ID or empty) */
    onChange: (value: string) => void;
    /** Whether the field is read-only */
    readOnly?: boolean;
    /** Optional: constrain to specific record type */
    targetDefinitionId?: string;
}

export function ReferenceEditor({
    value,
    fieldKey,
    actionId,
    currentRecordId: _currentRecordId,
    onChange,
    readOnly = false,
    targetDefinitionId,
}: ReferenceEditorProps) {
    const [showSearch, setShowSearch] = useState(false);
    const [searchPosition, setSearchPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const { inspectRecord } = useUIStore();
    const addActionRef = useAddActionReference();
    const removeActionRef = useRemoveActionReference();

    // Resolve the target record directly
    const { data: targetRecord, isLoading } = useRecord(value || null);

    // Unified resolved data
    const resolved = useMemo(() => {
        if (!targetRecord) return null;
        const hasSource = targetRecord.id != null;
        return {
            value: targetRecord.unique_name,
            label: targetRecord.unique_name,
            sourceRecordId: targetRecord.id,
            status: hasSource ? 'dynamic' as const : 'unresolved' as const,
            drift: false,
        };
    }, [targetRecord]);

    const handleOpenSearch = useCallback(() => {
        if (readOnly) return;
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setSearchPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
            });
        }
        setShowSearch(true);
    }, [readOnly]);

    const handleSelect = useCallback(
        async (item: SearchResult, selectedFieldKey?: string) => {
            setShowSearch(false);

            try {
                if (actionId) {
                    // Create via action references API
                    await addActionRef.mutateAsync({
                        actionId,
                        input: {
                            sourceRecordId: item.id,
                            targetFieldKey: selectedFieldKey || fieldKey,
                        },
                    });
                }
                // Store the record ID as the value
                onChange(item.id);
            } catch (err) {
                console.error('Failed to create link:', err);
            }
        },
        [actionId, fieldKey, onChange, addActionRef]
    );

    const handleClear = useCallback(async () => {
        if (!value) return;

        try {
            if (actionId) {
                await removeActionRef.mutateAsync({
                    actionId,
                    input: {
                        sourceRecordId: value,
                        targetFieldKey: fieldKey,
                    },
                });
            }
            onChange('');
        } catch (err) {
            console.error('Failed to remove link:', err);
        }
    }, [value, onChange, actionId, fieldKey, removeActionRef]);

    const handleOpenRecord = useCallback(() => {
        if (resolved?.sourceRecordId) {
            inspectRecord(resolved.sourceRecordId);
        }
    }, [resolved, inspectRecord]);

    // No link yet - show button to add one
    if (!value) {
        return (
            <div className="relative">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={handleOpenSearch}
                    disabled={readOnly}
                    className={clsx(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors text-left',
                        readOnly
                            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                            : 'border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-slate-500 hover:text-blue-600 cursor-pointer'
                    )}
                >
                    <Link2 size={14} />
                    <span>Link a record...</span>
                </button>

                {showSearch && (
                    <RecordSearchCombobox
                        triggerChar="#"
                        position={searchPosition}
                        onSelect={handleSelect}
                        onClose={() => setShowSearch(false)}
                        definitionId={targetDefinitionId}
                        showFieldSelection={false}
                    />
                )}
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-50">
                <RefreshCw size={14} className="animate-spin text-slate-400" />
                <span className="text-slate-400">Loading...</span>
            </div>
        );
    }

    // Has a link - show the resolved value
    return (
        <div
            className={clsx(
                'group flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors',
                'border-blue-200 bg-blue-50'
            )}
        >
            <Link2 size={14} className="text-blue-500 shrink-0" />

            {/* Clickable value that opens record */}
            <button
                type="button"
                onClick={handleOpenRecord}
                className="flex-1 text-left text-blue-700 hover:text-blue-900 hover:underline font-medium truncate"
                title={`Open ${resolved?.label || 'record'}`}
            >
                {resolved?.value !== undefined && resolved?.value !== null
                    ? String(resolved.value)
                    : resolved?.label || 'Unknown'}
            </button>

            {/* Mode indicator */}
            <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded shrink-0 bg-green-100 text-green-700">
                dynamic
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                    type="button"
                    onClick={handleOpenRecord}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="Open record"
                >
                    <ExternalLink size={12} />
                </button>

                {!readOnly && (
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={removeActionRef.isPending}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                        title="Remove link"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}
