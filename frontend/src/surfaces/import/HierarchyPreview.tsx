/**
 * Hierarchy Preview
 *
 * Renders import plan as a hierarchical table using UniversalTableCore.
 * Uses ImportPlanRowModelAdapter to convert ImportPlan to RowModel.
 */

import { clsx } from 'clsx';
import { ChevronRight, ChevronDown, Folder, FileText, Box, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import type { ImportPlan, ItemClassification } from '../../api/hooks/imports';
import { UniversalTableCore } from '../../ui/table-core/UniversalTableCore';
import type { TableColumn, TableRow } from '../../ui/table-core/types';
import { makeImportPlanRowModel, getImportPlanMeta, getImportPlanNode } from '../../ui/table-core/adapters';

// ============================================================================
// CLASSIFICATION STYLES
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
// PROPS
// ============================================================================

interface HierarchyPreviewProps {
    plan: ImportPlan;
    selectedRecordId: string | null;
    onSelect: (recordId: string) => void;
}

// ============================================================================
// CELL RENDERERS
// ============================================================================

function ClassificationBadge({ classification }: { classification: ItemClassification }) {
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

function TitleCell({ row, onToggle }: { row: TableRow; onToggle: (id: string) => void }) {
    const meta = getImportPlanMeta(row);
    const node = getImportPlanNode(row);

    // Icon based on node/entity type
    const Icon = meta.nodeType === 'container'
        ? (meta.entityType === 'project' ? Folder : meta.entityType === 'process' ? Box : Folder)
        : FileText;

    return (
        <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${meta.depth * 20}px` }}
        >
            {/* Expand/collapse chevron */}
            {meta.hasChildren ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(row.id);
                    }}
                    className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                    {meta.isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
            ) : (
                <span className="w-4" />
            )}

            {/* Icon */}
            <Icon className={clsx('w-4 h-4', meta.nodeType === 'container' ? 'text-blue-500' : 'text-slate-400')} />

            {/* Title */}
            <span className="text-sm font-medium truncate">{node.title}</span>
        </div>
    );
}

function EntityTypeBadge({ entityType }: { entityType: string }) {
    return (
        <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {entityType}
        </span>
    );
}

// ============================================================================
// FIELD VALUE RENDERING
// ============================================================================

function getFieldValue(row: TableRow, fieldName: string): { value: unknown; renderHint?: string } | null {
    const node = getImportPlanNode(row);
    const item = node.data as { fieldRecordings?: Array<{ fieldName: string; value: unknown; renderHint?: string }> };
    if (!item.fieldRecordings) return null;

    const recording = item.fieldRecordings.find(
        (f) => f.fieldName.toLowerCase() === fieldName.toLowerCase()
    );
    return recording ? { value: recording.value, renderHint: recording.renderHint } : null;
}

function FieldValueCell({ value, renderHint }: { value: unknown; renderHint?: string }) {
    if (value == null || value === '' || String(value) === 'null') {
        return <span className="text-slate-300">—</span>;
    }

    const strValue = String(value);

    // Render based on hint
    switch (renderHint) {
        case 'status':
            // Status badge with color coding
            const statusColors: Record<string, string> = {
                'done': 'bg-emerald-100 text-emerald-700',
                'completed': 'bg-emerald-100 text-emerald-700',
                'in progress': 'bg-blue-100 text-blue-700',
                'working on it': 'bg-blue-100 text-blue-700',
                'stuck': 'bg-red-100 text-red-700',
                'not started': 'bg-slate-100 text-slate-600',
            };
            const colorClass = statusColors[strValue.toLowerCase()] ?? 'bg-slate-100 text-slate-600';
            return (
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colorClass}`}>
                    {strValue}
                </span>
            );

        case 'date':
            return <span className="text-xs text-slate-600">{strValue}</span>;

        case 'person':
            return (
                <span className="text-xs text-slate-600 truncate" title={strValue}>
                    {strValue}
                </span>
            );

        default:
            return <span className="text-xs text-slate-600 truncate">{strValue}</span>;
    }
}

// ============================================================================
// COLUMN FACTORY
// ============================================================================

function makeColumns(onToggle: (id: string) => void): TableColumn[] {
    return [
        {
            id: 'title',
            header: 'Title',
            width: 'flex' as const,
            cell: (row) => <TitleCell row={row} onToggle={onToggle} />,
        },
        {
            id: 'type',
            header: 'Type',
            width: 70,
            align: 'center' as const,
            cell: (row) => {
                const meta = getImportPlanMeta(row);
                return <EntityTypeBadge entityType={meta.entityType} />;
            },
        },
        {
            id: 'status',
            header: 'Status',
            width: 100,
            align: 'center' as const,
            cell: (row) => {
                const field = getFieldValue(row, 'Status');
                return field ? <FieldValueCell value={field.value} renderHint={field.renderHint} /> : null;
            },
        },
        {
            id: 'owner',
            header: 'Owner',
            width: 100,
            cell: (row) => {
                const field = getFieldValue(row, 'Owner');
                return field ? <FieldValueCell value={field.value} renderHint={field.renderHint} /> : null;
            },
        },
        {
            id: 'targetDate',
            header: 'Target Date',
            width: 90,
            align: 'center' as const,
            cell: (row) => {
                const field = getFieldValue(row, 'Target Date');
                return field ? <FieldValueCell value={field.value} renderHint={field.renderHint} /> : null;
            },
        },
        {
            id: 'classification',
            header: 'Classification',
            width: 130,
            align: 'right' as const,
            cell: (row) => {
                const meta = getImportPlanMeta(row);
                return meta.classification
                    ? <ClassificationBadge classification={meta.classification} />
                    : null;
            },
        },
    ];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HierarchyPreview({
    plan,
    selectedRecordId,
    onSelect,
}: HierarchyPreviewProps) {
    // Expansion state - start with all expanded
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
        // Auto-expand all containers and items with children
        const ids = new Set<string>();
        for (const container of plan.containers) {
            ids.add(container.tempId);
        }
        for (const item of plan.items) {
            ids.add(item.tempId);
        }
        return ids;
    });

    const handleToggleExpanded = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Create row model from plan
    const rowModel = useMemo(
        () => makeImportPlanRowModel({
            plan,
            expandedIds,
            onToggleExpanded: handleToggleExpanded,
        }),
        [plan, expandedIds, handleToggleExpanded]
    );

    // Create columns with toggle handler
    const columns = useMemo(() => makeColumns(handleToggleExpanded), [handleToggleExpanded]);

    // Row click handler
    const handleRowClick = useCallback((rowId: string) => {
        onSelect(rowId);
    }, [onSelect]);

    // Custom row className for selection
    const getRowClassName = useCallback((row: TableRow) => {
        return row.id === selectedRecordId ? 'bg-blue-50 ring-1 ring-blue-200' : '';
    }, [selectedRecordId]);

    return (
        <div className="h-full">
            <UniversalTableCore
                rowModel={rowModel}
                columns={columns}
                onRowClick={handleRowClick}
                getRowClassName={getRowClassName}
                compact
                emptyState={
                    <div className="text-center text-slate-400 py-8">
                        <p>No items in import plan</p>
                    </div>
                }
            />
        </div>
    );
}

export default HierarchyPreview;
