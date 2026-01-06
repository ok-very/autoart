/**
 * Mapping Types
 *
 * Type definitions for CSV-to-event mapping rules.
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
 * Output from a mapping rule - describes an event to emit.
 */
export interface MappingOutput {
    /** The fact kind to emit (e.g., 'MEETING_HELD') */
    factKind: string;
    /** Additional payload fields extracted from the row */
    payload?: Record<string, unknown>;
    /** Confidence level of this interpretation */
    confidence: 'low' | 'medium' | 'high';
}

/**
 * A mapping rule that matches CSV text and produces event outputs.
 */
export interface MappingRule {
    /** Unique identifier for this rule */
    id: string;
    /** Human-readable description */
    description: string;
    /** Pattern to match against the text (case-insensitive) */
    pattern: RegExp;
    /** The fact kind(s) this rule emits */
    emits: (ctx: MappingContext) => MappingOutput[];
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
): MappingOutput[] {
    const sortedRules = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const outputs: MappingOutput[] = [];

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
