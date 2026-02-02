/**
 * RecordPropertiesView - Composite for viewing/editing record properties
 *
 * This composite follows the Semantic UI pattern:
 * - For RECORDS: Uses FieldEditor semantic component (domain-aware, self-persisting)
 * - For NODES: Uses NodeFieldEditor semantic component (same pattern)
 * - Description field handled separately (RichTextEditor with debounced save)
 *
 * All CRUD logic is delegated to semantic components - this composite only
 * handles layout and orchestration.
 */

import { Trash2, History } from 'lucide-react';
import { useRef, useMemo, useState, useEffect } from 'react';

import {
    useNode,
    useRecordDefinitions,
    useUpdateNode,
    useDeleteRecord,
    useRecordHistory,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { NodeType, HierarchyNode } from '../../types';
import { RichTextEditor } from '../editor/RichTextEditor';
import { FieldEditor } from '../semantic/FieldEditor';
import { NodeFieldEditor } from '../semantic/NodeFieldEditor';
import { useRecordFieldViewModels } from './hooks/useDomain';

interface RecordPropertiesViewProps {
    itemId: string;
    isNode: boolean;
}

/**
 * RecordPropertiesView - Displays and edits record/node properties
 *
 * For records: Uses FieldEditor semantic component
 * For nodes: Uses NodeFieldEditor semantic component
 */
export function RecordPropertiesView({ itemId, isNode }: RecordPropertiesViewProps) {
    const { clearInspection, openOverlay } = useUIStore();
    const { data: node } = useNode(isNode ? itemId : null);
    const updateNode = useUpdateNode();
    const deleteRecord = useDeleteRecord();
    const { data: definitions } = useRecordDefinitions();

    // For records: use domain hook
    const {
        visibleViewModels,
        record,
        isLoading: recordLoading,
    } = useRecordFieldViewModels(!isNode ? itemId : null);

    const { data: history } = useRecordHistory(!isNode ? itemId : null);
    const [showHistory, setShowHistory] = useState(false);
    const historyRef = useRef<HTMLDivElement>(null);

    // Close history when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        }
        if (showHistory) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHistory]);

    const descriptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // For nodes: compute the list of field keys to render
    // Must be before early returns to comply with hooks rules
    const nodeFieldKeys = useMemo(() => {
        if (!isNode || !node) return [];

        // Parse metadata
        const rawMetadata = node.metadata || {};
        const metadata: Record<string, unknown> =
            typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;

        // Find the definition for this node type
        const nodeTypeName = node.type.charAt(0).toUpperCase() + node.type.slice(1);
        const definition = definitions?.find((d) => {
            if ((node as HierarchyNode).default_record_def_id) {
                return d.id === (node as HierarchyNode).default_record_def_id;
            }
            return d.name === nodeTypeName;
        });

        // For node types with definition
        if (definition?.schema_config?.fields) {
            return definition.schema_config.fields.map((f) => f.key);
        }

        // Fallback: show all metadata keys
        return Object.keys(metadata);
    }, [isNode, node, definitions]);

    // Determine which item we're working with
    const item = isNode ? node : record;
    if (!item && !recordLoading) return null;
    if (!item) return <div className="p-4 text-slate-400">Loading...</div>;

    const nodeType = isNode ? (item as { type: NodeType }).type : 'record';
    const title = isNode
        ? (item as { title: string }).title
        : (item as { unique_name: string }).unique_name;
    const description = isNode ? (item as { description?: unknown }).description : null;

    const bgColor = {
        project: 'bg-blue-50 border-blue-100 text-blue-900',
        process: 'bg-purple-50 border-purple-100 text-purple-900',
        stage: 'bg-slate-50 border-slate-100 text-slate-900',
        subprocess: 'bg-orange-50 border-orange-100 text-orange-900',
        task: 'bg-green-50 border-green-100 text-green-900',
        subtask: 'bg-teal-50 border-teal-100 text-teal-900',
        record: 'bg-slate-50 border-slate-100 text-slate-900',
        template: 'bg-amber-50 border-amber-100 text-amber-900',
    }[nodeType];

    const handleDescriptionChange = (newContent: unknown) => {
        if (descriptionTimerRef.current) {
            clearTimeout(descriptionTimerRef.current);
        }

        descriptionTimerRef.current = setTimeout(() => {
            if (isNode) {
                updateNode.mutate({ id: item.id, description: newContent });
            }
        }, 1000);
    };

    const confirmDeleteRecord = () => {
        openOverlay('confirm-delete', {
            title: 'Delete Record',
            message:
                'Are you sure you want to delete this record? This action cannot be undone and will also remove all links to this record.',
            itemName: title,
            onConfirm: async () => {
                await deleteRecord.mutateAsync(item.id);
                clearInspection();
            },
        });
    };

    // Determine which fields to render
    const hasRecordViewModels = !isNode && visibleViewModels.length > 0;

    return (
        <div className="fade-in space-y-6">
            {/* Identity Card */}
            <div className={`${bgColor} border rounded-lg p-4`}>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] opacity-75 font-semibold uppercase mb-1">
                            Record Class: {nodeType}
                        </div>
                        <div className="text-ws-h2 font-semibold text-slate-900">{title}</div>
                        <div className="text-xs opacity-50 mt-1 font-mono">
                            UUID: {item.id.slice(0, 11)}
                        </div>
                    </div>
                    {!isNode && (
                        <div className="flex items-center gap-1">
                            <div className="relative" ref={historyRef}>
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="View naming history"
                                >
                                    <History size={16} />
                                </button>
                                {showHistory && (
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-10 overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                                            Naming History
                                        </div>
                                        <div className="max-h-60 overflow-y-auto py-1">
                                            {!history || history.length === 0 ? (
                                                <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                                                    No aliases found
                                                </div>
                                            ) : (
                                                history.map((alias: any) => (
                                                    <div key={alias.id} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50">
                                                        <span className="text-sm font-medium text-slate-700">{alias.name}</span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${alias.type === 'primary' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {alias.type}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(alias.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={confirmDeleteRecord}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete record"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Description Editor (Only for Nodes) */}
            {isNode && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase border-b border-slate-100 pb-2">
                        Description
                    </h4>
                    <div className="border border-slate-200 rounded-md bg-white p-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                        <RichTextEditor
                            key={item.id}
                            content={description}
                            contextId={item.id}
                            contextType="subprocess"
                            onChange={handleDescriptionChange}
                        />
                    </div>
                </div>
            )}

            {/* Fields Section */}
            <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase border-b border-slate-100 pb-2">
                    Record Fields
                </h4>

                {/* Records: Use Semantic FieldEditor */}
                {hasRecordViewModels && visibleViewModels.map((vm) => (
                    <FieldEditor
                        key={vm.fieldId}
                        recordId={item.id}
                        fieldId={vm.fieldId}
                        showLabel={true}
                    />
                ))}

                {/* Records with no fields */}
                {!isNode && !hasRecordViewModels && !recordLoading && (
                    <p className="text-sm text-slate-400 italic">No fields defined</p>
                )}

                {/* Nodes: Use semantic NodeFieldEditor */}
                {isNode && nodeFieldKeys.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No fields defined</p>
                )}

                {isNode && nodeFieldKeys.map((fieldKey) => (
                    <NodeFieldEditor
                        key={fieldKey}
                        nodeId={item.id}
                        fieldId={fieldKey}
                        showLabel={true}
                    />
                ))}
            </div>
        </div>
    );
}
