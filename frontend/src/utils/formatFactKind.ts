/**
 * Fact Kind Formatting Utilities
 *
 * Converts between SCREAMING_SNAKE_CASE (storage) and Title Case (display).
 */

/**
 * Convert SCREAMING_SNAKE_CASE to Title Case for display
 * @example humanizeFactKind('FEE_PROPOSAL_SUBMITTED') => 'Fee Proposal Submitted'
 */
export function humanizeFactKind(snakeCase: string): string {
    if (!snakeCase) return '';
    return snakeCase
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Convert human-readable label to SCREAMING_SNAKE_CASE for storage
 * @example toFactKindKey('Fee Proposal Submitted') => 'FEE_PROPOSAL_SUBMITTED'
 */
export function toFactKindKey(humanLabel: string): string {
    if (!humanLabel) return '';
    return humanLabel
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_');
}

/**
 * Format a rule source/ID for display
 * @example formatRuleSource('submit-final-report') => 'submit'
 */
export function formatRuleSource(ruleSource: string): string {
    if (!ruleSource) return '';
    // Extract first word/category from rule ID
    const category = ruleSource.split('-')[0];
    return category || ruleSource;
}
