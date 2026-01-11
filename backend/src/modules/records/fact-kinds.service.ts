/**
 * Fact Kinds Service
 *
 * Manages fact kind definitions - the registry of known domain events.
 * Provides ensureFactKindDefinition() for auto-creating definitions during import.
 */

import { db } from '../../db/client.js';
import type { FactKindDefinition, NewFactKindDefinition } from '../../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

export interface EnsureFactKindInput {
    /** The fact kind identifier (e.g., 'MEETING_HELD') */
    factKind: string;
    /** Optional display name (auto-generated if not provided) */
    displayName?: string;
    /** Source of the definition */
    source: 'csv-import' | 'manual' | 'system';
    /** Confidence level */
    confidence: 'low' | 'medium' | 'high';
    /** Example payload for reference */
    examplePayload?: Record<string, unknown>;
}

export interface EnsureFactKindResult {
    definition: FactKindDefinition;
    isNew: boolean;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Ensure a fact kind definition exists.
 * If it doesn't exist, creates it with needs_review = true.
 * This is safe to call multiple times with the same factKind.
 *
 * @param input - The fact kind to ensure
 * @returns The definition and whether it was newly created
 */
export async function ensureFactKindDefinition(
    input: EnsureFactKindInput
): Promise<EnsureFactKindResult> {
    // Check if definition already exists
    const existing = await db
        .selectFrom('fact_kind_definitions')
        .selectAll()
        .where('fact_kind', '=', input.factKind)
        .executeTakeFirst();

    if (existing) {
        return { definition: existing, isNew: false };
    }

    // Generate display name from fact kind if not provided
    const displayName = input.displayName ?? formatFactKindAsDisplayName(input.factKind);

    // Create new definition with needs_review = true
    const newDef: NewFactKindDefinition = {
        fact_kind: input.factKind,
        display_name: displayName,
        source: input.source,
        confidence: input.confidence,
        needs_review: true,
        is_known: false,
        example_payload: input.examplePayload ? JSON.stringify(input.examplePayload) : null,
    };

    const created = await db
        .insertInto('fact_kind_definitions')
        .values(newDef)
        .returningAll()
        .executeTakeFirstOrThrow();

    return { definition: created, isNew: true };
}

/**
 * Get a fact kind definition by its identifier.
 */
export async function getFactKindDefinition(
    factKind: string
): Promise<FactKindDefinition | undefined> {
    return db
        .selectFrom('fact_kind_definitions')
        .selectAll()
        .where('fact_kind', '=', factKind)
        .executeTakeFirst();
}

/**
 * List all fact kind definitions.
 */
export async function listFactKindDefinitions(filters?: {
    needsReview?: boolean;
    source?: string;
}): Promise<FactKindDefinition[]> {
    let query = db
        .selectFrom('fact_kind_definitions')
        .selectAll()
        .orderBy('first_seen_at', 'desc');

    if (filters?.needsReview !== undefined) {
        query = query.where('needs_review', '=', filters.needsReview);
    }

    if (filters?.source) {
        query = query.where('source', '=', filters.source);
    }

    return query.execute();
}

/**
 * Mark a fact kind definition as reviewed (approved).
 */
export async function approveFactKindDefinition(
    factKind: string,
    reviewerId?: string
): Promise<FactKindDefinition> {
    const result = await db
        .updateTable('fact_kind_definitions')
        .set({
            needs_review: false,
            is_known: true,
            reviewed_at: new Date(),
            reviewed_by: reviewerId ?? null,
        })
        .where('fact_kind', '=', factKind)
        .returningAll()
        .executeTakeFirst();

    if (!result) {
        throw new Error(`Fact kind definition not found: ${factKind}`);
    }

    return result;
}

/**
 * Mark a fact kind definition as deprecated (soft delete).
 * Deprecated definitions are still kept for historical reference.
 */
export async function deprecateFactKindDefinition(
    factKind: string,
    reviewerId?: string
): Promise<FactKindDefinition> {
    const result = await db
        .updateTable('fact_kind_definitions')
        .set({
            needs_review: false,
            is_known: false,
            reviewed_at: new Date(),
            reviewed_by: reviewerId ?? null,
        })
        .where('fact_kind', '=', factKind)
        .returningAll()
        .executeTakeFirst();

    if (!result) {
        throw new Error(`Fact kind definition not found: ${factKind}`);
    }

    return result;
}

/**
 * Merge one fact kind into another (for duplicates).
 * This updates the source to be deprecated and notes the target.
 */
export async function mergeFactKindDefinitions(
    sourceFactKind: string,
    targetFactKind: string,
    reviewerId?: string
): Promise<{ source: FactKindDefinition; target: FactKindDefinition }> {
    const source = await deprecateFactKindDefinition(sourceFactKind, reviewerId);

    const target = await db
        .updateTable('fact_kind_definitions')
        .set({
            description: db.fn.coalesce(
                'description',
                `Merged from ${sourceFactKind}` as any
            ) as any,
        })
        .where('fact_kind', '=', targetFactKind)
        .returningAll()
        .executeTakeFirst();

    if (!target) {
        throw new Error(`Target fact kind definition not found: ${targetFactKind}`);
    }

    return { source, target };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a SCREAMING_SNAKE_CASE fact kind to Title Case display name.
 */
function formatFactKindAsDisplayName(factKind: string): string {
    return factKind
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Get counts of fact kind definitions by review status.
 */
export async function getFactKindStats(): Promise<{
    total: number;
    needsReview: number;
    known: number;
}> {
    const result = await db
        .selectFrom('fact_kind_definitions')
        .select([
            db.fn.count<number>('id').as('total'),
            db.fn.sum<number>(db.case().when('needs_review', '=', true).then(1).else(0).end()).as('needsReview'),
            db.fn.sum<number>(db.case().when('is_known', '=', true).then(1).else(0).end()).as('known'),
        ])
        .executeTakeFirstOrThrow();

    return {
        total: Number(result.total) || 0,
        needsReview: Number(result.needsReview) || 0,
        known: Number(result.known) || 0,
    };
}
