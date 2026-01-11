/**
 * Budget Mapping Rules
 *
 * Rules for interpreting CSV rows as BUDGET_ALLOCATED events.
 * Captures: artwork budget, total budget, phase-specific allocations.
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

const BUDGET_ALLOCATED = 'BUDGET_ALLOCATED';

/**
 * Extract currency amount from text.
 * Handles: $50,000, $50K, 50000, CAD 50,000, etc.
 */
function extractAmount(text: string): { amount: number; currency: string } | null {
    // Pattern: $50,000 or $50K or CAD 50,000
    const patterns = [
        /\$\s*([\d,]+(?:\.\d{2})?)\s*([kK])?/,
        /(?:CAD|USD|EUR)\s*([\d,]+(?:\.\d{2})?)\s*([kK])?/i,
        /([\d,]+(?:\.\d{2})?)\s*([kK])?\s*(?:CAD|USD|dollars?)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let amount = parseFloat(match[1].replace(/,/g, ''));
            if (match[2]?.toLowerCase() === 'k') {
                amount *= 1000;
            }
            // Detect currency
            const currency = text.includes('USD') ? 'USD' :
                           text.includes('EUR') ? 'EUR' : 'CAD';
            return { amount, currency };
        }
    }

    // Standalone number (assume CAD)
    const numMatch = text.match(/\b(\d{4,})\b/);
    if (numMatch) {
        return { amount: parseFloat(numMatch[1]), currency: 'CAD' };
    }

    return null;
}

/**
 * Extract allocation type from text.
 */
function extractAllocationType(text: string): string {
    const lowerText = text.toLowerCase();

    // Artwork-specific
    if (lowerText.includes('artwork budget')) return 'artwork';
    if (lowerText.includes('art budget')) return 'artwork';
    if (lowerText.includes('artist fee')) return 'artist_fee';
    if (lowerText.includes('honorarium')) return 'honorarium';

    // Phase-specific
    if (/phase\s*1|stage\s*1/i.test(lowerText)) return 'phase1';
    if (/phase\s*2|stage\s*2/i.test(lowerText)) return 'phase2';
    if (/phase\s*3|stage\s*3/i.test(lowerText)) return 'phase3';

    // Total/project budget
    if (lowerText.includes('total budget')) return 'total';
    if (lowerText.includes('project budget')) return 'total';

    // Category-specific
    if (lowerText.includes('fabrication')) return 'fabrication';
    if (lowerText.includes('installation')) return 'installation';
    if (lowerText.includes('contingency')) return 'contingency';
    if (lowerText.includes('maintenance')) return 'maintenance';
    if (lowerText.includes('admin')) return 'admin';
    if (lowerText.includes('consultant')) return 'consultant';

    return 'budget';
}

export const budgetMappingRules: MappingRule[] = [
    {
        id: 'budget-allocated-explicit',
        description: 'Budget explicitly allocated/confirmed',
        pattern: /budget\s*(?:allocated|confirmed|approved|set)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const amountInfo = extractAmount(ctx.text);
            if (!amountInfo) {
                // Budget allocation mentioned but no amount found
                return [{
                    kind: 'fact_candidate',
                    factKind: BUDGET_ALLOCATED,
                    payload: {
                        allocationType: extractAllocationType(ctx.text),
                        amount: 0, // Will need manual entry
                    },
                    confidence: 'low',
                }];
            }

            return [{
                kind: 'fact_candidate',
                factKind: BUDGET_ALLOCATED,
                payload: {
                    allocationType: extractAllocationType(ctx.text),
                    amount: amountInfo.amount,
                    currency: amountInfo.currency,
                },
                confidence: 'high',
            }];
        },
        priority: 10,
        terminal: true,
    },
    {
        id: 'budget-amount-mentioned',
        description: 'Amount mentioned with budget context',
        pattern: /\$[\d,]+(?:\s*[kK])?|[\d,]+\s*(?:CAD|USD)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            // Only match if budget-related keywords are present
            const lowerText = ctx.text.toLowerCase();
            const budgetKeywords = ['budget', 'allocation', 'funding', 'cost', 'price', 'fee', 'honorarium'];
            const hasBudgetContext = budgetKeywords.some(kw => lowerText.includes(kw));

            if (!hasBudgetContext) return [];

            const amountInfo = extractAmount(ctx.text);
            if (!amountInfo) return [];

            return [{
                kind: 'fact_candidate',
                factKind: BUDGET_ALLOCATED,
                payload: {
                    allocationType: extractAllocationType(ctx.text),
                    amount: amountInfo.amount,
                    currency: amountInfo.currency,
                },
                confidence: 'medium',
            }];
        },
        priority: 5, // Lower priority - only triggers if budget context
    },
    {
        id: 'artwork-budget-field',
        description: 'Artwork budget field value',
        pattern: /artwork\s*budget/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const amountInfo = extractAmount(ctx.text);
            if (!amountInfo) {
                return [{
                    kind: 'field_value',
                    field: 'artwork_budget',
                    value: null,
                    confidence: 'low',
                }];
            }

            return [
                {
                    kind: 'fact_candidate',
                    factKind: BUDGET_ALLOCATED,
                    payload: {
                        allocationType: 'artwork',
                        amount: amountInfo.amount,
                        currency: amountInfo.currency,
                    },
                    confidence: 'high',
                },
                {
                    kind: 'field_value',
                    field: 'artwork_budget',
                    value: amountInfo.amount,
                    confidence: 'high',
                },
            ];
        },
        priority: 11,
    },
    {
        id: 'total-budget-field',
        description: 'Total budget field value',
        pattern: /total\s*(?:project\s*)?budget/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const amountInfo = extractAmount(ctx.text);
            if (!amountInfo) {
                return [{
                    kind: 'field_value',
                    field: 'total_budget',
                    value: null,
                    confidence: 'low',
                }];
            }

            return [
                {
                    kind: 'fact_candidate',
                    factKind: BUDGET_ALLOCATED,
                    payload: {
                        allocationType: 'total',
                        amount: amountInfo.amount,
                        currency: amountInfo.currency,
                    },
                    confidence: 'high',
                },
                {
                    kind: 'field_value',
                    field: 'total_budget',
                    value: amountInfo.amount,
                    confidence: 'high',
                },
            ];
        },
        priority: 11,
    },
    {
        id: 'line-item-budget',
        description: 'Budget line item pattern',
        pattern: /line\s*item|budget\s*line/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const amountInfo = extractAmount(ctx.text);
            if (!amountInfo) return [];

            return [{
                kind: 'fact_candidate',
                factKind: BUDGET_ALLOCATED,
                payload: {
                    allocationType: extractAllocationType(ctx.text),
                    amount: amountInfo.amount,
                    currency: amountInfo.currency,
                },
                confidence: 'medium',
            }];
        },
        priority: 8,
    },
    {
        id: 'phase-budget',
        description: 'Phase-specific budget allocation',
        pattern: /(?:phase|stage)\s*[123]\s*budget/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const amountInfo = extractAmount(ctx.text);
            const allocationType = extractAllocationType(ctx.text);

            if (!amountInfo) {
                return [{
                    kind: 'field_value',
                    field: `${allocationType}_budget`,
                    value: null,
                    confidence: 'low',
                }];
            }

            return [{
                kind: 'fact_candidate',
                factKind: BUDGET_ALLOCATED,
                payload: {
                    allocationType,
                    amount: amountInfo.amount,
                    currency: amountInfo.currency,
                },
                confidence: 'high',
            }];
        },
        priority: 10,
    },
];
