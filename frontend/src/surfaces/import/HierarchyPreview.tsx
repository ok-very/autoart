/**
 * Hierarchy Preview
 *
 * Renders import plan as a tree view (hierarchy projection).
 * Shows inline classification badges on items that need attention.
 */

import { ChevronRight, ChevronDown, Folder, FileText, Box, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useMemo } from 'react';

import type { ImportPlan, ImportPlanContainer, ImportPlanItem, ItemClassification } from '../../api/hooks/imports';

// ============================================================================
// CLASSIFICATION COLORS
// ============================================================================

const OUTCOME_STYLES: Record<string, { bg: string; text: string; icon: 'alert' | 'check' | 'none' }> = {
    FACT_EMITTED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'check' },
    DERIVED_STATE: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'check' },
    INTERNAL_WORK: { bg: 'bg-slate-100', text: 'text-slate-600', icon: 'none' },
    EXTERNAL_WORK: { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'check' },
    AMBIGUOUS: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'alert' },
    UNCLASSIFIED: { bg: 'bg-red-100', text: 'text-red-700', icon: 'alert' },
};

// ============================================================================
// TYPES
// ============================================================================

interface HierarchyPreviewProps {
    plan: ImportPlan;
    selectedRecordId: string | null;
    onSelect: (recordId: string) => void;
}

interface TreeNode {
    id: string;
    title: string;
    type: 'container' | 'item';
    nodeType: string;
    parentId: string | null;
    children: TreeNode[];
    data: ImportPlanContainer | ImportPlanItem;
    classification?: ItemClassification;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HierarchyPreview({
    plan,
    selectedRecordId,
    onSelect,
}: HierarchyPreviewProps) {
    // Build tree from plan
    const tree = useMemo(() => buildTree(plan), [plan]);

    return (
        <div className="p-4">
            {tree.map((node) => (
                <TreeNodeView
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedRecordId={selectedRecordId}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}

// ============================================================================
// CLASSIFICATION BADGE COMPONENT
// ============================================================================

interface ClassificationBadgeProps {
    classification: ItemClassification;
}

function ClassificationBadge({ classification }: ClassificationBadgeProps) {
    // Show resolved outcome if available, otherwise current outcome
    const outcome = classification.resolution?.resolvedOutcome || classification.outcome;
    const isResolved = !!classification.resolution;
    const needsAttention = !isResolved && (outcome === 'AMBIGUOUS' || outcome === 'UNCLASSIFIED');

    const styles = OUTCOME_STYLES[outcome] || OUTCOME_STYLES.UNCLASSIFIED;

    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${styles.bg} ${styles.text}`}
            title={classification.rationale}
        >
            {needsAttention && <AlertCircle className="w-3 h-3" />}
            {isResolved && <CheckCircle2 className="w-3 h-3" />}
            {outcome.replace(/_/g, ' ')}
        </span>
    );
}

// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

interface TreeNodeViewProps {
    node: TreeNode;
    depth: number;
    selectedRecordId: string | null;
    onSelect: (recordId: string) => void;
}

function TreeNodeView({ node, depth, selectedRecordId, onSelect }: TreeNodeViewProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children.length > 0;
    const isSelected = node.id === selectedRecordId;

    const Icon = node.type === 'container' ? (
        node.nodeType === 'project' ? Folder :
            node.nodeType === 'process' ? Box :
                Folder
    ) : FileText;

    return (
        <div>
            <button
                onClick={() => {
                    if (node.type === 'item') {
                        onSelect(node.id);
                    } else if (hasChildren) {
                        setIsExpanded(!isExpanded);
                    }
                }}
                className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors ${isSelected
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
                {/* Expand/collapse chevron */}
                {hasChildren ? (
                    <span className="w-4 h-4 flex items-center justify-center text-slate-400">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </span>
                ) : (
                    <span className="w-4" />
                )}

                {/* Icon */}
                <Icon className={`w-4 h-4 ${node.type === 'container' ? 'text-blue-500' : 'text-slate-400'
                    }`} />

                {/* Title */}
                <span className="text-sm font-medium truncate flex-1">{node.title}</span>

                {/* Classification badge (for items) */}
                {node.classification && (
                    <ClassificationBadge classification={node.classification} />
                )}

                {/* Type badge */}
                <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {node.nodeType}
                </span>
            </button>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <TreeNodeView
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedRecordId={selectedRecordId}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// TREE BUILDER
// ============================================================================

function buildTree(plan: ImportPlan): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();

    // Build classification lookup by item tempId
    const classificationMap = new Map<string, ItemClassification>();
    if (plan.classifications) {
        for (const c of plan.classifications) {
            classificationMap.set(c.itemTempId, c);
        }
    }

    // Add containers
    for (const container of plan.containers) {
        nodeMap.set(container.tempId, {
            id: container.tempId,
            title: container.title,
            type: 'container',
            nodeType: container.type,
            parentId: container.parentTempId,
            children: [],
            data: container,
        });
    }

    // Add items with their classifications
    for (const item of plan.items) {
        nodeMap.set(item.tempId, {
            id: item.tempId,
            title: item.title,
            type: 'item',
            nodeType: 'task',
            parentId: item.parentTempId,
            children: [],
            data: item,
            classification: classificationMap.get(item.tempId),
        });
    }

    // Build parent-child relationships
    const roots: TreeNode[] = [];
    for (const node of nodeMap.values()) {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

export default HierarchyPreview;
