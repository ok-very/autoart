/**
 * Classification Suggester
 *
 * Provides intelligent suggestions for UNCLASSIFIED items by:
 * 1. Running all mapping rules against the text
 * 2. Finding partial matches (similar patterns)
 * 3. Ranking by confidence
 *
 * This helps users quickly resolve UNCLASSIFIED items during import review.
 */

import { inferFactKind } from '../interpreter/fact-kind-inferrer.js';
import { defaultMappingRules } from '../interpreter/mappings/index.js';
import type { MappingRule, MappingContext } from '../interpreter/mappings/types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ClassificationSuggestion {
    /** Rule ID that would match */
    ruleId: string;
    /** Source rule file (e.g., 'decision-rules', 'intent-mapping-rules') */
    ruleSource: string;
    /** Suggested fact kind (for fact_candidate rules) */
    factKind?: string;
    /** Human-readable label for the fact kind (inferred from text) */
    inferredLabel?: string;
    /** Suggested hint type (for action_hint rules) */
    hintType?: string;
    /** Confidence level */
    confidence: 'low' | 'medium' | 'high';
    /** Human-readable reason for suggestion */
    reason: string;
    /** Match score 0-100 (higher = better match) */
    matchScore: number;
    /** Output kind from the rule */
    outputKind: 'fact_candidate' | 'action_hint' | 'work_event' | 'field_value';
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Generate suggestions for an unclassified item.
 * Returns top 3 suggestions ranked by match score.
 */
export function suggestClassificationsForText(
    text: string,
    context?: Partial<MappingContext>
): ClassificationSuggestion[] {
    const suggestions: ClassificationSuggestion[] = [];
    const normalizedText = text.toLowerCase();

    for (const rule of defaultMappingRules) {
        // Skip rules that would have matched exactly (already classified)
        if (rule.pattern.test(text)) {
            continue;
        }

        // Calculate similarity score
        const matchScore = calculatePatternSimilarity(normalizedText, rule);

        // Only consider partial matches above threshold
        if (matchScore >= 25) {
            const ctx: MappingContext = { text, ...context };

            try {
                const outputs = rule.emits(ctx);

                for (const output of outputs) {
                    if (output.kind === 'fact_candidate') {
                        suggestions.push({
                            ruleId: rule.id,
                            ruleSource: getRuleSource(rule.id),
                            factKind: output.factKind,
                            confidence: output.confidence,
                            reason: rule.description,
                            matchScore,
                            outputKind: 'fact_candidate',
                        });
                    } else if (output.kind === 'action_hint') {
                        suggestions.push({
                            ruleId: rule.id,
                            ruleSource: getRuleSource(rule.id),
                            hintType: output.hintType,
                            confidence: 'medium',
                            reason: rule.description,
                            matchScore,
                            outputKind: 'action_hint',
                        });
                    }
                }
            } catch {
                // Rule emitter threw - skip silently
            }
        }
    }

    // Deduplicate by fact kind / hint type (keep highest score)
    const deduped = deduplicateSuggestions(suggestions);

    // Sort by match score descending
    const sorted = deduped.sort((a, b) => b.matchScore - a.matchScore);

    // If no rule-based suggestions, add inferred suggestion from text
    if (sorted.length === 0 || sorted[0].matchScore < 40) {
        const inferred = inferFactKind(text);
        if (inferred.confidence >= 0.3) {
            sorted.push({
                ruleId: 'inferred',
                ruleSource: 'inferred',
                factKind: inferred.key,
                inferredLabel: inferred.label,
                confidence: inferred.confidence >= 0.6 ? 'medium' : 'low',
                reason: `Inferred from text: "${text.slice(0, 40)}..."`,
                matchScore: Math.round(inferred.confidence * 50), // Scale to 0-50 range
                outputKind: 'fact_candidate',
            });
        }
    }

    // Return top 3
    return sorted.slice(0, 3);
}

/**
 * Get suggestions for all unclassified items in a plan.
 */
export function suggestClassificationsForPlan(
    items: Array<{ tempId: string; title: string; metadata?: Record<string, unknown> }>,
    classifications: Array<{ itemTempId: string; outcome: string }>
): Map<string, ClassificationSuggestion[]> {
    const suggestions = new Map<string, ClassificationSuggestion[]>();

    for (const item of items) {
        const classification = classifications.find((c) => c.itemTempId === item.tempId);

        // Only suggest for UNCLASSIFIED items
        if (classification?.outcome === 'UNCLASSIFIED') {
            const metadata = item.metadata as Record<string, unknown> | undefined;
            const itemSuggestions = suggestClassificationsForText(item.title, {
                stageName: metadata?.['import.stage_name'] as string | undefined,
                status: metadata?.status as string | undefined,
            });

            if (itemSuggestions.length > 0) {
                suggestions.set(item.tempId, itemSuggestions);
            }
        }
    }

    return suggestions;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract rule source file from rule ID.
 * Rule IDs are prefixed with their source (e.g., "decision_MILESTONE_STATUS" -> "decision-rules")
 */
function getRuleSource(ruleId: string): string {
    const prefix = ruleId.split('_')[0];
    const RULE_SOURCE_MAP: Record<string, string> = {
        'decision': 'decision-rules',
        'meeting': 'meeting-rules',
        'process': 'process-rules',
        'document': 'document-rules',
        'invoice': 'invoice-rules',
        'communication': 'communication-rules',
        'intent': 'intent-mapping-rules',
    };
    return RULE_SOURCE_MAP[prefix] ?? prefix;
}

/**
 * Calculate similarity between text and rule pattern.
 * Uses keyword overlap scoring with weighting for important terms.
 */
function calculatePatternSimilarity(text: string, rule: MappingRule): number {
    // Extract keywords from pattern (strip regex special chars)
    const patternStr = rule.pattern.source
        .replace(/\\s\+|\\\*|\\\+|\\\?/g, ' ') // Regex escapes
        .replace(/[()[\]{}|^$]/g, ' ')          // Grouping chars
        .replace(/\\.?/g, '')                   // Escaped chars
        .toLowerCase();

    const patternKeywords = patternStr
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^[a-z]?\*?$/.test(w));

    if (patternKeywords.length === 0) return 0;

    // Count matches with position bonus (words at start weight more)
    let score = 0;
    let maxScore = patternKeywords.length * 10;

    for (let i = 0; i < patternKeywords.length; i++) {
        const keyword = patternKeywords[i];
        const positionWeight = i === 0 ? 2 : 1; // First keyword weights 2x

        if (text.includes(keyword)) {
            score += 10 * positionWeight;
        } else {
            // Check for partial match (prefix)
            const partial = patternKeywords[i].slice(0, 4);
            if (partial.length >= 3 && text.includes(partial)) {
                score += 3 * positionWeight;
            }
        }
    }

    // Adjust max score for position weights
    maxScore = patternKeywords.length * 10 + 10; // First keyword has extra weight

    return Math.round((score / maxScore) * 100);
}

/**
 * Deduplicate suggestions by fact kind / hint type, keeping highest score.
 */
function deduplicateSuggestions(suggestions: ClassificationSuggestion[]): ClassificationSuggestion[] {
    const seen = new Map<string, ClassificationSuggestion>();

    for (const s of suggestions) {
        const key = s.factKind ?? s.hintType ?? s.ruleId;
        const existing = seen.get(key);

        if (!existing || s.matchScore > existing.matchScore) {
            seen.set(key, s);
        }
    }

    return Array.from(seen.values());
}
