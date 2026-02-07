/**
 * DataTableImport - Reusable table composite for ImportPlan data
 *
 * This is a REUSABLE COMPOSITE for ImportPlanItem[] with fieldRecordings.
 * It does NOT fetch data - data is passed in as props.
 * HierarchyPreview uses this for import preview tables.
 *
 * For HierarchyNode data (tasks, subprocesses), use DataTableHierarchy instead.
 * For flat DataRecord data, use DataTableFlat instead.
 *
 * Features:
 * - Dynamic columns discovered from fieldRecordings
 * - Column visibility picker
 * - Hierarchical display with expand/collapse
 * - Classification badges
 * - Row selection
 * - Builds columns dynamically from actual data
 *
 * Architecture:
 * - Uses UniversalTableCore for rendering
 * - Uses makeImportPlanRowModel adapter
 * - Wrapper discovers columns from fieldRecordings
 */

import { clsx } from 'clsx';
import { ChevronRight, ChevronDown, Folder, FileText, Box, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useMemo, useCallback } from 'react';

import type { ImportPlan, ImportPlanItem, ItemClassification } from '../../api/hooks/imports';
import { ColumnPicker } from '../../ui/molecules/ColumnPicker';
import { DataFieldWidget, type DataFieldKind } from '../../ui/molecules/DataFieldWidget';
import { humanizeFieldName } from '../../workflows/import/utils';
import { UniversalTableCore, makeImportPlanRowModel, getImportPlanMeta, getImportPlanNode, type TableColumn as CoreTableColumn, type TableRow } from '../table-core';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportFieldDef {
    fieldName: string;
    renderHint?: string;
    width?: number | 'flex';
    label?: string;
}

