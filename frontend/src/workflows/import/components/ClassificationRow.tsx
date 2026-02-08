import { Check, ChevronRight, FileText, Lightbulb, Clock, Sparkles } from 'lucide-react';
import {
    Stack,
    Inline,
    Text,
    Badge,
    Button,
    Card,
    Label,
    TextInput,
} from '@autoart/ui';
import type { ItemClassification, ClassificationSuggestion } from '../../../api/hooks/imports';
import type { PendingResolution } from '../types';
import { OUTCOME_OPTIONS } from '../constants';
import { OutcomeIcon, getOutputKindBadge, formatSuggestionLabel, getConfidenceColor, isSuggestionSelected, getOutcomeLabel } from '../utils';
import { toFactKindKey, formatRuleSource, humanizeFactKind } from '../../../utils/formatFactKind';

interface ClassificationRowProps {
    classification: ItemClassification;
    itemTitle: string;
    isExpanded: boolean;
    onToggle: () => void;
    pending?: PendingResolution;
    onOutcomeSelect: (outcome: PendingResolution['outcome']) => void;
    onFactKindSelect: (factKind: string) => void;
    onHintTypeSelect: (hintType: string) => void;
    onCustomFactLabelChange: (label: string) => void;
    suggestions?: ClassificationSuggestion[];
}

