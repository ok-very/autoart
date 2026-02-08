/**
 * Import Classification Service
 *
 * Handles classification of import items:
 * - Generate classifications based on text interpretation
 * - Schema matching against existing definitions
 * - Resolution management for user-driven classification
 */

import { type ClassificationOutcome, isInternalWork, resolveEntityKind } from '@autoart/shared';

import { db } from '@db/client.js';
import type { RecordDefinition } from '@db/schema.js';
import { logger } from '@utils/logger.js';

import { getSession } from './import-sessions.service.js';
import { type InterpretationOutput, interpretCsvRowPlan } from '../../interpreter/interpreter.service.js';
import { matchSchema } from '../schema-matcher.js';
import type { ImportPlan, ImportPlanItem, ItemClassification } from '../types.js';
import { hasUnresolvedClassifications } from '../types.js';

// ============================================================================
// CLASSIFICATION GENERATION
// ============================================================================

type ConfidenceLevel = 'low' | 'medium' | 'high';
const VALID_CONFIDENCE_LEVELS: Set<string> = new Set(['low', 'medium', 'high']);

/**
 * Normalize confidence value to a valid ConfidenceLevel.
 * Returns 'medium' for undefined, null, or unexpected values.
 * Logs a warning when coercion occurs to help surface upstream issues.
 */
function normalizeConfidence(confidence: unknown): ConfidenceLevel {
    if (typeof confidence === 'string' && VALID_CONFIDENCE_LEVELS.has(confidence)) {
        return confidence as ConfidenceLevel;
    }
    // Log warning to help identify upstream issues producing invalid confidence values
    if (confidence !== undefined && confidence !== null) {
        logger.warn(
            { receivedConfidence: confidence, receivedType: typeof confidence },
            '[import-classification] Invalid confidence value coerced to medium - check upstream interpretation pipeline',
        );
    }
    return 'medium';
}

/**
 * Generate classifications for all items in the plan.
 * Uses the V2 interpretation API to determine outcome based on output kinds.
 *
 * Classification logic:
 * - fact_candidate → FACT_EMITTED (needs review before commit)
 * - action_hint → INTERNAL_WORK (preparatory work, no commit)
 * - work_event/field_value → DERIVED_STATE (auto-commit)
 * - No outputs → UNCLASSIFIED
 */
export function generateClassifications(items: ImportPlanItem[], definitions: RecordDefinition[]): ItemClassification[] {
    return items.map((item) => {
        const text = item.title;
        const statusValue = (item.metadata as { status?: string })?.status;
        const targetDate = (item.metadata as { targetDate?: string })?.targetDate;
        const stageName = (item.metadata as { 'import.stage_name'?: string })?.['import.stage_name'];

        let baseClassification: ItemClassification;

        // Check for parent resolution failures first - these need review
        const parentFailed = (item.metadata as { _parentResolutionFailed?: boolean })?._parentResolutionFailed;
        if (parentFailed) {
            const orphanedParentId = (item.metadata as { _orphanedParentId?: string })?._orphanedParentId;
            const reason = (item.metadata as { _reason?: string })?._reason;
            return addSchemaMatch({
                itemTempId: item.tempId,
                outcome: 'AMBIGUOUS' as ClassificationOutcome,
                confidence: 'low' as const,
                rationale: orphanedParentId
                    ? `Subitem parent (${orphanedParentId}) not in import batch - needs manual parent assignment`
                    : `Subitem missing parent reference: ${reason || 'unknown'}`,
                candidates: ['assign_parent', 'promote_to_item', 'skip'],
            }, item.fieldRecordings, definitions);
        }

        // Check for internal work patterns first
        if (isInternalWork(text)) {
            baseClassification = {
                itemTempId: item.tempId,
                outcome: 'INTERNAL_WORK' as ClassificationOutcome,
                confidence: 'high' as const,
                rationale: 'Matches internal work pattern',
            };
        } else {
            // Use V2 interpretation API
            const plan = interpretCsvRowPlan({
                text,
                status: statusValue,
                targetDate: targetDate,
                stageName: stageName ?? undefined,
            });

            // Classify based on output kinds
            const factCandidates = plan.outputs.filter((o): o is InterpretationOutput & { kind: 'fact_candidate' } => o.kind === 'fact_candidate');
            const actionHints = plan.outputs.filter((o): o is InterpretationOutput & { kind: 'action_hint' } => o.kind === 'action_hint');
            const fieldValues = plan.outputs.filter((o): o is InterpretationOutput & { kind: 'field_value' } => o.kind === 'field_value');

            // Fact candidates → FACT_EMITTED
            // Note: Actual event emission happens during execution via interpretationPlan.outputs
            if (factCandidates.length > 0) {
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'FACT_EMITTED' as ClassificationOutcome,
                    confidence: normalizeConfidence(factCandidates[0].confidence),
                    rationale: `Matched rule for ${factCandidates[0].factKind}`,
                    interpretationPlan: plan,
                };
            }
            // Action hints → INTERNAL_WORK
            else if (actionHints.length > 0) {
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'INTERNAL_WORK' as ClassificationOutcome,
                    confidence: 'medium' as const,
                    rationale: `Action hint: ${actionHints[0].hintType} - ${actionHints[0].text}`,
                    interpretationPlan: plan,
                };
            }
            // Status-derived work event or field values → DERIVED_STATE
            else if (plan.statusEvent || fieldValues.length > 0) {
                const rationale = plan.statusEvent
                    ? `Status "${statusValue}" maps to ${plan.statusEvent.kind === 'work_event' ? plan.statusEvent.eventType : 'work event'}`
                    : `Extracted ${fieldValues.length} field value(s)`;

                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'DERIVED_STATE' as ClassificationOutcome,
                    confidence: 'medium' as const,
                    rationale,
                    interpretationPlan: plan,
                };
            }
            // No rules matched - UNCLASSIFIED
            else {
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'UNCLASSIFIED' as ClassificationOutcome,
                    confidence: 'low' as const,
                    rationale: 'No mapping rules matched',
                };
            }
        }

        // Add schema matching to ALL classifications
        return addSchemaMatch(baseClassification, item.fieldRecordings, definitions);
    });
}

