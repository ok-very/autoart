/**
 * Hierarchy Preview
 *
 * Renders import plan as a hierarchical table using NestedDataTable.
 * Each hierarchy level gets its own column headers based on available fields.
 * Supports both flat view (DataTableImport) and nested view (NestedDataTable).
 */

import { useState, useMemo, useCallback } from 'react';
import { LayoutGrid, Layers } from 'lucide-react';

import type { ImportPlan, ItemClassification } from '../../../api/hooks/imports';
import {
    DataTableImport,
    NestedDataTable,
    discoverImportFields,
} from '../../../ui/composites/DataTableImport';

// ============================================================================
// PROPS
// ============================================================================

interface HierarchyPreviewProps {
    plan: ImportPlan;
    selectedRecordId: string | null;
    onSelect: (recordId: string) => void;
    /** View mode: 'flat' (traditional) or 'nested' (per-level headers) */
    viewMode?: 'flat' | 'nested';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HierarchyPreview({
    plan,
    selectedRecordId,
    onSelect,
    viewMode: initialViewMode = 'nested',
}: HierarchyPreviewProps) {
    // View mode toggle
    const [viewMode, setViewMode] = useState<'flat' | 'nested'>(initialViewMode);

    // Discover fields from plan data
    const discoveredFields = useMemo(() => discoverImportFields(plan), [plan]);

    // Visible fields state - default to top 5 most common
    const [visibleFields, setVisibleFields] = useState<Set<string>>(() => {
        const defaultFields = discoveredFields.slice(0, 5).map(f => f.fieldName);
        return new Set(defaultFields);
    });

    // Expansion state - start with all expanded
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
        const ids = new Set<string>();
        for (const container of plan.containers) {
            ids.add(container.tempId);
        }
        for (const item of plan.items) {
            ids.add(item.tempId);
        }
        return ids;
    });

    // Build classification map for nested view
    const classificationMap = useMemo(() => {
        return new Map<string, ItemClassification>(
            plan.classifications?.map(c => [c.itemTempId, c]) ?? []
        );
    }, [plan.classifications]);

    // DEBUG
    console.log('[HierarchyPreview] Render:', {
        viewMode,
        itemCount: plan.items.length,
        containerCount: plan.containers.length,
        fieldCount: discoveredFields.length,
        visibleFieldCount: visibleFields.size,
    });

    // Handle field visibility toggle
    const handleToggleField = useCallback((fieldName: string) => {
        setVisibleFields(prev => {
            const next = new Set(prev);
            if (next.has(fieldName)) {
                next.delete(fieldName);
            } else {
                next.add(fieldName);
            }
            return next;
        });
    }, []);

    // Handle expansion toggle
    const handleToggleExpanded = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar with view mode toggle */}
            <div className="flex items-center justify-end px-3 py-2 border-b border-ws-panel-border bg-ws-panel-bg gap-2">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode('flat')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'flat'
                            ? 'bg-ws-panel-bg shadow-sm text-ws-text-secondary'
                            : 'text-ws-muted hover:text-ws-text-secondary'
                            }`}
                        title="Flat view (traditional)"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('nested')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'nested'
                            ? 'bg-ws-panel-bg shadow-sm text-ws-text-secondary'
                            : 'text-ws-muted hover:text-ws-text-secondary'
                            }`}
                        title="Nested view (per-level headers)"
                    >
                        <Layers className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Table content */}
            <div className="flex-1 overflow-auto p-3">
                {viewMode === 'flat' ? (
                    <DataTableImport
                        plan={plan}
                        fields={discoveredFields}
                        visibleFields={visibleFields}
                        onToggleField={handleToggleField}
                        selectedItemId={selectedRecordId}
                        onRowSelect={onSelect}
                        expandedIds={expandedIds}
                        onToggleExpanded={handleToggleExpanded}
                    />
                ) : (
                    <NestedDataTable
                        items={plan.items}
                        classificationMap={classificationMap}
                        visibleFields={visibleFields}
                        selectedItemId={selectedRecordId}
                        onRowSelect={onSelect}
                        expandedIds={expandedIds}
                        onToggleExpanded={handleToggleExpanded}
                    />
                )}
            </div>
        </div>
    );
}

export default HierarchyPreview;

