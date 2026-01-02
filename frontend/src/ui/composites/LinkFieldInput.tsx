/**
 * LinkFieldInput - Composite for linking records via references
 * 
 * This is a composite because it:
 * - Uses API hooks (useResolveReference, useCreateReference, etc.)
 * - Accesses stores (useUIStore)
 * - Manages complex async state
 */

import { useState, useRef, useCallback } from 'react';
import { Link2, X, ExternalLink, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { RecordSearchCombobox } from '../../components/common/RecordSearchCombobox';
import {
    useResolveReference,
    useCreateReference,
    useDeleteReference,
    useRecord,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { SearchResult } from '../../types';

export interface LinkFieldInputProps {
    /** The reference ID if a link exists, or empty string if not */
    value: string;
    /** The field key for this link field */
    fieldKey: string;
    /** The task ID this field belongs to (Required for References) */
    taskId?: string;
    /** The Record ID this field belongs to (Required for Direct Links) */
    currentRecordId?: string;
    /** Callback when the field value changes (reference ID or empty) */
    onChange: (value: string) => void;
    /** Whether the field is read-only */
    readOnly: boolean;
    /** Optional: constrain to specific record type */
    targetDefinitionId?: string;
}

export function LinkFieldInput({
    value,
    fieldKey,
    taskId,
    currentRecordId: _currentRecordId, // Reserved for excluding current record from search
    onChange,
    readOnly,
    targetDefinitionId,
}: LinkFieldInputProps) {
    const [showSearch, setShowSearch] = useState(false);
    const [searchPosition, setSearchPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const { openDrawer } = useUIStore();
    const createReference = useCreateReference();
    const deleteReference = useDeleteReference();

    // Determine mode
    const isReferenceMode = !!taskId;

    // Reference Mode: Resolve the reference ID
    const { data: resolvedRef, isLoading: isLoadingRef } = useResolveReference(
        isReferenceMode && value ? value : null
    );

    // Direct Link Mode: Resolve the target record ID directly
    const { data: targetRecord, isLoading: isLoadingRecord } = useRecord(
        !isReferenceMode && value ? value : null
    );

    // Unified resolved data
    const resolved = isReferenceMode
        ? resolvedRef
        : targetRecord
            ? {
                value: targetRecord.unique_name,
                label: targetRecord.unique_name,
                sourceRecordId: targetRecord.id,
                status: 'dynamic' as const,
                drift: false,
            }
            : null;

    const isLoading = isReferenceMode ? isLoadingRef : isLoadingRecord;

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
                if (isReferenceMode && taskId) {
                    // Create a reference to this record (Task -> Record)
                    const result = await createReference.mutateAsync({
                        taskId,
                        sourceRecordId: item.id,
                        targetFieldKey: selectedFieldKey || fieldKey,
                        mode: 'dynamic',
                    });
                    onChange(result.reference.id);
                } else {
                    // Direct Link (Record -> Record) - just store the ID
                    onChange(item.id);
                }
            } catch (err) {
                console.error('Failed to create link:', err);
            }
        },
        [taskId, fieldKey, onChange, createReference, isReferenceMode]
    );

    const handleClear = useCallback(async () => {
        if (!value) return;

        try {
            if (isReferenceMode) {
                await deleteReference.mutateAsync(value);
            }
            onChange('');
        } catch (err) {
            console.error('Failed to remove link:', err);
        }
    }, [value, onChange, deleteReference, isReferenceMode]);

    const handleOpenRecord = useCallback(() => {
        if (resolved?.sourceRecordId) {
            // Open record in bottom drawer for editing
            openDrawer('view-record', { recordId: resolved.sourceRecordId });
        }
    }, [resolved, openDrawer]);

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
                resolved?.drift
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-blue-200 bg-blue-50'
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
            <span
                className={clsx(
                    'text-[10px] font-medium uppercase px-1.5 py-0.5 rounded shrink-0',
                    resolved?.status === 'static'
                        ? 'bg-amber-100 text-amber-700'
                        : resolved?.status === 'broken'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                )}
            >
                {resolved?.status || 'dynamic'}
            </span>

            {/* Drift indicator */}
            {resolved?.drift && (
                <span
                    className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 shrink-0"
                    title="Value has changed from snapshot"
                >
                    Drift
                </span>
            )}

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
                        disabled={deleteReference.isPending}
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
