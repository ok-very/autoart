/**
 * AssignRecordsView (formerly ClassifyRecordsView)
 *
 * Bulk hierarchy assignment UI for records using bespoke components.
 * This assigns records to hierarchy nodes - NOT semantic classification.
 *
 * @deprecated Legacy props are deprecated. Use OverlayProps<ClassifyRecordsContext> instead.
 */

import { FolderOpen, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { useProjectTree, useBulkClassifyRecords } from '@/api/hooks';
import { useUIStore } from '@/stores';
import type { HierarchyNode } from '@/types';

import type { OverlayProps, ClassifyRecordsContext } from '../../../overlay/types';
import { Alert } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';



/**
 * @deprecated Use OverlayProps<ClassifyRecordsContext> instead.
 */
interface LegacyAssignRecordsViewProps {
    recordIds: string[];
    onSuccess?: () => void;
}

type AssignRecordsViewProps = OverlayProps<ClassifyRecordsContext, { assigned: boolean; nodeId: string | null }>;

function isOverlayProps(props: unknown): props is AssignRecordsViewProps {
    return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props && 'onClose' in props;
}

export function AssignRecordsView(props: AssignRecordsViewProps | LegacyAssignRecordsViewProps) {
    const isNewContract = isOverlayProps(props);
    const recordIds = isNewContract ? props.context.recordIds : props.recordIds;
    const legacyOnSuccess = !isNewContract ? props.onSuccess : undefined;
    const contextOnSuccess = isNewContract ? props.context.onSuccess : undefined;
    const onClose = isNewContract ? props.onClose : undefined;
    const onSubmit = isNewContract ? props.onSubmit : undefined;

    const { closeOverlay, activeProjectId } = useUIStore();
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { data: hierarchy } = useProjectTree(activeProjectId);
    const bulkAssign = useBulkClassifyRecords(); // API hook unchanged for now

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            closeOverlay();
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
                closeOverlay();
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
                closeOverlay();
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
                <div
                    className={`cursor-pointer transition-colors p-2 rounded-md ${isSelected
                        ? 'bg-blue-50 border border-blue-300'
                        : 'hover:bg-slate-100'
                        }`}
                    style={{ marginLeft: depth * 16 }}
                    onClick={() => setSelectedNodeId(node.id)}
                >
                    <Inline gap="xs" wrap={false}>
                        {node.children.length > 0 && (
                            <ChevronRight size={14} className="text-slate-400" />
                        )}
                        <Text size="sm" truncate className="flex-1">{node.title}</Text>
                        <Text size="xs" color="muted" className="capitalize">{node.type}</Text>
                    </Inline>
                </div>
                {node.children.map((child) => renderNode(child as typeof node, depth + 1))}
            </div>
        );
    };

    return (
        <div className="max-w-lg mx-auto">
            <Inline gap="md" className="mb-6" align="start">
                <div className="w-12 h-12 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full">
                    <FolderOpen size={24} />
                </div>
                <Stack gap="none">
                    <Text size="lg" weight="medium">Assign Records</Text>
                    <Text size="sm" color="muted">
                        Select a project, process, or stage to assign {recordIds.length} record
                        {recordIds.length > 1 ? 's' : ''}.
                    </Text>
                </Stack>
            </Inline>

            {/* Node selection tree */}
            <div
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-y-auto mb-4"
                style={{ maxHeight: 256 }}
            >
                {tree.length === 0 ? (
                    <Text size="sm" color="muted" className="p-2">No hierarchy nodes available</Text>
                ) : (
                    <Stack gap="xs">
                        {tree.map((node) => renderNode(node))}
                    </Stack>
                )}
            </div>

            {selectedNodeId && (
                <Text size="sm" className="text-blue-600 mb-4">
                    Selected: {hierarchy?.find((n: HierarchyNode) => n.id === selectedNodeId)?.title || 'Unknown'}
                </Text>
            )}

            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            <Inline justify="between" className="pt-4 border-t border-slate-100">
                <Button
                    variant="ghost"
                    onClick={handleRemoveAssignment}
                    disabled={bulkAssign.isPending}
                >
                    Remove Assignment
                </Button>
                <Inline gap="sm">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={bulkAssign.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!selectedNodeId || bulkAssign.isPending}
                    >
                        {bulkAssign.isPending ? 'Assigning...' : 'Assign'}
                    </Button>
                </Inline>
            </Inline>
        </div>
    );
}

/**
 * @deprecated Use AssignRecordsView instead.
 */
export const ClassifyRecordsView = AssignRecordsView;