/**
 * Generate classifications for connector (Monday) imports.
 *
 * Unlike CSV imports which use text interpretation rules,
 * connector imports classify based on entityType:
 * - 'record' → DERIVED_STATE (needs schema matching)
 * - 'template' → DERIVED_STATE (auto-commit, no schema match needed)
 * - 'action' → INTERNAL_WORK (create as action)
 * - others → UNCLASSIFIED
 */
export function generateClassificationsForConnectorItems(
    items: ImportPlanItem[],
    definitions: RecordDefinition[],
): ItemClassification[] {
    return items.map((item) => {
        let baseClassification: ItemClassification;
        const kind = resolveEntityKind(item);

        switch (kind) {
            case 'record': {
                // Records with no field data should be marked as needing review
                const hasFieldData = item.fieldRecordings && item.fieldRecordings.length > 0;
                if (!hasFieldData) {
                    return {
                        itemTempId: item.tempId,
                        outcome: 'UNCLASSIFIED' as ClassificationOutcome,
                        confidence: 'low' as const,
                        rationale: 'Record has no field data',
                        schemaMatch: {
                            definitionId: null,
                            definitionName: null,
                            matchScore: 0,
                            proposedDefinition: undefined,
                            fieldMatches: [],
                            matchRationale: 'No field recordings to match',
                        },
                    };
                }
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'DERIVED_STATE' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: 'Record from connector with structured field data',
                };
                return addSchemaMatch(baseClassification, item.fieldRecordings, definitions);
            }

            case 'template':
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'DERIVED_STATE' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: 'Template from connector - auto-commit',
                };
                return baseClassification;

            case 'action':
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'INTERNAL_WORK' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: `${kind} from connector - create as work item`,
                };
                return baseClassification;

            case 'project':
            case 'stage':
            case 'process':
            case 'subprocess':
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'INTERNAL_WORK' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: `Container type ${kind} - structural item`,
                };
                return baseClassification;

            default:
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'UNCLASSIFIED' as ClassificationOutcome,
                    confidence: 'low' as const,
                    rationale: `Unknown entity kind: ${kind}`,
                };
                return baseClassification;
        }
    });
}

/**
 * Add schema matching result to a classification
 */
