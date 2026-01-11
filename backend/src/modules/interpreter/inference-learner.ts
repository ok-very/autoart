/**
 * Inference Learner Service
 *
 * Records user corrections to improve future inference.
 * When a user overrides an auto-generated mapping, we store the correction
 * and use it to improve future suggestions.
 */

import { db } from '../../db/client.js';
import type {
    InferenceLearning,
    NewInferenceLearning,
} from '../../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

export interface InputSignature {
    columnName: string;
    columnType: string;
    sampleValues: string[];
}

export interface ColumnMapping {
    fieldId?: string;
    fieldName: string;
    fieldType: string;
    renderHint?: string;
    // Canonical field key is 'assignee'. Legacy 'owner' values are normalized on persist.
    specialMapping?: 'title' | 'assignee' | 'dueDate' | 'status' | 'description';
}

/**
 * Normalize legacy 'owner' specialMapping to 'assignee'.
 * Ensures consistency in stored learnings after Phase 6 migration.
 */
function normalizeMapping(mapping: ColumnMapping): ColumnMapping {
    if ((mapping.specialMapping as string) === 'owner') {
        return { ...mapping, specialMapping: 'assignee' };
    }
    return mapping;
}

// ============================================================================
// RECORD LEARNINGS
// ============================================================================

/**
 * Record a user correction for future inference improvement.
 */
export async function recordLearning(params: {
    sourceType: 'monday' | 'csv' | 'asana';
    inputSignature: InputSignature;
    suggestedMapping: ColumnMapping | null;
    userMapping: ColumnMapping;
    projectId?: string;
    definitionId?: string;
}): Promise<InferenceLearning> {
    // Normalize any legacy 'owner' values to 'assignee' before persisting
    const normalizedUserMapping = normalizeMapping(params.userMapping);
    const normalizedSuggestedMapping = params.suggestedMapping
        ? normalizeMapping(params.suggestedMapping)
        : null;

    const learning: NewInferenceLearning = {
        source_type: params.sourceType,
        input_signature: params.inputSignature,
        suggested_mapping: normalizedSuggestedMapping,
        user_mapping: normalizedUserMapping,
        project_id: params.projectId ?? null,
        definition_id: params.definitionId ?? null,
    };

    const result = await db
        .insertInto('inference_learnings')
        .values(learning)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

// ============================================================================
// QUERY LEARNINGS
// ============================================================================

/**
 * Get learnings that match the given criteria.
 * Used to improve inference for similar column patterns.
 */
export async function getLearningsFor(params: {
    columnName?: string;
    columnType?: string;
    projectId?: string;
    sourceType?: 'monday' | 'csv' | 'asana';
}): Promise<InferenceLearning[]> {
    let query = db.selectFrom('inference_learnings').selectAll();

    if (params.sourceType) {
        query = query.where('source_type', '=', params.sourceType);
    }

    if (params.projectId) {
        // Include both project-specific and global learnings
        query = query.where((eb) =>
            eb.or([
                eb('project_id', '=', params.projectId!),
                eb('project_id', 'is', null),
            ])
        );
    }

    const results = await query.orderBy('applied_count', 'desc').execute();

    // Filter by column name/type match if specified
    if (params.columnName || params.columnType) {
        return results.filter((learning) => {
            const sig = learning.input_signature as InputSignature | null;
            if (!sig) return false;

            const nameMatch =
                !params.columnName ||
                sig.columnName.toLowerCase() === params.columnName.toLowerCase();
            const typeMatch =
                !params.columnType || sig.columnType === params.columnType;

            return nameMatch && typeMatch;
        });
    }

    return results;
}

/**
 * Find a matching learning for a specific column.
 * Returns the best match based on signature similarity.
 */
export async function findMatchingLearning(params: {
    columnName: string;
    columnType: string;
    sourceType: 'monday' | 'csv' | 'asana';
    projectId?: string;
}): Promise<InferenceLearning | null> {
    const learnings = await getLearningsFor({
        columnName: params.columnName,
        columnType: params.columnType,
        sourceType: params.sourceType,
        projectId: params.projectId,
    });

    if (learnings.length === 0) return null;

    // Return the most frequently applied learning
    return learnings[0];
}

// ============================================================================
// APPLY LEARNINGS
// ============================================================================

/**
 * Apply learnings to auto-generated mappings.
 * Overrides auto-mappings with learned user preferences.
 */
export function applyLearnings(
    autoMappings: Array<{ columnName: string; columnType: string; mapping: ColumnMapping }>,
    learnings: InferenceLearning[]
): Array<{ columnName: string; columnType: string; mapping: ColumnMapping; source: 'auto' | 'learned' }> {
    // Index learnings by column name for quick lookup
    const learningIndex = new Map<string, InferenceLearning>();
    for (const learning of learnings) {
        const sig = learning.input_signature as InputSignature | null;
        if (sig) {
            // Use lowercase column name as key
            const key = sig.columnName.toLowerCase();
            // Only store if not already present (first = highest applied_count)
            if (!learningIndex.has(key)) {
                learningIndex.set(key, learning);
            }
        }
    }

    return autoMappings.map((item) => {
        const key = item.columnName.toLowerCase();
        const learning = learningIndex.get(key);

        if (learning) {
            const userMapping = learning.user_mapping as ColumnMapping;
            // Normalize legacy 'owner' values when reading from stored learnings
            const normalizedMapping = normalizeMapping(userMapping);
            return {
                ...item,
                mapping: normalizedMapping,
                source: 'learned' as const,
            };
        }

        return {
            ...item,
            source: 'auto' as const,
        };
    });
}

/**
 * Increment the applied count for a learning.
 * Call this when a learning is successfully used.
 */
export async function incrementAppliedCount(learningId: string): Promise<void> {
    await db
        .updateTable('inference_learnings')
        .set((eb) => ({
            applied_count: eb('applied_count', '+', 1),
        }))
        .where('id', '=', learningId)
        .execute();
}
