import { Check, ChevronRight, FileText, Lightbulb, Clock, Sparkles } from 'lucide-react';
import type { ItemClassification, ClassificationSuggestion } from '../../../api/hooks/imports';
import type { PendingResolution } from '../types';
import { OUTCOME_OPTIONS } from '../constants';
import { OutcomeIcon, getOutputKindBadge, formatSuggestionLabel, getConfidenceColor, isSuggestionSelected } from '../utils';
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

                <div className="flex-1 min-w-0">
                    <p className="font-medium text-ws-fg truncate">{itemTitle}</p>
                    <p className="text-xs text-ws-text-secondary truncate">{classification.rationale}</p>
                </div>

                {/* Output kind badges */}
                <div className="flex items-center gap-1.5">
                    {outputs.slice(0, 2).map((output, idx) => {
                        const badge = getOutputKindBadge(output);
                        const Icon = badge.icon;
                        return (
                            <span key={idx} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
                                <Icon className="w-3 h-3" />
                                {badge.label}
                            </span>
                        );
                    })}
                    {outputs.length > 2 && (
                        <span className="text-[10px] text-ws-muted bg-slate-100 px-1.5 py-0.5 rounded">
                            +{outputs.length - 2} more
                        </span>
                    )}
                </div>

                {/* Inline Pending Resolution Status */}
                {pending && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100 animate-in fade-in zoom-in duration-200">
                        {pending.outcome === 'DEFERRED' ? (
                            <span className="text-xs font-medium text-ws-text-secondary flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                Deferred
                            </span>
                        ) : (
                            <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                                <Check className="w-3 h-3" />
                                <span className="font-semibold">{pending.outcome === 'FACT_EMITTED' ? 'Emit Fact' : pending.outcome}</span>
                                {pending.factKind && (
                                    <span className="text-amber-600">
                                        → {humanizeFactKind(pending.factKind)}
                                    </span>
                                )}
                            </span>
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
                <div className="px-6 py-4 bg-ws-bg border-t border-ws-panel-border space-y-4">

                    {/* Resolution Section - if unresolved */}
                    {needsResolution && (
                        <div className="bg-ws-panel-bg p-4 rounded-lg border border-ws-panel-border shadow-sm">
                            <h4 className="text-sm font-semibold text-ws-text-secondary mb-3 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                Suggested Resolutions
                            </h4>

                            {/* Suggestions List */}
                            {suggestions && suggestions.length > 0 && (
                                <div className="space-y-3 mb-4">
                                    <p className="text-xs text-ws-text-secondary mb-2">Based on analysis:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.map((suggestion, idx) => {
                                            const label = formatSuggestionLabel(suggestion);
                                            const isSelected = isSuggestionSelected(suggestion, pending);

                                            // Determine context for icon
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
                                                    {/* Rule source tag */}
                                                    <span className={`text-[9px] px-1 py-0.5 rounded ${isSelected ? 'bg-ws-panel-bg/10 text-white/70' : 'bg-slate-100 text-ws-text-secondary'
                                                        }`}>
                                                        [{formatRuleSource(suggestion.ruleSource ?? '')}]
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Outcome selection (only for items needing resolution) */}
                            <div>
                                <p className="text-xs font-medium text-ws-text-secondary mb-2">
                                    Resolve as:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {OUTCOME_OPTIONS.map((option) => {
                                        const Icon = option.icon;
                                        const isSelected = pending?.outcome === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOutcomeSelect(option.value);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${isSelected
                                                    ? 'bg-slate-800 text-white border-slate-800'
                                                    : 'bg-ws-panel-bg text-ws-text-secondary border-ws-panel-border hover:border-slate-400'
                                                    }`}
                                            >
                                                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : option.color}`} />
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Custom fact kind input - appears when FACT_EMITTED is selected */}
                                {pending?.outcome === 'FACT_EMITTED' && !pending?.factKind && (
                                    <div className="mt-3 pt-3 border-t border-ws-panel-border">
                                        <label className="block text-xs font-medium text-ws-text-secondary mb-1.5">
                                            Or enter a custom fact type:
                                        </label>
                                        <input
                                            type="text"
                                            value={pending?.customFactLabel ?? ''}
                                            onChange={(e) => onCustomFactLabelChange(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="e.g., Fee Proposal Submitted"
                                            className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-ws-muted"
                                        />
                                        {pending?.customFactLabel && (
                                            <p className="mt-1.5 text-xs text-ws-text-secondary">
                                                Will be stored as: <code className="bg-slate-100 px-1 py-0.5 rounded text-ws-text-secondary">{toFactKindKey(pending.customFactLabel)}</code>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Resolved status */}
                    {classification.resolution && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                            <Check className="w-4 h-4" />
                            Resolved as: {classification.resolution.resolvedOutcome}
                            {classification.resolution.resolvedFactKind && (
                                <span className="font-medium">({classification.resolution.resolvedFactKind})</span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
