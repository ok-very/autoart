import { AlertTriangle, HelpCircle, Check, Play, Lightbulb, FileText, Inbox } from 'lucide-react';
import type { InterpretationOutput, ClassificationSuggestion } from '../../api/hooks/imports';
import { humanizeFactKind } from '../../utils/formatFactKind';
import { PendingResolution } from './types';

/** Check if a suggestion is currently selected */
export function isSuggestionSelected(suggestion: ClassificationSuggestion, pending?: PendingResolution): boolean {
    if (suggestion.factKind) {
        return pending?.factKind === suggestion.factKind;
    }
    if (suggestion.hintType) {
        return pending?.hintType === suggestion.hintType;
    }
    return false;
}


export function getConfidenceColor(confidence: string): string {
    switch (confidence) {
        case 'high': return 'bg-green-100 text-green-700';
        case 'medium': return 'bg-amber-100 text-amber-700';
        case 'low': return 'bg-red-100 text-red-700';
        default: return 'bg-slate-100 text-slate-600';
    }
}

export function getOutcomeIcon(outcome: string) {
    switch (outcome) {
        case 'AMBIGUOUS': return AlertTriangle;
        case 'UNCLASSIFIED': return HelpCircle;
        case 'FACT_EMITTED': return Check;
        case 'INTERNAL_WORK': return Lightbulb;
        case 'DERIVED_STATE': return Play;
        default: return HelpCircle;
    }
}

/** Component that renders the appropriate outcome icon */
export function OutcomeIcon({ outcome, className }: { outcome: string; className?: string }) {
    switch (outcome) {
        case 'AMBIGUOUS': return <AlertTriangle className={className} />;
        case 'UNCLASSIFIED': return <HelpCircle className={className} />;
        case 'FACT_EMITTED': return <Check className={className} />;
        case 'INTERNAL_WORK': return <Lightbulb className={className} />;
        case 'DERIVED_STATE': return <Play className={className} />;
        default: return <HelpCircle className={className} />;
    }
}

export function getOutputKindBadge(output: InterpretationOutput) {
    switch (output.kind) {
        case 'fact_candidate':
            return { label: humanizeFactKind(output.factKind), color: 'bg-green-100 text-green-700', icon: FileText };
        case 'action_hint':
            return { label: output.hintType?.charAt(0).toUpperCase() + (output.hintType?.slice(1) ?? ''), color: 'bg-amber-100 text-amber-700', icon: Lightbulb };
        case 'work_event':
            return { label: humanizeFactKind(output.eventType), color: 'bg-blue-100 text-blue-700', icon: Play };
        case 'field_value':
            return { label: output.field, color: 'bg-purple-100 text-purple-700', icon: Inbox };
        default:
            return { label: 'unknown', color: 'bg-slate-100 text-slate-600', icon: HelpCircle };
    }
}

/** Format suggestion label - prefer inferredLabel, then humanize fact kinds */
export function formatSuggestionLabel(suggestion: ClassificationSuggestion): string {
    // Use inferred label if available (human-readable from inference)
    if (suggestion.inferredLabel) {
        return suggestion.inferredLabel;
    }
    if (suggestion.factKind) {
        return humanizeFactKind(suggestion.factKind);
    }
    if (suggestion.hintType) {
        // Capitalize first letter: 'request' -> 'Request'
        return suggestion.hintType.charAt(0).toUpperCase() + suggestion.hintType.slice(1);
    }
    return 'Unknown';
}
