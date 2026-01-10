/**
 * Mapping Types
 *
 * Type definitions for CSV-to-event mapping rules.
 * Uses InterpretationOutput union for all rule outputs.
 */

/**
 * Context provided to mapping rules for interpretation.
 */
export interface MappingContext {
    /** The original CSV row text (task name / subitem description) */
    text: string;
    /** Status value from CSV if present */
    status?: string;
    /** Target date from CSV if present */
    targetDate?: string;
    /** Parent item title for context */
    parentTitle?: string;
    /** Stage name for context */
    stageName?: string;
    /** Additional metadata from CSV */
    metadata?: Record<string, unknown>;
}

/**
 * Action hint phase - when the hint is relevant in the workflow.
 * Aligned with email app's pre_reply/post_reply concept.
 *
 * - 'before_completion': Hint for work to do BEFORE marking the parent action complete
 * - 'after_completion': Hint for follow-up work AFTER completion
 */
export type ActionHintPhase = 'before_completion' | 'after_completion';

/**
 * Interpretation output union type.
 * Separates semantic parsing from event commitment.
 *
 * - fact_candidate: Observable outcomes (send meeting notes, submit invoice)
 * - work_event: Status-derived lifecycle events
 * - field_value: Extracted dates, assignees, etc.
 * - action_hint: Intended/preparatory work (request docs, prepare proposal)
 */
export type InterpretationOutput =
    | { kind: 'fact_candidate'; factKind: string; payload?: Record<string, unknown>; confidence: 'low' | 'medium' | 'high' }
    | { kind: 'work_event'; eventType: 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED'; source?: string }
    | { kind: 'field_value'; field: string; value: unknown; confidence: 'low' | 'medium' | 'high' }
    | { kind: 'action_hint'; hintType: 'request' | 'prepare' | 'coordinate' | 'setup' | 'communicate'; text: string; phase?: ActionHintPhase };

/**
 * A mapping rule that matches CSV text and produces interpretation outputs.
 */
export interface MappingRule {
    /** Unique identifier for this rule */
    id: string;
    /** Human-readable description */
    description: string;
    /** Pattern to match against the text (case-insensitive) */
    pattern: RegExp;
    /** Emits InterpretationOutput variants */
    emits: (ctx: MappingContext) => InterpretationOutput[];
    /** Priority - higher runs first (default: 0) */
    priority?: number;
    /** If true, stop processing further rules after this match */
    terminal?: boolean;
}

/**
 * Apply mapping rules to a context and return all matching outputs.
 * Rules are applied in priority order (highest first).
 * If a terminal rule matches, no further rules are processed.
 */
export function applyMappingRules(
    ctx: MappingContext,
    rules: MappingRule[]
): InterpretationOutput[] {
    const sortedRules = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const outputs: InterpretationOutput[] = [];

    for (const rule of sortedRules) {
        if (rule.pattern.test(ctx.text)) {
            const ruleOutputs = rule.emits(ctx);
            outputs.push(...ruleOutputs);

            if (rule.terminal) {
                break;
            }
        }
    }

    return outputs;
}

/**
 * Helper to extract a date from common CSV date formats.
 */
export function extractDateFromContext(ctx: MappingContext): string | undefined {
    if (ctx.targetDate) {
        // Try to parse and return ISO format
        const date = new Date(ctx.targetDate);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
    }
    return undefined;
}
