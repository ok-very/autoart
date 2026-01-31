/**
 * ReferencesManager - Semantic Component for managing action references
 *
 * Responsibilities:
 * - Fetches all references for an action
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
    Trash2,
} from 'lucide-react';

import {
    useActionReferences,
    useRemoveActionReference,
    type ActionReference,
} from '../../api/hooks/actionReferences';
import { useUIStore } from '../../stores/uiStore';

export interface ReferencesManagerProps {
    /** ID of the action to manage references for */
    actionId: string;
}

/**
 * ReferencesManager - Manage action references (links from actions to records)
 *
 * Shows:
 * - List of all references for an action
 * - Delete actions
 */
export function ReferencesManager({ actionId }: ReferencesManagerProps) {
    const { data: references, isLoading } = useActionReferences(actionId);

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
                    <span className="text-sm font-bold text-blue-900">Action References</span>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                    References link this action to record fields. Values are resolved dynamically
                    from the source record.
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
                    references.map((ref) => (
                        <ReferenceCard key={ref.id} reference={ref} actionId={actionId} />
                    ))
                )}
            </div>
        </div>
    );
}

interface ReferenceCardProps {
    reference: ActionReference;
    actionId: string;
}

function ReferenceCard({ reference, actionId }: ReferenceCardProps) {
    const removeReference = useRemoveActionReference();
    const { openOverlay } = useUIStore();

    const label = reference.source_record_id && reference.target_field_key
        ? `#${reference.source_record_id}:${reference.target_field_key}`
        : '#unknown:unknown';

    const canDelete = reference.source_record_id != null && reference.target_field_key != null;

    const handleDelete = () => {
        if (!canDelete) return;
        openOverlay('confirm-delete', {
            title: 'Delete Reference',
            message:
                'Are you sure you want to delete this reference? The link between this action and the source record will be removed.',
            itemName: label,
            onConfirm: async () => {
                await removeReference.mutateAsync({
                    actionId,
                    input: {
                        sourceRecordId: reference.source_record_id!,
                        targetFieldKey: reference.target_field_key!,
                    },
                });
            },
        });
    };

    return (
        <div className="border rounded-lg p-3 transition-all group border-slate-200 bg-white">
            {/* Reference Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Link2 size={14} className="text-blue-500 shrink-0" />
                    <code className="text-xs font-mono text-slate-700 truncate">{label}</code>
                </div>
                <div className="flex items-center gap-1">
                    <span className={clsx(
                        'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0',
                        'bg-blue-100 text-blue-700'
                    )}>
                        {reference.mode}
                    </span>
                    <button
                        onClick={handleDelete}
                        disabled={!canDelete}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={canDelete ? 'Delete reference' : 'Cannot delete: missing source or target'}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Current Value */}
            <div className="bg-slate-50 rounded p-2">
                <div className="text-[10px] text-slate-400 uppercase mb-1">Snapshot Value</div>
                <div className="text-sm text-slate-700 font-medium truncate">
                    {reference.snapshot_value !== undefined && reference.snapshot_value !== null ? (
                        typeof reference.snapshot_value === 'object' ? (
                            JSON.stringify(reference.snapshot_value)
                        ) : (
                            String(reference.snapshot_value)
                        )
                    ) : (
                        <span className="text-slate-400 italic">null</span>
                    )}
                </div>
            </div>
        </div>
    );
}
