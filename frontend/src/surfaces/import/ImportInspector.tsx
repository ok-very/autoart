/**
 * ImportInspector
 *
 * @deprecated Use SelectionInspector with import_item selection type instead.
 * This component has been superseded by the unified SelectionInspector.
 * Import selection is now handled via uiStore.selectImportItem().
 *
 * Right inspector panel for Import Workbench.
 * Shows details of the selected import item.
 */

import { FileText, Tag, AlertCircle, Info } from 'lucide-react';

import type { ImportSession, ImportPlan } from '../../api/hooks/imports';
import { Text, Stack, Inline, Badge, Card } from '../../ui/atoms';

// ============================================================================
// TYPES
// ============================================================================

interface ImportInspectorProps {
    width: number;
    session: ImportSession | null;
    plan: ImportPlan | null;
    selectedItemId: string | null;
}

const OUTCOME_COLORS: Record<string, { bg: string; text: string }> = {
    FACT_EMITTED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    DERIVED_STATE: { bg: 'bg-blue-100', text: 'text-blue-700' },
    INTERNAL_WORK: { bg: 'bg-slate-100', text: 'text-slate-600' },
    EXTERNAL_WORK: { bg: 'bg-purple-100', text: 'text-purple-700' },
    AMBIGUOUS: { bg: 'bg-amber-100', text: 'text-amber-700' },
    UNCLASSIFIED: { bg: 'bg-red-100', text: 'text-red-700' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportInspector({
    width,
    session,
    plan,
    selectedItemId,
}: ImportInspectorProps) {
    // Find selected item
    const selectedItem = selectedItemId
        ? plan?.items.find((i) => i.tempId === selectedItemId) ||
        plan?.containers.find((c) => c.tempId === selectedItemId)
        : null;

    // Find classification for selected item
    const classification = selectedItemId
        ? plan?.classifications?.find((c) => c.itemTempId === selectedItemId)
        : null;

    // Empty state - no session
    if (!session) {
        return (
            <aside
                className="bg-white border-l border-slate-200 flex flex-col shrink-0"
                style={{ width }}
            >
                <div className="h-12 border-b border-slate-100 flex items-center justify-center px-4">
                    <Text size="xs" color="muted">Import Inspector</Text>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <Text size="sm" color="muted" className="text-center">
                        Start an import session to inspect items
                    </Text>
                </div>
            </aside>
        );
    }

    // Empty state - no selection
    if (!selectedItem) {
        return (
            <aside
                className="bg-white border-l border-slate-200 flex flex-col shrink-0"
                style={{ width }}
            >
                <div className="h-12 border-b border-slate-100 flex items-center justify-center px-4">
                    <Text size="xs" color="muted">Import Inspector</Text>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <Stack gap="sm" className="text-center">
                        <Info className="w-8 h-8 mx-auto text-slate-300" />
                        <Text size="sm" color="muted">
                            Select an item to view details
                        </Text>
                    </Stack>
                </div>
            </aside>
        );
    }

    const isContainer = 'type' in selectedItem && ['project', 'process', 'stage', 'subprocess'].includes((selectedItem as { type?: string }).type || '');

    return (
        <aside
            className="bg-white border-l border-slate-200 flex flex-col shrink-0"
            style={{ width }}
        >
            {/* Header */}
            <div className="h-12 border-b border-slate-100 flex items-center px-4">
                <Inline gap="sm">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <Text size="sm" weight="semibold">Item Details</Text>
                </Inline>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                <Stack gap="md">
                    {/* Title */}
                    <div>
                        <Text size="xs" weight="semibold" color="muted" className="uppercase mb-1">
                            Title
                        </Text>
                        <Text size="sm" weight="medium">
                            {selectedItem.title}
                        </Text>
                    </div>

                    {/* Type */}
                    <div>
                        <Text size="xs" weight="semibold" color="muted" className="uppercase mb-1">
                            Type
                        </Text>
                        <Badge variant="neutral" size="sm">
                            {isContainer
                                ? (selectedItem as { type?: string }).type || 'container'
                                : (selectedItem as { entityType?: string }).entityType || 'item'}
                        </Badge>
                    </div>

                    {/* Classification */}
                    {classification && (
                        <Card className="bg-slate-50">
                            <div className="p-3">
                                <Inline gap="xs" className="mb-2">
                                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                                    <Text size="xs" weight="semibold" color="muted" className="uppercase">
                                        Classification
                                    </Text>
                                </Inline>

                                <Stack gap="sm">
                                    {/* Outcome */}
                                    <div>
                                        <Text size="xs" color="muted">Outcome</Text>
                                        <Badge
                                            size="sm"
                                            className={`mt-0.5 ${OUTCOME_COLORS[classification.outcome]?.bg || 'bg-slate-100'
                                                } ${OUTCOME_COLORS[classification.outcome]?.text || 'text-slate-600'
                                                }`}
                                        >
                                            {classification.outcome.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>

                                    {/* Confidence */}
                                    {classification.confidence !== undefined && (
                                        <div>
                                            <Text size="xs" color="muted">Confidence</Text>
                                            <Text size="sm">
                                                {Math.round(classification.confidence * 100)}%
                                            </Text>
                                        </div>
                                    )}

                                    {/* Rationale */}
                                    {classification.rationale && (
                                        <div>
                                            <Text size="xs" color="muted">Rationale</Text>
                                            <Text size="sm" className="text-slate-600">
                                                {classification.rationale}
                                            </Text>
                                        </div>
                                    )}

                                    {/* Resolution */}
                                    {classification.resolution && (
                                        <div className="pt-2 border-t border-slate-200">
                                            <Text size="xs" color="muted">Resolution</Text>
                                            <Badge size="sm" variant="success" className="mt-0.5">
                                                {classification.resolution}
                                            </Badge>
                                        </div>
                                    )}
                                </Stack>
                            </div>
                        </Card>
                    )}

                    {/* Field Data */}
                    {selectedItem.fieldBindings && selectedItem.fieldBindings.length > 0 && (
                        <div>
                            <Text size="xs" weight="semibold" color="muted" className="uppercase mb-2">
                                Fields
                            </Text>
                            <Stack gap="xs">
                                {selectedItem.fieldBindings.map((binding: { fieldKey: string; value?: unknown }, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <Text size="sm" color="muted">{binding.fieldKey}</Text>
                                        <Text size="sm" className="truncate ml-2 max-w-32">
                                            {String(binding.value ?? '-')}
                                        </Text>
                                    </div>
                                ))}
                            </Stack>
                        </div>
                    )}

                    {/* Validation Issues */}
                    {plan?.validationIssues?.filter((v) => v.itemTempId === selectedItemId).length > 0 && (
                        <Card className="bg-red-50 border-red-200">
                            <div className="p-3">
                                <Inline gap="xs" className="mb-2">
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                    <Text size="xs" weight="semibold" className="text-red-700 uppercase">
                                        Issues
                                    </Text>
                                </Inline>
                                <Stack gap="xs">
                                    {plan.validationIssues
                                        .filter((v) => v.itemTempId === selectedItemId)
                                        .map((issue, idx) => (
                                            <Text key={idx} size="xs" className="text-red-600">
                                                {issue.message}
                                            </Text>
                                        ))}
                                </Stack>
                            </div>
                        </Card>
                    )}
                </Stack>
            </div>
        </aside>
    );
}

export default ImportInspector;
