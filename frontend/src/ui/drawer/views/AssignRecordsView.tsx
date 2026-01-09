/**
 * AssignRecordsView (formerly ClassifyRecordsView)
 *
 * Bulk hierarchy assignment UI for records using Mantine.
 * This assigns records to hierarchy nodes - NOT semantic classification.
 *
 * @deprecated Legacy props are deprecated. Use DrawerProps<ClassifyRecordsContext> instead.
 */

import { useState } from 'react';
import { FolderOpen, ChevronRight } from 'lucide-react';
import {
    Button, Stack, Group, Text, Paper, Box, ThemeIcon, Alert
} from '@mantine/core';
import { useUIStore } from '../../../stores/uiStore';
import { useProjectTree, useBulkClassifyRecords } from '../../../api/hooks';
import type { HierarchyNode } from '../../../types';
import type { DrawerProps, ClassifyRecordsContext } from '../../../drawer/types';

/**
 * @deprecated Use DrawerProps<ClassifyRecordsContext> instead.
 */
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
            <Box key={node.id}>
                <Paper
                    withBorder={isSelected}
                    p="xs"
                    radius="sm"
                    className={`cursor-pointer transition-colors ${isSelected
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-slate-100'
                        }`}
                    style={{ marginLeft: depth * 16 }}
                    onClick={() => setSelectedNodeId(node.id)}
                >
                    <Group gap="xs" wrap="nowrap">
                        {node.children.length > 0 && (
                            <ChevronRight size={14} className="text-slate-400" />
                        )}
                        <Text size="sm" truncate className="flex-1">{node.title}</Text>
                        <Text size="xs" c="dimmed" tt="capitalize">{node.type}</Text>
                    </Group>
                </Paper>
                {node.children.map((child) => renderNode(child as typeof node, depth + 1))}
            </Box>
        );
    };

    return (
        <Box maw={480} mx="auto">
            <Group gap="md" mb="lg" align="flex-start">
                <ThemeIcon size={48} variant="light" color="blue" radius="xl">
                    <FolderOpen size={24} />
                </ThemeIcon>
                <Stack gap={2}>
                    <Text size="lg" fw={500}>Assign Records</Text>
                    <Text size="sm" c="dimmed">
                        Select a project, process, or stage to assign {recordIds.length} record
                        {recordIds.length > 1 ? 's' : ''}.
                    </Text>
                </Stack>
            </Group>

            {/* Node selection tree */}
            <Paper
                withBorder
                p="xs"
                radius="md"
                className="bg-slate-50 overflow-y-auto"
                style={{ maxHeight: 256 }}
                mb="md"
            >
                {tree.length === 0 ? (
                    <Text size="sm" c="dimmed" p="sm">No hierarchy nodes available</Text>
                ) : (
                    <Stack gap={4}>
                        {tree.map((node) => renderNode(node))}
                    </Stack>
                )}
            </Paper>

            {selectedNodeId && (
                <Text size="sm" c="blue" mb="md">
                    Selected: {hierarchy?.find((n: HierarchyNode) => n.id === selectedNodeId)?.title || 'Unknown'}
                </Text>
            )}

            {error && (
                <Alert color="red" variant="light" mb="md">
                    {error}
                </Alert>
            )}

            <Group justify="space-between" pt="md" className="border-t border-slate-100">
                <Button
                    variant="subtle"
                    color="gray"
                    onClick={handleRemoveAssignment}
                    disabled={bulkAssign.isPending}
                >
                    Remove Assignment
                </Button>
                <Group gap="sm">
                    <Button
                        variant="default"
                        onClick={handleClose}
                        disabled={bulkAssign.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!selectedNodeId}
                        loading={bulkAssign.isPending}
                    >
                        Assign
                    </Button>
                </Group>
            </Group>
        </Box>
    );
}

/**
 * @deprecated Use AssignRecordsView instead.
 */
export const ClassifyRecordsView = AssignRecordsView;
