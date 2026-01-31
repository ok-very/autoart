/**
 * Budget Projector
 *
 * Extracts budget records for a project into a flat row format
 * suitable for CSV export.
 */

import { db } from '@db/client.js';

// ============================================================================
// EXPORT MODEL
// ============================================================================

export interface BudgetExportRow {
    name: string;
    allocationType: string;
    allocated: number;
    spent: number;
    remaining: number;
    utilizationPct: number;
    currency: string;
}

// ============================================================================
// PROJECTION
// ============================================================================

/**
 * Project budget records for a given project into export rows.
 */
export async function projectBudgets(projectId: string): Promise<BudgetExportRow[]> {
    const budgetDef = await db
        .selectFrom('record_definitions')
        .select(['id'])
        .where('name', '=', 'Budget')
        .executeTakeFirst();

    if (!budgetDef) return [];

    const budgets = await db
        .selectFrom('records')
        .selectAll()
        .where('definition_id', '=', budgetDef.id)
        .where('classification_node_id', '=', projectId)
        .execute();

    return budgets.map((r) => {
        const data = r.data as Record<string, unknown>;
        const allocated = extractAmountCents(data, 'allocated_amount');
        const spent = extractAmountCents(data, 'spent_amount');
        const remaining = allocated - spent;
        return {
            name: (data.name as string) || r.unique_name,
            allocationType: (data.allocation_type as string) || '',
            allocated,
            spent,
            remaining,
            utilizationPct: allocated > 0 ? (spent / allocated) * 100 : 0,
            currency: (data.currency as string) || 'CAD',
        };
    });
}

// ============================================================================
// HELPERS
// ============================================================================

function extractAmountCents(data: Record<string, unknown>, key: string): number {
    const val = data[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null && 'amount' in val) {
        return (val as { amount: number }).amount;
    }
    return 0;
}