export function addSchemaMatch(
    classification: ItemClassification,
    fieldRecordings: ImportPlanItem['fieldRecordings'],
    definitions: RecordDefinition[],
): ItemClassification {
    // If no field recordings or no definitions, return with empty schemaMatch for consistent shape
    // Must include fieldMatches and matchRationale for shape consistency
    if (!fieldRecordings || fieldRecordings.length === 0 || !definitions || definitions.length === 0) {
        const rationale = !fieldRecordings || fieldRecordings.length === 0
            ? 'No field recordings to match'
            : 'No definitions available for matching';
        return {
            ...classification,
            schemaMatch: {
                definitionId: null,
                definitionName: null,
                matchScore: 0,
                proposedDefinition: undefined,
                fieldMatches: [],
                matchRationale: rationale,
            },
        };
    }

    let schemaResult;
    try {
        schemaResult = matchSchema(fieldRecordings, definitions);
    } catch (err) {
        logger.error({ error: err }, '[import-classification] matchSchema threw in addSchemaMatch');
        return {
            ...classification,
            schemaMatch: {
                definitionId: null,
                definitionName: null,
                matchScore: 0,
                proposedDefinition: undefined,
                fieldMatches: [],
                matchRationale: 'Schema matching failed due to an internal error',
            },
        };
    }

    return {
        ...classification,
        schemaMatch: {
            definitionId: schemaResult.matchedDefinition?.id ?? null,
            definitionName: schemaResult.matchedDefinition?.name ?? null,
            matchScore: schemaResult.matchScore,
            proposedDefinition: schemaResult.proposedDefinition,
            // Include detailed matching info for UI and debugging
            fieldMatches: schemaResult.fieldMatches,
            matchRationale: schemaResult.rationale,
        },
    };
}


// ============================================================================
// RESOLUTION API
// ============================================================================

export interface Resolution {
    itemTempId: string;
    resolvedOutcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'EXTERNAL_WORK' | 'AMBIGUOUS' | 'UNCLASSIFIED' | 'DEFERRED';
    resolvedFactKind?: string;
    resolvedPayload?: Record<string, unknown>;
}

/**
 * Save user resolutions for classifications.
 * Updates the plan and recalculates session status.
 * Uses a transaction with row-level locking to prevent concurrent overwrites.
 */
export async function saveResolutions(
    sessionId: string,
    resolutions: Resolution[],
): Promise<ImportPlan> {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');

    return await db.transaction().execute(async (trx) => {
        // Lock the plan row to prevent concurrent modifications (FOR UPDATE)
        const planRow = await trx
            .selectFrom('import_plans')
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'desc')
            .forUpdate()
            .executeTakeFirst();

        if (!planRow) throw new Error('No plan found');

        let plan: ImportPlan;
        try {
            plan = typeof planRow.plan_data === 'string'
                ? JSON.parse(planRow.plan_data)
                : planRow.plan_data as ImportPlan;
        } catch (err) {
            logger.error({ sessionId, error: err }, '[import-classification] Failed to parse plan_data JSON');
            throw new Error(`Malformed plan data for session ${sessionId}`);
        }

        // Apply resolutions to classifications
        // Track unknown itemTempIds to warn about stale/invalid resolutions
        const unknownTempIds: string[] = [];

        for (const res of resolutions) {
            const classification = plan.classifications.find((c: ItemClassification) => c.itemTempId === res.itemTempId);
            if (classification) {
                classification.resolution = {
                    resolvedOutcome: res.resolvedOutcome,
                    resolvedFactKind: res.resolvedFactKind,
                    resolvedPayload: res.resolvedPayload,
                };
            } else {
                unknownTempIds.push(res.itemTempId);
            }
        }

        // Warn if any resolutions referenced unknown items (stale UI or ID mismatch)
        if (unknownTempIds.length > 0) {
            logger.warn(
                { sessionId, unknownTempIds, totalResolutions: resolutions.length },
                '[import-classification] Some resolutions referenced unknown itemTempIds - these were ignored',
            );
        }

        // Update only the specific plan row that was locked (not all historical plans for this session)
        await trx
            .updateTable('import_plans' as any)
            .set({ plan_data: JSON.stringify(plan) })
            .where('id', '=', planRow.id)
            .execute();

        // Recalculate session status
        const hasUnresolved = hasUnresolvedClassifications(plan);
        const newStatus = hasUnresolved ? 'needs_review' : 'planned';

        await trx
            .updateTable('import_sessions')
            .set({ status: newStatus, updated_at: new Date() })
            .where('id', '=', sessionId)
            .execute();

        return plan;
    });
}

