/**
 * Stage Preview
 *
 * Renders import plan grouped by stage labels (stage projection).
 * Does NOT imply stages are containers or persisted.
 */

import { Layers } from 'lucide-react';
import { useMemo } from 'react';

import type { ImportPlan, ImportPlanItem } from '../../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

interface StagePreviewProps {
    plan: ImportPlan;
    selectedRecordId: string | null;
    onSelect: (recordId: string) => void;
}

interface StageGroup {
    key: string;
    label: string;
    order: number;
    items: ImportPlanItem[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StagePreview({
    plan,
    selectedRecordId,
    onSelect,
}: StagePreviewProps) {
    // Group items by stage
    const stageGroups = useMemo(() => applyStageProjection(plan.items), [plan.items]);

    if (stageGroups.length === 0) {
        return (
            <div className="p-6 text-center text-slate-500">
                No items to display
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            {stageGroups.map((stage) => (
                <div
                    key={stage.key}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                >
                    {/* Stage header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-700">{stage.label}</h3>
                        <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                            {stage.items.length} items
                        </span>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-slate-100">
                        {stage.items.map((item) => (
                            <button
                                key={item.tempId}
                                onClick={() => onSelect(item.tempId)}
                                className={`w-full text-left px-4 py-3 transition-colors ${item.tempId === selectedRecordId
                                    ? 'bg-blue-50 border-l-2 border-blue-500'
                                    : 'hover:bg-slate-50'
                                    }`}
                            >
                                <div className="text-sm font-medium text-slate-800">
                                    {item.title}
                                </div>
                                {item.fieldRecordings.length > 0 && (
                                    <div className="text-xs text-slate-500 mt-1">
                                        {item.fieldRecordings
                                            .filter(f => f.value != null && String(f.value) !== 'null' && f.value !== '')
                                            .slice(0, 2)
                                            .map((f) => (
                                                <span key={f.fieldName} className="mr-2">
                                                    {f.fieldName}: {String(f.value).slice(0, 20)}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// STAGE PROJECTION (CLIENT-SIDE)
// ============================================================================

function applyStageProjection(items: ImportPlanItem[]): StageGroup[] {
    const groups = new Map<string, StageGroup>();

    for (const item of items) {
        const stageName = (item.metadata?.['import.stage_name'] as string) ?? 'Uncategorized';
        const stageOrder = (item.metadata?.['import.stage_order'] as number) ?? 999;

        if (!groups.has(stageName)) {
            groups.set(stageName, {
                key: stageName,
                label: stageName,
                order: stageOrder,
                items: [],
            });
        }

        groups.get(stageName)!.items.push(item);
    }

    return Array.from(groups.values()).sort((a, b) => a.order - b.order);
}

export default StagePreview;