export interface DataTableImportProps {
    /** Import plan containing containers and items */
    plan: ImportPlan;
    /** Discovered fields from the plan */
    fields: ImportFieldDef[];
    /** Which fields are currently visible */
    visibleFields: Set<string>;
    /** Toggle field visibility */
    onToggleField: (fieldName: string) => void;
    /** Currently selected item ID */
    selectedItemId?: string | null;
    /** Callback when a row is clicked */
    onRowSelect?: (itemId: string) => void;
    /** Expanded node IDs for hierarchy */
    expandedIds: Set<string>;
    /** Toggle expansion of a node */
    onToggleExpanded: (id: string) => void;
    /** Empty state message */
    emptyMessage?: string;
    /** Additional className */
    className?: string;
    /** Compact mode */
    compact?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Discover all unique fields from import plan items
 */
export function discoverImportFields(plan: ImportPlan): ImportFieldDef[] {
    const fieldMap = new Map<string, { count: number; renderHint?: string }>();

    for (const item of plan.items) {
        for (const recording of item.fieldRecordings || []) {
            const existing = fieldMap.get(recording.fieldName);
            if (existing) {
                existing.count++;
                // Prefer non-null renderHint
                if (!existing.renderHint && recording.renderHint) {
                    existing.renderHint = recording.renderHint;
                }
            } else {
                fieldMap.set(recording.fieldName, {
                    count: 1,
                    renderHint: recording.renderHint,
                });
            }
        }
    }

    // Sort by frequency (most common first), then alphabetically
    return Array.from(fieldMap.entries())
        .sort((a, b) => {
            if (b[1].count !== a[1].count) return b[1].count - a[1].count;
            return a[0].localeCompare(b[0]);
        })
        .map(([fieldName, { renderHint }]) => ({
            fieldName,
            renderHint,
            width: getWidthForRenderHint(renderHint),
            label: humanizeFieldName(fieldName),
        }));
}

/**
 * Discover fields for a specific set of items (for nested level headers)
 */
export function discoverFieldsForItems(items: ImportPlanItem[]): ImportFieldDef[] {
    const fieldMap = new Map<string, { count: number; renderHint?: string }>();

    for (const item of items) {
        for (const recording of item.fieldRecordings || []) {
            const existing = fieldMap.get(recording.fieldName);
            if (existing) {
                existing.count++;
                if (!existing.renderHint && recording.renderHint) {
                    existing.renderHint = recording.renderHint;
                }
            } else {
                fieldMap.set(recording.fieldName, {
                    count: 1,
                    renderHint: recording.renderHint,
                });
            }
        }
    }

    return Array.from(fieldMap.entries())
        .sort((a, b) => {
            if (b[1].count !== a[1].count) return b[1].count - a[1].count;
            return a[0].localeCompare(b[0]);
        })
        .map(([fieldName, { renderHint }]) => ({
            fieldName,
            renderHint,
            width: getWidthForRenderHint(renderHint),
            label: humanizeFieldName(fieldName),
        }));
}

/**
 * Build hierarchical item groups: { parentId -> children[] }
 * Items whose parent is NOT in the items list are treated as roots.
 */
export function buildItemHierarchy(items: ImportPlanItem[]): {
    hierarchy: Map<string | undefined, ImportPlanItem[]>;
    rootItems: ImportPlanItem[];
} {
    const hierarchy = new Map<string | undefined, ImportPlanItem[]>();
    const itemIds = new Set(items.map(i => i.tempId));

    for (const item of items) {
        const parentKey = item.parentTempId ?? undefined;
        const siblings = hierarchy.get(parentKey) ?? [];
        siblings.push(item);
        hierarchy.set(parentKey, siblings);
    }

    // Find root items: those with no parent OR parent not in items list (parent is a container)
    const rootItems = items.filter(item => {
        if (!item.parentTempId) return true;
        // If parent is not another item, it's a container - treat as root
        return !itemIds.has(item.parentTempId);
    });

    return { hierarchy, rootItems };
}

/**
 * Check if an item has children in the hierarchy
 */
export function hasChildren(itemId: string, hierarchy: Map<string | undefined, ImportPlanItem[]>): boolean {
    return (hierarchy.get(itemId)?.length ?? 0) > 0;
}

/**
 * Get default width based on render hint
 */
function getWidthForRenderHint(renderHint?: string): number {
    switch (renderHint) {
        case 'status':
            return 100;
        case 'date':
            return 100;
        case 'person':
            return 120;
        case 'number':
            return 80;
        default:
            return 120;
    }
}

// ============================================================================
// CLASSIFICATION STYLES
// ============================================================================

const OUTCOME_STYLES: Record<string, { bg: string; text: string; icon: 'alert' | 'check' | 'none' }> = {
    FACT_EMITTED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'check' },
    DERIVED_STATE: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'check' },
    INTERNAL_WORK: { bg: 'bg-slate-100', text: 'text-ws-text-secondary', icon: 'none' },
    EXTERNAL_WORK: { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'check' },
    AMBIGUOUS: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'alert' },
    UNCLASSIFIED: { bg: 'bg-red-100', text: 'text-red-700', icon: 'alert' },
};

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
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${styles.bg} ${styles.text}`}
            title={classification.rationale}
        >
            {needsAttention && <AlertCircle className="w-3 h-3" />}
            {isResolved && <CheckCircle2 className="w-3 h-3" />}
            {outcome.replace(/_/g, ' ')}
        </span>
    );
}

function EntityTypeBadge({ entityType }: { entityType: string }) {
    return (
        <span className="text-[10px] font-semibold uppercase text-ws-muted bg-slate-100 px-1.5 py-0.5 rounded">
            {entityType}
        </span>
    );
}

function mapRenderHintToKind(renderHint?: string): DataFieldKind {
    switch (renderHint) {
        case 'status': return 'status';
        case 'date': return 'date';
        case 'person': return 'user';
        case 'percent': return 'percent';
        case 'tags': return 'tags';
        case 'description': return 'description';
        default: return 'text';
    }
}

function FieldValueCell({ value, renderHint }: { value: unknown; renderHint?: string }) {
    // Null values render as completely blank
    if (value == null || value === '' || String(value) === 'null') {
        return <span />;
    }

    const kind = mapRenderHintToKind(renderHint);

    return <DataFieldWidget kind={kind} value={value} />;
}

// ============================================================================
// DATA TABLE IMPORT
// ============================================================================

export function DataTableImport({
    plan,
    fields,
    visibleFields,
    onToggleField,
    selectedItemId,
    onRowSelect,
    expandedIds,
    onToggleExpanded,
    emptyMessage = 'No items in import plan',
    className,
    compact = true,
}: DataTableImportProps) {
    // Get field value from a row
    const getFieldValue = useCallback((row: TableRow, fieldName: string): { value: unknown; renderHint?: string } | null => {
        const node = getImportPlanNode(row);
        const item = node.data as ImportPlanItem;
        if (!item.fieldRecordings) return null;

        const recording = item.fieldRecordings.find(
            (f) => f.fieldName.toLowerCase() === fieldName.toLowerCase()
        );
        return recording ? { value: recording.value, renderHint: recording.renderHint } : null;
    }, []);

    // Build columns
    const columns = useMemo<CoreTableColumn[]>(() => {
        const cols: CoreTableColumn[] = [];

        // Title column (always visible)
        cols.push({
            id: 'title',
            header: 'Title',
            width: 'flex' as const,
            cell: (row) => {
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
                                    onToggleExpanded(row.id);
                                }}
                                className="w-4 h-4 flex items-center justify-center text-ws-muted hover:text-ws-text-secondary"
                            >
                                {meta.isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                        ) : (
                            <span className="w-4" />
                        )}

                        {/* Icon */}
                        <Icon className={clsx('w-4 h-4', meta.nodeType === 'container' ? 'text-blue-500' : 'text-ws-muted')} />

                        {/* Title */}
                        <span className="text-sm font-medium truncate">{node.title}</span>
                    </div>
                );
            },
        });

        // Type column (always visible)
        cols.push({
            id: 'type',
            header: 'Type',
            width: 70,
            align: 'center' as const,
            cell: (row) => {
                const meta = getImportPlanMeta(row);
                return <EntityTypeBadge entityType={meta.entityType} />;
            },
        });

        // Dynamic field columns (based on visibility)
        for (const field of fields) {
            if (!visibleFields.has(field.fieldName)) continue;

            cols.push({
                id: `field_${field.fieldName}`,
                header: field.label || field.fieldName,
                width: field.width || 120,
                align: 'center' as const,
                cell: (row) => {
                    const fieldData = getFieldValue(row, field.fieldName);
                    if (!fieldData) return <span />;
                    return <FieldValueCell value={fieldData.value} renderHint={fieldData.renderHint || field.renderHint} />;
                },
            });
        }

        // Classification column (always visible)
        cols.push({
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
        });

        return cols;
    }, [fields, visibleFields, getFieldValue, onToggleExpanded]);

    // Create row model
    const rowModel = useMemo(
        () => makeImportPlanRowModel({
            plan,
            expandedIds,
            onToggleExpanded,
        }),
        [plan, expandedIds, onToggleExpanded]
    );

    // Row click handler
    const handleRowClick = useCallback((rowId: string) => {
        onRowSelect?.(rowId);
    }, [onRowSelect]);

    // Row className for selection
    const getRowClassName = useCallback((row: TableRow) => {
        return row.id === selectedItemId ? 'bg-blue-50 ring-1 ring-blue-200' : '';
    }, [selectedItemId]);

    return (
        <div className={clsx('flex flex-col h-full', className)}>
            {/* Toolbar with column picker */}
            <div className="flex items-center justify-end px-3 py-2 border-b border-ws-panel-border bg-ws-panel-bg">
                <ColumnPicker
                    allFields={fields}
                    visibleKeys={visibleFields}
                    onToggle={onToggleField}
                />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
                <UniversalTableCore
                    rowModel={rowModel}
                    columns={columns}
                    onRowClick={handleRowClick}
                    getRowClassName={getRowClassName}
                    compact={compact}
                    emptyState={
                        <div className="text-center text-ws-muted py-8">
                            <p>{emptyMessage}</p>
                        </div>
                    }
                />
            </div>
        </div>
    );
}

// ============================================================================
// NESTED DATA TABLE - Infinite hierarchy with per-level headers
// ============================================================================

export interface NestedDataTableProps {
    /** All items (flat list, hierarchy built from parentTempId) */
    items: ImportPlanItem[];
    /** Classification lookup by tempId */
    classificationMap: Map<string, ItemClassification>;
    /** Which fields are visible (applied globally) */
    visibleFields: Set<string>;
    /** Currently selected item ID */
    selectedItemId?: string | null;
    /** Callback when a row is clicked */
    onRowSelect?: (itemId: string) => void;
    /** Expanded node IDs */
    expandedIds: Set<string>;
    /** Toggle expansion */
    onToggleExpanded: (id: string) => void;
    /** Maximum recursion depth (default 10) */
    maxDepth?: number;
    /** Additional className */
    className?: string;
}

/**
 * Recursive nested table that renders each hierarchy level with its own columns.
 * Handles infinite nesting (up to maxDepth).
 */
export function NestedDataTable({
    items,
    classificationMap,
    visibleFields,
    selectedItemId,
    onRowSelect,
    expandedIds,
    onToggleExpanded,
    maxDepth = 10,
    className,
}: NestedDataTableProps) {
    // Build hierarchy once - now returns both hierarchy map and rootItems
    const { hierarchy, rootItems } = useMemo(() => buildItemHierarchy(items), [items]);

    return (
        <div className={clsx('flex flex-col overflow-auto', className)}>
            <NestedLevel
                items={rootItems}
                hierarchy={hierarchy}
                classificationMap={classificationMap}
                visibleFields={visibleFields}
                selectedItemId={selectedItemId}
                onRowSelect={onRowSelect}
                expandedIds={expandedIds}
                onToggleExpanded={onToggleExpanded}
                depth={0}
                maxDepth={maxDepth}
            />
        </div>
    );
}

// ============================================================================
// NESTED LEVEL - Renders a single level of the hierarchy with its own headers
// ============================================================================

interface NestedLevelProps {
    items: ImportPlanItem[];
    hierarchy: Map<string | undefined, ImportPlanItem[]>;
    classificationMap: Map<string, ItemClassification>;
    visibleFields: Set<string>;
    selectedItemId?: string | null;
    onRowSelect?: (itemId: string) => void;
    expandedIds: Set<string>;
    onToggleExpanded: (id: string) => void;
    depth: number;
    maxDepth: number;
}

function NestedLevel({
    items,
    hierarchy,
    classificationMap,
    visibleFields,
    selectedItemId,
    onRowSelect,
    expandedIds,
    onToggleExpanded,
    depth,
    maxDepth,
}: NestedLevelProps) {
    // Discover fields for THIS level's items
    const levelFields = useMemo(() => {
        return discoverFieldsForItems(items)
            .filter(f => visibleFields.has(f.fieldName));
    }, [items, visibleFields]);

    if (items.length === 0 || depth > maxDepth) {
        return null;
    }

    return (
        <div className={clsx('border border-ws-panel-border rounded-lg overflow-hidden', depth > 0 && 'ml-6 mt-2 mb-2')}>
            {/* Header row for this level */}
            <div className="flex bg-slate-100 text-[10px] font-semibold uppercase text-ws-text-secondary border-b border-ws-panel-border">
                <div className="flex-1 min-w-[200px] px-3 py-1.5">Title</div>
                <div className="w-16 px-2 py-1.5 text-center">Type</div>
                {levelFields.map(field => (
                    <div
                        key={field.fieldName}
                        className="px-2 py-1.5 text-center"
                        style={{ width: field.width || 100 }}
                    >
                        {field.label}
                    </div>
                ))}
                <div className="w-28 px-2 py-1.5 text-right">Classification</div>
            </div>

            {/* Rows */}
            {items.map(item => {
                const itemChildren = hierarchy.get(item.tempId) ?? [];
                const isExpandable = itemChildren.length > 0;
                const isExpanded = expandedIds.has(item.tempId);
                const classification = classificationMap.get(item.tempId);
                const isSelected = item.tempId === selectedItemId;

                return (
                    <div key={item.tempId}>
                        {/* Item row */}
                        <div
                            className={clsx(
                                'flex items-center border-b border-ws-panel-border hover:bg-ws-bg cursor-pointer transition-colors',
                                isSelected && 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                            )}
                            onClick={() => onRowSelect?.(item.tempId)}
                        >
                            {/* Title cell with expand/collapse */}
                            <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2">
                                {isExpandable ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleExpanded(item.tempId);
                                        }}
                                        className="w-4 h-4 flex items-center justify-center text-ws-muted hover:text-ws-text-secondary"
                                    >
                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </button>
                                ) : (
                                    <span className="w-4" />
                                )}
                                <FileText className="w-4 h-4 text-ws-muted" />
                                <span className="text-sm font-medium truncate">{item.title}</span>
                            </div>

                            {/* Type cell */}
                            <div className="w-16 px-2 py-2 text-center">
                                <EntityTypeBadge entityType={item.entityType || 'action'} />
                            </div>

                            {/* Field cells */}
                            {levelFields.map(field => {
                                const recording = item.fieldRecordings?.find(
                                    r => r.fieldName.toLowerCase() === field.fieldName.toLowerCase()
                                );
                                return (
                                    <div
                                        key={field.fieldName}
                                        className="px-2 py-2 text-center"
                                        style={{ width: field.width || 100 }}
                                    >
                                        <FieldValueCell
                                            value={recording?.value}
                                            renderHint={recording?.renderHint || field.renderHint}
                                        />
                                    </div>
                                );
                            })}

                            {/* Classification cell */}
                            <div className="w-28 px-2 py-2 text-right">
                                {classification && <ClassificationBadge classification={classification} />}
                            </div>
                        </div>

                        {/* Recursive children table (nested) */}
                        {isExpandable && isExpanded && (
                            <div className="bg-ws-bg/50">
                                <NestedLevel
                                    items={itemChildren}
                                    hierarchy={hierarchy}
                                    classificationMap={classificationMap}
                                    visibleFields={visibleFields}
                                    selectedItemId={selectedItemId}
                                    onRowSelect={onRowSelect}
                                    expandedIds={expandedIds}
                                    onToggleExpanded={onToggleExpanded}
                                    depth={depth + 1}
                                    maxDepth={maxDepth}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default DataTableImport;

