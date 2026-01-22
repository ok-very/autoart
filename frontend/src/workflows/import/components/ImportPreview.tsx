/**
 * Import Preview
 *
 * Renders the import plan using the selected projection.
 * Delegates to HierarchyPreview, StagePreview, TablePreview, or LogPreview.
 */

import { FileQuestion } from 'lucide-react';

import { HierarchyPreview } from './HierarchyPreview';
import { LogPreview } from './LogPreview';
import { StagePreview } from './StagePreview';
import { TablePreview } from './TablePreview';
import type { ImportPlan } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

interface ImportPreviewProps {
    plan: ImportPlan | null;
    projectionId: string;
    selectedRecordId: string | null;
    onRecordSelect: (recordId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportPreview({
    plan,
    projectionId,
    selectedRecordId,
    onRecordSelect,
}: ImportPreviewProps) {
    // Empty state
    if (!plan) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <FileQuestion className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No import session</p>
                    <p className="text-sm text-slate-400 mt-1">
                        Upload a file to preview its contents
                    </p>
                </div>
            </div>
        );
    }

    // No items
    if (plan.items.length === 0 && plan.containers.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <FileQuestion className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No items found</p>
                    <p className="text-sm text-slate-400 mt-1">
                        The parser did not detect any importable items
                    </p>
                </div>
            </div>
        );
    }

    // Render based on projection
    switch (projectionId) {
        case 'hierarchy-projection':
            return (
                <HierarchyPreview
                    plan={plan}
                    selectedRecordId={selectedRecordId}
                    onSelect={onRecordSelect}
                />
            );

        case 'stage-projection':
            return (
                <StagePreview
                    plan={plan}
                    selectedRecordId={selectedRecordId}
                    onSelect={onRecordSelect}
                />
            );

        case 'table-projection':
            return (
                <TablePreview
                    plan={plan}
                    selectedRecordId={selectedRecordId}
                    onSelect={onRecordSelect}
                />
            );

        case 'log-projection':
            return (
                <LogPreview
                    plan={plan}
                    selectedRecordId={selectedRecordId}
                    onSelect={onRecordSelect}
                />
            );

        default:
            return (
                <div className="p-6 text-center text-slate-500">
                    Unknown projection: {projectionId}
                </div>
            );
    }
}

export default ImportPreview;
