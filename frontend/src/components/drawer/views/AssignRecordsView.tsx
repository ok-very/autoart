/**
 * AssignRecordsView (formerly ClassifyRecordsView)
 *
 * Bulk hierarchy assignment UI for records.
 * This assigns records to hierarchy nodes - NOT semantic classification.
 */

import { useState } from 'react';
import { FolderOpen, ChevronRight } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useProjectTree, useBulkClassifyRecords } from '../../../api/hooks';
import type { HierarchyNode } from '../../../types';
import type { DrawerProps, ClassifyRecordsContext } from '../../../drawer/types';

// Props types for backward compatibility
interface LegacyAssignRecordsViewProps {
    recordIds: string[];
    onSuccess?: () => void;
}

type AssignRecordsViewProps = DrawerProps<ClassifyRecordsContext, { assigned: boolean; nodeId: string | null }>;

function isDrawerProps(props: unknown): props is AssignRecordsViewProps {
    return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props && 'onClose' in props;
}

export function AssignRecordsView(props: AssignRecordsViewProps | LegacyAssignRecordsViewProps) {
    const isNewContract = isDrawerProps(props);
    const recordIds = isNewContract ? props.context.recordIds : props.recordIds;
    const legacyOnSuccess = !isNewContract ? props.onSuccess : undefined;
    const contextOnSuccess = isNewContract ? props.context.onSuccess : undefined;
    const onClose = isNewContract ? props.onClose : undefined;
    const onSubmit = isNewContract ? props.onSubmit : undefined;

    const { closeDrawer, activeProjectId } = useUIStore();
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { data: hierarchy } = useProjectTree(activeProjectId);
    const bulkAssign = useBulkClassifyRecords(); // API hook unchanged for now

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            closeDrawer();
        }
    };

    const buildTree = (nodes: HierarchyNode[] | undefined) => {
        if (!nodes) return [];
        const nodeMap = new Map<string, HierarchyNode & { children: HierarchyNode[] }>();
        const roots: (HierarchyNode & { children: HierarchyNode[] })[] = [];

        nodes.forEach((node) => {
            nodeMap.set(node.id, { ...node, children: [] });
        });

        nodes.forEach((node) => {
            const mapped = nodeMap.get(node.id)!;
            if (node.parent_id && nodeMap.has(node.parent_id)) {
                nodeMap.get(node.parent_id)!.children.push(mapped);
            } else if (!node.parent_id) {
                roots.push(mapped);
            }
        });

        return roots;
    };

    const tree = buildTree(hierarchy);

    const handleAssign = async () => {
        setError(null);
        try {
            await bulkAssign.mutateAsync({
                recordIds,
                classificationNodeId: selectedNodeId,
            });

            if (onSubmit) {
                onSubmit({
                    success: true,
                    data: { assigned: true, nodeId: selectedNodeId },
                    sideEffects: [{ type: 'assign', entityType: 'record' }],
                });
            } else {
                legacyOnSuccess?.();
                contextOnSuccess?.();
                closeDrawer();
            }
        } catch (err) {
            console.error('Assignment failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Assignment failed. Please try again.';
            setError(errorMessage);
            if (onSubmit) {
                onSubmit({
                    success: false,
                    error: errorMessage,
                });
            }
        }
    };

    const handleRemoveAssignment = async () => {
        setError(null);
        try {
            await bulkAssign.mutateAsync({
                recordIds,
                classificationNodeId: null,
            });

            if (onSubmit) {
                onSubmit({
                    success: true,
                    data: { assigned: true, nodeId: null },
                    sideEffects: [{ type: 'assign', entityType: 'record' }],
                });
            } else {
                legacyOnSuccess?.();
                contextOnSuccess?.();
                closeDrawer();
            }
        } catch (err) {
            console.error('Remove assignment failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to remove assignment.';
            setError(errorMessage);
            if (onSubmit) {
                onSubmit({
                    success: false,
                    error: errorMessage,
                });
            }
        }
    };

    const renderNode = (node: HierarchyNode & { children: HierarchyNode[] }, depth = 0) => {
        const isSelected = selectedNodeId === node.id;
        return (
            <div key={node.id}>
                <button
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${isSelected
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'hover:bg-slate-100 text-slate-700'
                        }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                    {node.children.length > 0 && (
                        <ChevronRight size={14} className="text-slate-400" />
                    )}
                    <span className="truncate">{node.title}</span>
                    <span className="text-xs text-slate-400 capitalize ml-auto">{node.type}</span>
                </button>
                {node.children.map((child) => renderNode(child as typeof node, depth + 1))}
            </div>
        );
    };

    return (
        <div className="max-w-lg mx-auto">
            <div className="flex items-start gap-4 mb-6">
                <div className="shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <FolderOpen size={24} className="text-blue-600" />
                </div>
                <div>
                    <h4 className="text-lg font-medium text-slate-900 mb-2">Assign Records</h4>
                    <p className="text-sm text-slate-600">
                        Select a project, process, or stage to assign {recordIds.length} record
                        {recordIds.length > 1 ? 's' : ''}.
                    </p>
                </div>
            </div>

            {/* Node selection tree */}
            <div className="mb-4 max-h-64 overflow-y-auto border border-slate-200 rounded-md p-2 bg-slate-50">
                {tree.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">No hierarchy nodes available</p>
                ) : (
                    tree.map((node) => renderNode(node))
                )}
            </div>

            {selectedNodeId && (
                <p className="text-sm text-blue-600 mb-4">
                    Selected: {hierarchy?.find((n: HierarchyNode) => n.id === selectedNodeId)?.title || 'Unknown'}
                </p>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                    type="button"
                    onClick={handleRemoveAssignment}
                    disabled={bulkAssign.isPending}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors"
                >
                    Remove Assignment
                </button>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={bulkAssign.isPending}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleAssign}
                        disabled={bulkAssign.isPending || !selectedNodeId}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {bulkAssign.isPending ? 'Assigning...' : 'Assign'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Legacy alias for backward compatibility
export const ClassifyRecordsView = AssignRecordsView;