export function ClassificationRow({
    classification,
    itemTitle,
    isExpanded,
    onToggle,
    pending,
    onOutcomeSelect,
    onFactKindSelect,
    onHintTypeSelect,
    onCustomFactLabelChange,
    suggestions,
}: ClassificationRowProps) {
    const needsResolution = !classification.resolution &&
        (classification.outcome === 'AMBIGUOUS' || classification.outcome === 'UNCLASSIFIED');

    // Get outputs from interpretation plan
    const outputs = classification.interpretationPlan?.outputs ?? [];

    // Check if row has expandable content
    const hasExpandableContent = needsResolution ||
        outputs.length > 0 ||
        classification.candidates?.length ||
        (suggestions && suggestions.length > 0) ||
        classification.resolution;

    // Only allow toggle if there's content to show
    const handleRowClick = () => {
        if (hasExpandableContent) {
            onToggle();
        }
    };

    return (
        <div className={`border-b border-ws-panel-border last:border-b-0 ${needsResolution
            ? 'bg-red-50/60 border-l-4 border-l-red-400'
            : ''
            }`}>
            {/* Item row */}
            <div
                className={`flex items-center gap-3 px-6 py-3 ${hasExpandableContent ? 'hover:bg-ws-bg cursor-pointer' : ''}`}
                onClick={handleRowClick}
            >
                <OutcomeIcon
                    outcome={classification.outcome}
                    className={`w-4 h-4 flex-shrink-0 ${needsResolution ? 'text-amber-600' : 'text-ws-muted'}`}
                />

                <Stack gap="none" className="flex-1 min-w-0">
                    <Text weight="medium" truncate>{itemTitle}</Text>
                    <Text size="xs" color="muted" truncate>{classification.rationale}</Text>
                </Stack>

                {/* Output kind badges */}
                <Inline gap="xs" wrap={false}>
                    {outputs.slice(0, 2).map((output, idx) => {
                        const badge = getOutputKindBadge(output);
                        const Icon = badge.icon;
                        return (
                            <Badge key={idx} size="xs" className={badge.color}>
                                <Inline gap="xs" wrap={false}>
                                    <Icon className="w-3 h-3" />
                                    {badge.label}
                                </Inline>
                            </Badge>
                        );
                    })}
                    {outputs.length > 2 && (
                        <Badge size="xs" variant="neutral">
                            +{outputs.length - 2} more
                        </Badge>
                    )}
                </Inline>

                {/* Inline Pending Resolution Status */}
                {pending?.outcome && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100 animate-in fade-in zoom-in duration-200">
                        {pending.outcome === 'DEFERRED' ? (
                            <Inline gap="xs" wrap={false}>
                                <Clock className="w-3 h-3" />
                                <Text size="xs" weight="medium" color="muted">Deferred</Text>
                            </Inline>
                        ) : (
                            <Inline gap="xs" wrap={false} className="text-amber-700">
                                <Check className="w-3 h-3" />
                                <Text size="xs" weight="semibold" className="text-amber-700">{getOutcomeLabel(pending.outcome)}</Text>
                                {pending.factKind && (
                                    <Text size="xs" className="text-amber-600">
                                        → {humanizeFactKind(pending.factKind)}
                                    </Text>
                                )}
                            </Inline>
                        )}
                    </div>
                )}

                {/* Expand/Collapse Chevron */}
                {hasExpandableContent && (
                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                        <ChevronRight className="w-4 h-4 text-ws-muted" />
                    </div>
                )}
            </div>

            {/* Expanded details */}
            {isExpanded && hasExpandableContent && (
                <Stack gap="md" className="px-6 py-4 bg-ws-bg border-t border-ws-panel-border">

                    {/* Resolution Section - if unresolved */}
                    {needsResolution && (
                        <Card padding="md" radius="md" shadow="sm">
                            <Inline gap="sm" className="mb-3">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                <Text weight="semibold" size="sm" color="muted">Suggested Resolutions</Text>
                            </Inline>

                            {/* Suggestions List */}
                            {suggestions && suggestions.length > 0 && (
                                <Stack gap="sm" className="mb-4">
                                    <Text size="xs" color="muted">Based on analysis:</Text>
                                    <Inline gap="sm" wrap>
                                        {suggestions.map((suggestion, idx) => {
                                            const label = formatSuggestionLabel(suggestion);
                                            const isSelected = isSuggestionSelected(suggestion, pending);
                                            const isFactCandidate = !!suggestion.factKind;

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (suggestion.factKind) {
                                                            onFactKindSelect(suggestion.factKind);
                                                        } else if (suggestion.hintType) {
                                                            onHintTypeSelect(suggestion.hintType);
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${isSelected
                                                        ? 'bg-emerald-500 text-white border-emerald-500'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400'
                                                        }`}
                                                    title={suggestion.reason}
                                                >
                                                    {isFactCandidate ? (
                                                        <FileText className="w-3 h-3" />
                                                    ) : (
                                                        <Lightbulb className="w-3 h-3" />
                                                    )}
                                                    <span className="font-medium">{label}</span>
                                                    <span className={`text-[10px] px-1 py-0.5 rounded ${isSelected
                                                        ? 'bg-ws-panel-bg/20 text-white'
                                                        : getConfidenceColor(suggestion.confidence)
                                                        }`}>
                                                        {suggestion.matchScore}%
                                                    </span>
                                                    <span className={`text-[9px] px-1 py-0.5 rounded ${isSelected ? 'bg-ws-panel-bg/10 text-white/70' : 'bg-slate-100 text-ws-text-secondary'
                                                        }`}>
                                                        [{formatRuleSource(suggestion.ruleSource ?? '')}]
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </Inline>
                                </Stack>
                            )}

                            {/* Outcome selection (only for items needing resolution) */}
                            <Stack gap="sm">
                                <Text size="xs" weight="medium" color="muted">
                                    Resolve as:
                                </Text>
                                <Inline gap="sm" wrap>
                                    {OUTCOME_OPTIONS.map((option) => {
                                        const Icon = option.icon;
                                        const isSelected = pending?.outcome === option.value;
                                        return (
                                            <Button
                                                key={option.value}
                                                variant={isSelected ? 'primary' : 'secondary'}
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOutcomeSelect(option.value);
                                                }}
                                                leftSection={<Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : option.color}`} />}
                                                className={isSelected ? 'bg-slate-800 border-slate-800 hover:bg-slate-700' : ''}
                                            >
                                                {option.label}
                                            </Button>
                                        );
                                    })}
                                </Inline>

                                {/* Custom fact kind input - appears when FACT_EMITTED is selected */}
                                {pending?.outcome === 'FACT_EMITTED' && !pending?.factKind && (
                                    <Stack gap="xs" className="mt-3 pt-3 border-t border-ws-panel-border">
                                        <Label size="sm">Or enter a custom fact type:</Label>
                                        <TextInput
                                            size="sm"
                                            value={pending?.customFactLabel ?? ''}
                                            onChange={(e) => onCustomFactLabelChange(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="e.g., Fee Proposal Submitted"
                                        />
                                        {pending?.customFactLabel && (
                                            <Text size="xs" color="muted">
                                                Will be stored as: <code className="bg-slate-100 px-1 py-0.5 rounded text-ws-text-secondary">{toFactKindKey(pending.customFactLabel)}</code>
                                            </Text>
                                        )}
                                    </Stack>
                                )}
                            </Stack>
                        </Card>
                    )}

                    {/* Resolved status */}
                    {classification.resolution && (
                        <Inline gap="sm">
                            <Check className="w-4 h-4 text-green-700" />
                            <Text size="sm" color="success">
                                Resolved as: {classification.resolution.resolvedOutcome}
                            </Text>
                            {classification.resolution.resolvedFactKind && (
                                <Text size="sm" weight="medium" color="success">
                                    ({classification.resolution.resolvedFactKind})
                                </Text>
                            )}
                        </Inline>
                    )}
                </Stack>
            )}
        </div>
    );
}
