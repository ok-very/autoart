/**
 * ImportItemDetailsView
 *
 * Renders import item details within SelectionInspector.
 * Used when selection.type === 'import_item'.
 *
 * Shows:
 * - Item title and type
 * - Classification (outcome, confidence, rationale, resolution)
 * - Field recordings with renderHint styling
 * - Validation issues
 */

import { Tag, AlertCircle, List, CheckCircle2, User, Calendar, Hash, FileText } from 'lucide-react';

import { useUIStore } from '../../stores/uiStore';
import { Text, Stack, Inline, Badge, Card } from '@autoart/ui';
import type { InspectorTabId } from '../../types/ui';
import type { ImportPlanItem, ImportPlan } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

interface ImportItemDetailsViewProps {
    itemId: string;
    tab: InspectorTabId;
    /** Optional plan to use instead of reading from uiStore */
    plan?: ImportPlan | null;
}

interface FieldRecording {
    fieldName: string;
    value: unknown;
    renderHint?: string;
}

// ============================================================================
// STYLES
// ============================================================================

const OUTCOME_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    FACT_EMITTED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    DERIVED_STATE: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    INTERNAL_WORK: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
    EXTERNAL_WORK: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    AMBIGUOUS: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    UNCLASSIFIED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

const STATUS_COLORS: Record<string, string> = {
    'done': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'completed': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'in progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'working on it': 'bg-blue-100 text-blue-700 border-blue-200',
    'stuck': 'bg-red-100 text-red-700 border-red-200',
    'not started': 'bg-slate-100 text-slate-500 border-slate-200',
    'pending': 'bg-amber-100 text-amber-700 border-amber-200',
};

// ============================================================================
// FIELD VALUE RENDERER
// ============================================================================

