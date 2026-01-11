/**
 * ReferencesManager - Semantic Component for managing task references
 *
 * Responsibilities:
 * - Fetches all references for a task
 * - Handles reference mode toggling (static/dynamic)
 * - Manages drift detection and sync operations
 * - Handles reference deletion
 *
 * Design Rules:
 * - Self-contained data fetching and persistence
 * - Uses bottom drawer for delete confirmations
 * - No external onChange - all updates go through API
 */

import { clsx } from 'clsx';
import {
    Link2,
    Unlink,
    AlertTriangle,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';

import {
    useTaskReferences,
    useResolveReference,
    useUpdateReferenceMode,
    useUpdateReferenceSnapshot,
    useDeleteReference,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { TaskReference } from '../../types';

export interface ReferencesManagerProps {
    /** ID of the task to manage references for */
    taskId: string;
}

/**
 * ReferencesManager - Manage task references (static/dynamic links to records)
 *
 * Shows:
 * - List of all references for a task
 * - Reference mode (static/dynamic) with toggle
 * - Drift detection for static references
 * - Edit/sync/delete actions
 */
export function ReferencesManager({ taskId }: ReferencesManagerProps) {
    const { data: references, isLoading } = useTaskReferences(taskId);

    if (isLoading) {
        return (
            <div className="fade-in flex items-center justify-center py-8">
                <div className="text-sm text-slate-400">Loading references...</div>
            </div>
        );
    }

    return (
        <div className="fade-in space-y-6">
            {/* Header Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Link2 size={16} className="text-blue-600" />
                    <span className="text-sm font-bold text-blue-900">Task References</span>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                    References link this task to record fields. Dynamic references update automatically;
                    static references preserve a snapshot.
                </p>
            </div>

            {/* References List */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">
                    Linked References ({references?.length || 0})
                </h4>

                {!references || references.length === 0 ? (
                    <div className="text-center py-6">
                        <div className="text-slate-300 mb-2">
                            <Link2 size={32} className="mx-auto" />
                        </div>
                        <p className="text-sm text-slate-400">No references yet</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Use <code className="bg-slate-100 px-1 rounded">#recordname:field</code> in the
                            description to create references
                        </p>
                    </div>
                ) : (
                    references.map((ref) => <ReferenceCard key={ref.id} reference={ref} />)
                )}
            </div>
        </div>
    );
}

interface ReferenceCardProps {
    reference: TaskReference;
}

function ReferenceCard({ reference }: ReferenceCardProps) {
    const { data: resolved, refetch, isFetching } = useResolveReference(reference.id);
    const updateMode = useUpdateReferenceMode();
    const updateSnapshot = useUpdateReferenceSnapshot();
    const deleteReference = useDeleteReference();
    const { openDrawer } = useUIStore();

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    const currentMode = resolved?.status ?? reference.mode ?? 'dynamic';
    const hasDrift = resolved?.drift ?? false;
    const displayValue = resolved?.value;
    const fallbackLabel =
        reference.source_record_id && reference.target_field_key
            ? `#${reference.source_record_id}:${reference.target_field_key}`
            : '#unknown:unknown';
    const label = resolved?.label ?? fallbackLabel;

    const handleToggleMode = async () => {
        const newMode = currentMode === 'static' ? 'dynamic' : 'static';
        try {
            await updateMode.mutateAsync({ id: reference.id, mode: newMode });
            refetch();
        } catch (err) {
            console.error('Failed to update reference mode:', err);
        }
    };

    const handleSyncToLive = async () => {
        if (!hasDrift) return;
        try {
            await updateMode.mutateAsync({ id: reference.id, mode: 'dynamic' });
            refetch();
        } catch (err) {
            console.error('Failed to sync reference:', err);
        }
    };

    const handleVerify = () => {
        refetch();
    };

    const handleDelete = () => {
        openDrawer('confirm-delete', {
            title: 'Delete Reference',
            message:
                'Are you sure you want to delete this reference? The link between this task and the source record will be removed.',
            itemName: label,
            onConfirm: async () => {
                await deleteReference.mutateAsync(reference.id);
            },
        });
    };

    const handleEditStart = () => {
        const val =
            displayValue !== undefined && displayValue !== null
                ? typeof displayValue === 'object'
                    ? JSON.stringify(displayValue)
                    : String(displayValue)
                : '';
        setEditValue(val);
        setIsEditing(true);
    };

    const handleSaveSnapshot = async () => {
        let val: unknown = editValue;
        try {
            if (editValue === 'true') val = true;
            else if (editValue === 'false') val = false;
            else if (!isNaN(Number(editValue)) && editValue.trim() !== '') val = Number(editValue);
            else val = JSON.parse(editValue);
        } catch {
            val = editValue;
        }

        await updateSnapshot.mutateAsync({ id: reference.id, value: val });
        setIsEditing(false);
    };

    return (
        <div
            className={clsx(
                'border rounded-lg p-3 transition-all group',
                hasDrift ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
            )}
        >
            {/* Reference Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    {currentMode === 'static' ? (
                        <Unlink size={14} className="text-orange-500 shrink-0" />
                    ) : (
                        <Link2 size={14} className="text-blue-500 shrink-0" />
                    )}
                    <code className="text-xs font-mono text-slate-700 truncate">{label}</code>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className={clsx(
                            'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0',
                            currentMode === 'static'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                        )}
                    >
                        {currentMode}
                    </span>
                    <button
                        onClick={handleDelete}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-red-50"
                        title="Delete reference"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Current Value */}
            <div className="bg-slate-50 rounded p-2 mb-2">
                <div className="flex justify-between items-center mb-1">
                    <div className="text-[10px] text-slate-400 uppercase">Current Value</div>
                    {currentMode === 'static' && !isEditing && (
                        <button
                            onClick={handleEditStart}
                            className="text-[10px] text-blue-500 hover:underline"
                        >
                            Edit
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 text-sm border rounded px-1 py-0.5"
                            autoFocus
                        />
                        <button
                            onClick={handleSaveSnapshot}
                            className="text-xs bg-blue-500 text-white px-2 rounded"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="text-xs bg-slate-200 text-slate-700 px-2 rounded"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="text-sm text-slate-700 font-medium truncate">
                        {displayValue !== undefined && displayValue !== null ? (
                            typeof displayValue === 'object' ? (
                                JSON.stringify(displayValue)
                            ) : (
                                String(displayValue)
                            )
                        ) : (
                            <span className="text-slate-400 italic">null</span>
                        )}
                    </div>
                )}
            </div>

            {/* Drift Warning */}
            {hasDrift && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-100 rounded p-2 mb-2">
                    <AlertTriangle size={14} />
                    <span className="text-xs">Value has drifted from live source</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                <button
                    onClick={handleToggleMode}
                    disabled={updateMode.isPending}
                    className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    {currentMode === 'static' ? (
                        <>
                            <Link2 size={12} />
                            Make Dynamic
                        </>
                    ) : (
                        <>
                            <Unlink size={12} />
                            Make Static
                        </>
                    )}
                </button>

                {currentMode === 'static' && !hasDrift && (
                    <button
                        onClick={handleVerify}
                        disabled={isFetching}
                        className="text-xs px-2 py-1.5 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
                        title="Check for drift"
                    >
                        <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                    </button>
                )}

                {hasDrift && (
                    <button
                        onClick={handleSyncToLive}
                        disabled={updateMode.isPending}
                        className="text-xs px-2 py-1.5 border border-amber-200 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50 flex items-center gap-1"
                    >
                        <RefreshCw size={12} />
                        Sync
                    </button>
                )}
            </div>
        </div>
    );
}
