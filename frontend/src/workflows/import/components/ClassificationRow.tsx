import { Check, ChevronDown, FileText, Lightbulb, Sparkles } from 'lucide-react';
import type { ItemClassification, ClassificationSuggestion } from '../../../api/hooks/imports';
import type { PendingResolution } from '../types';
import { OUTCOME_OPTIONS } from '../constants';
import { OutcomeIcon, getOutputKindBadge, formatSuggestionLabel, isSuggestionSelected } from '../utils';
import { toFactKindKey, formatRuleSource, humanizeFactKind } from '../../../utils/formatFactKind';
import { Button, Badge, Text, TextInput, Stack, Inline } from '@autoart/ui';

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

    const outputs = classification.interpretationPlan?.outputs ?? [];

    const hasExpandableContent = needsResolution ||
        outputs.length > 0 ||
        classification.candidates?.length ||
        (suggestions && suggestions.length > 0) ||
        classification.resolution;

    const handleRowClick = () => {
        if (hasExpandableContent) {
            onToggle();
        }
    };

    return (
        <div className={`border-b border-ws-panel-border last:border-b-0 ${needsResolution
            ? 'bg-[color:var(--ws-color-error)]/5 border-l-4 border-l-[color:var(--ws-color-error)]'
            : ''
            }`}>
            {/* Item row */}
            <Inline
                gap="sm"
                align="center"
                wrap={false}
                className={`px-6 py-3 ${hasExpandableContent ? 'hover:bg-ws-row-expanded-bg cursor-pointer' : ''}`}
                onClick={handleRowClick}
            >
                <OutcomeIcon
                    outcome={classification.outcome}
                    className={`w-4 h-4 flex-shrink-0 ${needsResolution ? 'text-[var(--ws-color-warning)]' : 'text-ws-muted'}`}
                />

                <Stack gap="none" className="flex-1 min-w-0">
                    <Text size="sm" weight="semibold" truncate>{itemTitle}</Text>
                    <Text size="xs" color="dimmed" truncate>{classification.rationale}</Text>
                </Stack>

                {/* Output kind badges */}
                <Inline gap="xs" wrap={false}>
                    {outputs.slice(0, 2).map((output, idx) => {
                        const badge = getOutputKindBadge(output);
                        const Icon = badge.icon;
                        return (
                            <Badge key={idx} size="xs" variant="neutral" className={badge.color}>
                                <Inline gap="xs" align="center" wrap={false}>
                                    <Icon className="w-3 h-3" />
                                    {badge.label}
                                </Inline>
                            </Badge>
                        );
                    })}
                    {outputs.length > 2 && (
                        <Badge size="xs" variant="neutral">+{outputs.length - 2}</Badge>
                    )}
                </Inline>

                <Badge size="sm" variant={
                    classification.confidence === 'high' ? 'success'
                        : classification.confidence === 'medium' ? 'warning'
                            : 'error'
                }>
                    {classification.confidence}
                </Badge>

                <Badge size="sm" variant={needsResolution ? 'warning' : 'neutral'}>
                    {classification.outcome}
                </Badge>

                {pending?.outcome && (
                    <Badge size="sm" variant="success">
                        → {pending.outcome}
                        {pending.factKind && ` (${humanizeFactKind(pending.factKind)})`}
                        {pending.hintType && ` (${pending.hintType.charAt(0).toUpperCase() + pending.hintType.slice(1)})`}
                    </Badge>
                )}

                {hasExpandableContent ? (
                    <ChevronDown
                        className={`w-4 h-4 text-ws-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                ) : (
                    <div className="w-4 h-4" />
                )}
            </Inline>

            {/* Expanded details */}
            {isExpanded && hasExpandableContent && (
                <Stack gap="md" className="px-6 py-4 bg-ws-row-expanded-bg border-t border-ws-panel-border">

                    {/* Interpretation outputs */}
                    {outputs.length > 0 && (
                        <Stack gap="xs">
                            <Text size="xs" color="dimmed">Interpretation outputs:</Text>
                            <Inline gap="sm">
                                {outputs.map((output, idx) => {
                                    const badge = getOutputKindBadge(output);
                                    const Icon = badge.icon;
                                    return (
                                        <Inline key={idx} gap="xs" align="center" wrap={false}
                                            className={`px-3 py-1.5 rounded-lg border border-ws-panel-border ${badge.color}`}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            <Text size="sm">{badge.label}</Text>
                                            <Text size="xs" color="dimmed">({output.kind})</Text>
                                        </Inline>
                                    );
                                })}
                            </Inline>
                        </Stack>
                    )}

                    {/* Candidates for AMBIGUOUS items */}
                    {classification.candidates && classification.candidates.length > 0 && (
                        <Stack gap="xs">
                            <Text size="xs" color="dimmed">Possible fact kinds:</Text>
                            <Inline gap="sm">
                                {classification.candidates.map((candidate) => (
                                    <Button
                                        key={candidate}
                                        size="sm"
                                        variant={pending?.factKind === candidate ? 'primary' : 'secondary'}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onFactKindSelect(candidate);
                                            onOutcomeSelect('FACT_EMITTED');
                                        }}
                                        className="rounded-full"
                                    >
                                        {candidate}
                                    </Button>
                                ))}
                            </Inline>
                        </Stack>
                    )}

                    {/* Suggestions */}
                    {suggestions && suggestions.length > 0 && (
                        <Stack gap="xs">
                            <Inline gap="xs" align="center">
                                <Sparkles className="w-3 h-3 text-[var(--ws-color-success)]" />
                                <Text size="xs" className="text-[var(--ws-color-success)]">Suggested classifications:</Text>
                            </Inline>
                            <Inline gap="sm">
                                {suggestions.map((suggestion, idx) => {
                                    const label = formatSuggestionLabel(suggestion);
                                    const isSelected = isSuggestionSelected(suggestion, pending);
                                    const isFactCandidate = !!suggestion.factKind;

                                    return (
                                        <Button
                                            key={idx}
                                            size="sm"
                                            variant={isSelected ? 'primary' : 'light'}
                                            color={isSelected ? undefined : 'green'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (suggestion.factKind) {
                                                    onFactKindSelect(suggestion.factKind);
                                                    onOutcomeSelect('FACT_EMITTED');
                                                } else if (suggestion.hintType) {
                                                    onHintTypeSelect(suggestion.hintType);
                                                }
                                            }}
                                            title={suggestion.reason}
                                            leftSection={isFactCandidate
                                                ? <FileText className="w-3 h-3" />
                                                : <Lightbulb className="w-3 h-3" />
                                            }
                                        >
                                            {label}
                                            <Badge size="xs" variant={isSelected ? 'neutral' : (
                                                suggestion.confidence === 'high' ? 'success'
                                                    : suggestion.confidence === 'medium' ? 'warning'
                                                        : 'error'
                                            )} className={isSelected ? 'bg-white/20 text-white border-transparent' : ''}>
                                                {suggestion.matchScore}%
                                            </Badge>
                                            <Badge size="xs" variant="neutral"
                                                className={isSelected ? 'bg-white/10 text-white/70 border-transparent' : ''}
                                            >
                                                {formatRuleSource(suggestion.ruleSource ?? '')}
                                            </Badge>
                                        </Button>
                                    );
                                })}
                            </Inline>
                        </Stack>
                    )}

                    {/* Outcome selection */}
                    {needsResolution && (
                        <Stack gap="xs">
                            <Text size="xs" color="dimmed">Resolve as:</Text>
                            <Inline gap="sm">
                                {OUTCOME_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    const isSelected = pending?.outcome === option.value;
                                    return (
                                        <Button
                                            key={option.value}
                                            size="sm"
                                            variant={isSelected ? 'primary' : 'secondary'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOutcomeSelect(option.value);
                                            }}
                                            leftSection={<Icon className={`w-3.5 h-3.5 ${isSelected ? '' : option.color}`} />}
                                        >
                                            {option.label}
                                        </Button>
                                    );
                                })}
                            </Inline>

                            {/* Custom fact kind input */}
                            {pending?.outcome === 'FACT_EMITTED' && !pending?.factKind && (
                                <Stack gap="xs" className="mt-3 pt-3 border-t border-ws-panel-border">
                                    <TextInput
                                        label="Or enter a custom fact type"
                                        size="sm"
                                        value={pending?.customFactLabel ?? ''}
                                        onChange={(e) => onCustomFactLabelChange(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="e.g., Fee Proposal Submitted"
                                    />
                                    {pending?.customFactLabel && (
                                        <Text size="xs" color="dimmed">
                                            Will be stored as: <code className="bg-ws-mono-bg px-1 py-0.5 rounded text-ws-mono-fg font-mono">{toFactKindKey(pending.customFactLabel)}</code>
                                        </Text>
                                    )}
                                </Stack>
                            )}
                        </Stack>
                    )}

                    {/* Resolved status */}
                    {classification.resolution && (
                        <Inline gap="xs" align="center">
                            <Check className="w-4 h-4 text-[var(--ws-color-success)]" />
                            <Text size="sm" className="text-[var(--ws-color-success)]">
                                Resolved as: {classification.resolution.resolvedOutcome}
                                {classification.resolution.resolvedFactKind && (
                                    <Text as="span" weight="semibold"> ({classification.resolution.resolvedFactKind})</Text>
                                )}
                            </Text>
                        </Inline>
                    )}
                </Stack>
            )}
        </div>
    );
}