function FieldValue({ value, renderHint }: { value: unknown; renderHint?: string }) {
    if (value == null || value === '' || String(value) === 'null') {
        return <span className="text-slate-300 italic text-xs">Empty</span>;
    }

    const strValue = String(value);

    switch (renderHint) {
        case 'status': {
            const colorClass = STATUS_COLORS[strValue.toLowerCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200';
            return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${colorClass}`}>
                    <CheckCircle2 className="w-3 h-3" />
                    {strValue}
                </span>
            );
        }

        case 'date':
            return (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {strValue}
                </span>
            );

        case 'person':
            return (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="truncate max-w-[120px]" title={strValue}>{strValue}</span>
                </span>
            );

        case 'number':
            return (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-700">
                    <Hash className="w-3 h-3 text-slate-400" />
                    {strValue}
                </span>
            );

        case 'text':
        case 'longtext':
            return (
                <span className="text-xs text-slate-600 line-clamp-2" title={strValue}>
                    {strValue}
                </span>
            );

        default:
            return (
                <span className="text-xs text-slate-600 truncate max-w-[160px]" title={strValue}>
                    {strValue}
                </span>
            );
    }
}

function FieldIcon({ renderHint }: { renderHint?: string }) {
    switch (renderHint) {
        case 'status':
            return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
        case 'date':
            return <Calendar className="w-3.5 h-3.5 text-slate-400" />;
        case 'person':
            return <User className="w-3.5 h-3.5 text-slate-400" />;
        case 'number':
            return <Hash className="w-3.5 h-3.5 text-slate-400" />;
        default:
            return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
}

// ============================================================================
// SECTION COMPONENTS
// ============================================================================

function SectionHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count?: number }) {
    return (
        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Icon className="w-3.5 h-3.5 text-slate-400" />
            <Text size="xs" weight="semibold" color="muted" className="uppercase tracking-wide">
                {label}
            </Text>
            {count !== undefined && (
                <span className="ml-auto text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {count}
                </span>
            )}
        </div>
    );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportItemDetailsView({ itemId, tab, plan: propPlan }: ImportItemDetailsViewProps) {
    const { importPlan: storePlan } = useUIStore();

    // Use prop plan if provided, otherwise fall back to store
    const importPlan = propPlan ?? storePlan;

    // Find selected item from plan
    const selectedItem = importPlan?.items.find((i) => i.tempId === itemId) ||
        importPlan?.containers.find((c) => c.tempId === itemId) ||
        null;

    // Find classification for selected item
    const classification = importPlan?.classifications?.find((c) => c.itemTempId === itemId) || null;

    // Find validation issues for selected item
    const validationIssues = importPlan?.validationIssues?.filter((v) => v.recordTempId === itemId) || [];

    if (!selectedItem) {
        return (
            <div className="flex items-center justify-center h-full">
                <Text size="sm" color="muted">Item not found in import plan</Text>
            </div>
        );
    }

    const isContainer = 'type' in selectedItem && ['project', 'process', 'stage', 'subprocess'].includes((selectedItem as { type?: string }).type || '');
    const isItem = 'fieldRecordings' in selectedItem;

    // Get field recordings with proper typing
    const fieldRecordings: FieldRecording[] = isItem
        ? ((selectedItem as ImportPlanItem).fieldRecordings || [])
        : [];

    // Group fields by renderHint for better organization
    const groupedFields = fieldRecordings.reduce((acc, field) => {
        const group = field.renderHint || 'other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(field);
        return acc;
    }, {} as Record<string, FieldRecording[]>);

    // Priority order for field groups
    const groupOrder = ['status', 'person', 'date', 'number', 'text', 'other'];
    const orderedGroups = groupOrder.filter(g => groupedFields[g]?.length);

    // Render based on active tab
    if (tab === 'import_classification') {
        return (
            <Stack gap="md">
                {classification ? (
                    <div className="space-y-4">
                        {/* Outcome Badge */}
                        <Card className={`${OUTCOME_COLORS[classification.outcome]?.bg || 'bg-slate-50'} border ${OUTCOME_COLORS[classification.outcome]?.border || 'border-slate-200'}`}>
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <Text size="xs" color="muted" className="uppercase tracking-wide mb-1">Outcome</Text>
                                        <Badge
                                            size="sm"
                                            className={`${OUTCOME_COLORS[classification.outcome]?.bg || 'bg-slate-100'} ${OUTCOME_COLORS[classification.outcome]?.text || 'text-slate-600'} font-bold`}
                                        >
                                            {classification.outcome.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                    {classification.resolution && (
                                        <Badge size="sm" variant="success" className="flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Resolved
                                        </Badge>
                                    )}
                                </div>

                                {/* Confidence */}
                                {classification.confidence && (
                                    <div className="mb-3">
                                        <Text size="xs" color="muted" className="uppercase tracking-wide mb-1">Confidence</Text>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${classification.confidence === 'high' ? 'bg-emerald-500 w-full' :
                                                        classification.confidence === 'medium' ? 'bg-amber-500 w-2/3' :
                                                            'bg-red-500 w-1/3'
                                                        }`}
                                                />
                                            </div>
                                            <Text size="xs" weight="medium" className="capitalize w-14">
                                                {classification.confidence}
                                            </Text>
                                        </div>
                                    </div>
                                )}

                                {/* Rationale */}
                                {classification.rationale && (
                                    <div>
                                        <Text size="xs" color="muted" className="uppercase tracking-wide mb-1">Rationale</Text>
                                        <Text size="sm" className="text-slate-600 leading-relaxed">
                                            {classification.rationale}
                                        </Text>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Resolution Details */}
                        {classification.resolution && (
                            <Card className="bg-emerald-50 border border-emerald-200">
                                <div className="p-4">
                                    <Text size="xs" color="muted" className="uppercase tracking-wide mb-2">Resolution</Text>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Text size="xs" color="muted">Resolved as:</Text>
                                            <Badge size="sm" variant="success">
                                                {classification.resolution.resolvedOutcome.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                        {classification.resolution.resolvedFactKind && (
                                            <div className="flex items-center gap-2">
                                                <Text size="xs" color="muted">Fact kind:</Text>
                                                <Text size="sm" weight="medium">{classification.resolution.resolvedFactKind}</Text>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                            <Tag className="w-6 h-6 text-slate-300" />
                        </div>
                        <Text size="sm" color="muted">No classification for this item</Text>
                        <Text size="xs" color="muted" className="mt-1">Run classification to analyze this item</Text>
                    </div>
                )}
            </Stack>
        );
    }

    if (tab === 'import_fields') {
        return (
            <Stack gap="md">
                {fieldRecordings.length > 0 ? (
                    <div className="space-y-4">
                        <SectionHeader icon={List} label="Field Recordings" count={fieldRecordings.length} />

                        {/* Grouped fields */}
                        {orderedGroups.map(group => (
                            <div key={group} className="space-y-1">
                                {groupedFields[group].length > 1 && (
                                    <Text size="xs" color="muted" className="uppercase tracking-wide text-[10px] pl-1">
                                        {group === 'other' ? 'Other Fields' : `${group}s`}
                                    </Text>
                                )}
                                <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100">
                                    {groupedFields[group].map((field, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-3 py-2.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FieldIcon renderHint={field.renderHint} />
                                                <Text size="sm" color="muted" className="truncate">
                                                    {field.fieldName}
                                                </Text>
                                            </div>
                                            <div className="ml-3 shrink-0">
                                                <FieldValue value={field.value} renderHint={field.renderHint} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                            <List className="w-6 h-6 text-slate-300" />
                        </div>
                        <Text size="sm" color="muted">No field data for this item</Text>
                        <Text size="xs" color="muted" className="mt-1">
                            {isContainer ? 'Containers don\'t have field data' : 'Import source had no fields'}
                        </Text>
                    </div>
                )}
            </Stack>
        );
    }

    // Default: import_details tab
    return (
        <Stack gap="lg">
            {/* Header Card */}
            <Card className="bg-gradient-to-br from-slate-50 to-white border border-slate-200">
                <div className="p-4">
                    <Text size="xs" color="muted" className="uppercase tracking-wide mb-1">Title</Text>
                    <Text size="md" weight="semibold" className="leading-snug">
                        {selectedItem.title}
                    </Text>
                    <div className="mt-3 flex items-center gap-2">
                        <Badge variant="neutral" size="sm" className="uppercase text-[10px] font-bold">
                            {isContainer
                                ? (selectedItem as { type?: string }).type || 'container'
                                : (selectedItem as { entityType?: string }).entityType || 'item'}
                        </Badge>
                        {classification && (
                            <Badge
                                size="sm"
                                className={`${OUTCOME_COLORS[classification.outcome]?.bg || 'bg-slate-100'} ${OUTCOME_COLORS[classification.outcome]?.text || 'text-slate-600'} text-[10px]`}
                            >
                                {classification.outcome.replace(/_/g, ' ')}
                            </Badge>
                        )}
                    </div>
                </div>
            </Card>

            {/* Quick Field Preview (top 3) */}
            {fieldRecordings.length > 0 && (
                <div>
                    <SectionHeader icon={List} label="Fields" count={fieldRecordings.length} />
                    <div className="mt-2 space-y-1.5">
                        {fieldRecordings.slice(0, 4).map((field, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded">
                                <div className="flex items-center gap-1.5">
                                    <FieldIcon renderHint={field.renderHint} />
                                    <Text size="xs" color="muted">{field.fieldName}</Text>
                                </div>
                                <FieldValue value={field.value} renderHint={field.renderHint} />
                            </div>
                        ))}
                        {fieldRecordings.length > 4 && (
                            <Text size="xs" color="muted" className="text-center py-1">
                                +{fieldRecordings.length - 4} more fields
                            </Text>
                        )}
                    </div>
                </div>
            )}

            {/* Validation Issues */}
            {validationIssues.length > 0 && (
                <Card className="bg-red-50 border border-red-200">
                    <div className="p-3">
                        <Inline gap="xs" className="mb-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            <Text size="xs" weight="semibold" className="text-red-700 uppercase tracking-wide">
                                Issues ({validationIssues.length})
                            </Text>
                        </Inline>
                        <Stack gap="xs">
                            {validationIssues.map((issue, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                    <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                                    <Text size="xs" className="text-red-600">
                                        {issue.message}
                                    </Text>
                                </div>
                            ))}
                        </Stack>
                    </div>
                </Card>
            )}
        </Stack>
    );
}

export default ImportItemDetailsView;
