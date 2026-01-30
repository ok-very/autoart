/**
 * Import Execution Service
 *
 * Handles execution of import plans:
 * - Execute plans via Action/Event creation
 * - Emit domain events from CSV subitems using interpreter mappings
 * - Auto-create fact kind definitions for discovered event types
 *
 * IMPORTANT: All event writes MUST go through emitEvent() to ensure
 * projection refresh and central validation guarantees.
 */

import { db } from '@db/client.js';
import type { ContextType } from '@db/schema.js';
import { logger } from '@utils/logger.js';

import { getSession, getLatestPlanWithId } from './import-sessions.service.js';
import {
    markSessionNeedsReview,
    markSessionExecuting,
    markSessionCompleted,
    markSessionFailed,
} from './session-status.service.js';
import { emitEvent } from '../../events/events.service.js';
import { interpretCsvRowPlan } from '../../interpreter/interpreter.service.js';
import { ensureFactKindDefinition } from '../../records/fact-kinds.service.js';
import { bulkCreateRecords } from '../../records/records.service.js';
import { createMapping } from '../sync.service.js';
import type { ImportPlan, ImportPlanItem, ItemClassification } from '../types.js';
import { hasUnresolvedClassifications, countUnresolved } from '../types.js';

// ============================================================================
// IMPORT EXECUTION
// ============================================================================

export async function executeImport(sessionId: string, userId?: string) {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');

    // Get plan and its ID atomically to prevent race condition with concurrent plan generation
    const planResult = await getLatestPlanWithId(sessionId);
    if (!planResult) throw new Error('No plan found');

    const { planId, plan } = planResult;

    // Gate: block execution if unresolved classifications exist
    if (hasUnresolvedClassifications(plan)) {
        const { ambiguous, unclassified } = countUnresolved(plan);
        await markSessionNeedsReview(sessionId, 'Execution blocked: unresolved classifications');
        return {
            blocked: true,
            unresolvedCount: ambiguous + unclassified,
            ambiguous,
            unclassified,
            message: 'Import blocked: resolve ambiguous/unclassified items first',
        };
    }

    // Start execution
    const execution = await db
        .insertInto('import_executions')
        .values({
            session_id: sessionId,
            plan_id: planId,
            status: 'running',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    // Update session status
    await markSessionExecuting(sessionId);

    try {
        // Execute plan
        const results = await executePlanViaComposer(plan, session.target_project_id, userId);

        // Mark execution complete
        await db
            .updateTable('import_executions')
            .set({
                status: 'completed',
                results: JSON.stringify(results),
                completed_at: new Date(),
            })
            .where('id', '=', execution.id)
            .execute();

        // Update session status
        await markSessionCompleted(sessionId);

        return { ...execution, status: 'completed' as const, results };
    } catch (err) {
        // Mark execution failed
        await db
            .updateTable('import_executions')
            .set({
                status: 'failed',
                results: JSON.stringify({ error: (err as Error).message }),
                completed_at: new Date(),
            })
            .where('id', '=', execution.id)
            .execute();

        // Update session status
        await markSessionFailed(sessionId, err as Error);

        throw err;
    }
}

// ============================================================================
// PLAN EXECUTION VIA COMPOSER
// ============================================================================

/**
 * Map hierarchy node type to ContextType for action/event creation.
 * Ensures actions are created with the correct context type for projection queries.
 */
function getContextTypeFromNodeType(nodeType: string | undefined): ContextType {
    switch (nodeType) {
        case 'project': return 'project';
        case 'process': return 'process';
        case 'stage': return 'stage';
        case 'subprocess': return 'subprocess';
        default:
            if (nodeType !== undefined) {
                logger.warn({ nodeType }, '[imports.service] Unknown nodeType mapped to subprocess - this may indicate an upstream bug');
            }
            return 'subprocess';
    }
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

/**
 * Shared context for plan execution - holds mutable state across phases.
 */
interface ExecutionContext {
    createdIds: Record<string, string>;
    containerTypes: Map<string, string>;
    executionErrors: string[];
    counters: {
        factEventsEmitted: number;
        workEventsEmitted: number;
        fieldValuesApplied: number;
        actionsCreated: number;
        recordsCreated: number;
        skippedNoContext: number;
    };
    classificationMap: Map<string, ItemClassification>;
}

/**
 * Initialize execution context from an import plan.
 */
function createExecutionContext(plan: ImportPlan): ExecutionContext {
    return {
        createdIds: {},
        containerTypes: new Map(),
        executionErrors: [],
        counters: {
            factEventsEmitted: 0,
            workEventsEmitted: 0,
            fieldValuesApplied: 0,
            actionsCreated: 0,
            recordsCreated: 0,
            skippedNoContext: 0,
        },
        classificationMap: new Map(
            plan.classifications.map((c: ItemClassification) => [c.itemTempId, c])
        ),
    };
}

// ============================================================================
// PHASE 1: CONTAINER CREATION
// ============================================================================

/**
 * Create hierarchy nodes (process, subprocess) from plan containers.
 */
async function createContainers(
    containers: ImportPlan['containers'],
    ctx: ExecutionContext,
    targetProjectId: string | null,
    userId?: string
): Promise<void> {
    for (const container of containers) {
        let parentId: string | null;

        if (container.parentTempId) {
            const resolvedParentId = ctx.createdIds[container.parentTempId];
            if (!resolvedParentId) {
                // Parent container not yet created - this indicates incorrect ordering
                // or a reference to a non-existent container
                logger.warn({
                    tempId: container.tempId,
                    title: container.title,
                    parentTempId: container.parentTempId,
                }, '[imports.service] Container parent not found in createdIds - creating as root node under project');
                parentId = targetProjectId;
            } else {
                parentId = resolvedParentId;
            }
        } else {
            parentId = targetProjectId;
        }

        const nodeMetadata = container.metadata ?? {};

        const created = await db
            .insertInto('hierarchy_nodes')
            .values({
                parent_id: parentId ?? null,
                type: container.type,
                title: container.title,
                metadata: JSON.stringify(nodeMetadata),
                created_by: userId,
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        ctx.createdIds[container.tempId] = created.id;
        ctx.containerTypes.set(created.id, container.type);
    }
}

// ============================================================================
// PHASE 2: BULK RECORD CREATION
// ============================================================================

/**
 * Check if an item is a creatable record (has classification with schema match).
 */
function isCreatableRecord(
    item: ImportPlanItem,
    classificationMap: Map<string, ItemClassification>
): boolean {
    if (item.entityType !== 'record') return false;
    const classification = classificationMap.get(item.tempId);
    return !!classification?.schemaMatch?.definitionId;
}

/**
 * Group items by their target definition ID for bulk creation.
 */
function groupRecordsByDefinition(
    items: ImportPlanItem[],
    classificationMap: Map<string, ItemClassification>
): Map<string, ImportPlanItem[]> {
    const recordsByDef = new Map<string, ImportPlanItem[]>();

    for (const item of items) {
        if (isCreatableRecord(item, classificationMap)) {
            // Re-fetch to avoid non-null assertion risks
            const classification = classificationMap.get(item.tempId);
            const definitionId = classification?.schemaMatch?.definitionId;

            // Double-check after isCreatableRecord guard (defensive against map mutation)
            if (!classification || !definitionId) {
                logger.error({ tempId: item.tempId, title: item.title }, '[imports.service] Classification or definitionId unexpectedly missing after guard check');
                continue;
            }

            const list = recordsByDef.get(definitionId) || [];
            list.push(item);
            recordsByDef.set(definitionId, list);
        } else if (item.entityType === 'record') {
            // Log warning for record items that cannot be created
            const classification = classificationMap.get(item.tempId);
            if (!classification) {
                logger.warn({ tempId: item.tempId, title: item.title }, '[imports.service] Record item skipped: missing classification');
            } else if (!classification.schemaMatch?.definitionId) {
                logger.warn({ tempId: item.tempId, title: item.title, schemaMatch: classification.schemaMatch }, '[imports.service] Record item skipped: no matching definition');
            }
        }
    }

    return recordsByDef;
}

/**
 * Build bulk input for record creation from plan items.
 */
function buildBulkRecordInput(
    items: ImportPlanItem[],
    createdIds: Record<string, string>
): Array<{ uniqueName: string; data: Record<string, unknown>; classificationNodeId: string | null }> {
    return items.map(item => {
        const recordData = (item.fieldRecordings || []).reduce((acc, fr) => {
            acc[fr.fieldName] = fr.value;
            return acc;
        }, {} as Record<string, unknown>);

        // Add title as a standard field only if neither name nor title were explicitly set
        if (!('name' in recordData) && !('title' in recordData)) {
            recordData.title = item.title;
        }

        // Use parent container as classification node if available
        let parentContainerId: string | null = null;
        if (item.parentTempId) {
            parentContainerId = createdIds[item.parentTempId] ?? null;
            if (!parentContainerId) {
                // Parent was specified but not found in createdIds
                logger.warn({
                    tempId: item.tempId,
                    title: item.title,
                    parentTempId: item.parentTempId,
                }, '[imports.service] Record parent container not found - creating without classification node');
            }
        }

        return {
            uniqueName: item.tempId,
            data: recordData,
            classificationNodeId: parentContainerId
        };
    });
}

/**
 * Create records in bulk and map results back to items.
 */
async function createBulkRecordsForDefinition(
    defId: string,
    items: ImportPlanItem[],
    ctx: ExecutionContext,
    targetProjectId: string | null,
    userId?: string
): Promise<void> {
    logger.debug({ definitionId: defId, count: items.length }, '[imports.service] Creating records for definition');

    const bulkInput = buildBulkRecordInput(items, ctx.createdIds);
    const result = await bulkCreateRecords(defId, bulkInput, userId);

    if (result.errors.length > 0) {
        logger.warn(
            {
                module: 'imports.service',
                operation: 'bulkCreateRecords',
                definitionId: defId,
                userId,
                errorCount: result.errors.length,
                errors: result.errors.map(e => ({
                    uniqueName: e.uniqueName,
                    error: e.error,
                })),
            },
            'Bulk record creation encountered errors'
        );
        ctx.executionErrors.push(
            ...result.errors.map(e => `Record "${e.uniqueName}": ${e.error}`)
        );
    }

    // Map created records back to items
    const recordsByTempId = new Map(result.records.map(r => [r.unique_name, r]));
    ctx.counters.recordsCreated += result.created;
    logger.debug({ created: result.created, updated: result.updated, errors: result.errors.length }, '[imports.service] Bulk create result');

    for (const item of items) {
        const record = recordsByTempId.get(item.tempId);
        if (record) {
            ctx.createdIds[item.tempId] = record.id;

            // Emit RECORD_CREATED event for audit trail
            if (targetProjectId) {
                await emitEvent({
                    contextId: targetProjectId,
                    contextType: 'project',
                    type: 'RECORD_CREATED',
                    payload: {
                        recordId: record.id,
                        definitionId: defId,
                        uniqueName: record.unique_name,
                        source: 'import',
                    },
                    actorId: userId,
                });
            }

            // Create external source mapping for Monday items
            const mondayMeta = (item.metadata as { monday?: { id: string; type: string } })?.monday;
            if (mondayMeta?.id) {
                await createMapping({
                    provider: 'monday',
                    externalId: mondayMeta.id,
                    externalType: mondayMeta.type || 'item',
                    localEntityType: 'record',
                    localEntityId: record.id,
                });
            }
        } else {
            logger.error(
                {
                    module: 'imports.service',
                    operation: 'bulkCreateRecords',
                    itemTitle: item.title,
                    tempId: item.tempId,
                },
                'Failed to match created record for item'
            );
        }
    }
}

// ============================================================================
// PHASE 3: TOPOLOGICAL SORTING
// ============================================================================

interface TopologicalSortResult {
    sortedItems: ImportPlanItem[];
    itemDepths: Map<string, number>;
    cycleNodes: Set<string>;
}

/**
 * Sort items topologically to ensure parents are processed before children.
 * Detects cycles and treats cycle nodes as roots.
 */
function topologicalSortItems(
    items: ImportPlanItem[],
    itemsByTempId: Map<string, ImportPlanItem>
): TopologicalSortResult {
    const itemDepths = new Map<string, number>();
    const cycleNodes = new Set<string>();

    // Phase 1: Detect all nodes that are part of cycles
    function detectCycles(tempId: string, path: Set<string>, pathOrder: string[]): void {
        if (cycleNodes.has(tempId)) return;
        if (path.has(tempId)) {
            const cycleStartIndex = pathOrder.indexOf(tempId);
            for (let i = cycleStartIndex; i < pathOrder.length; i++) {
                cycleNodes.add(pathOrder[i]);
            }
            cycleNodes.add(tempId);
            return;
        }

        const item = itemsByTempId.get(tempId);
        if (!item || !item.parentTempId || !itemsByTempId.has(item.parentTempId)) {
            return;
        }

        path.add(tempId);
        pathOrder.push(tempId);
        detectCycles(item.parentTempId, path, pathOrder);
        path.delete(tempId);
        pathOrder.pop();
    }

    for (const item of items) {
        detectCycles(item.tempId, new Set(), []);
    }

    if (cycleNodes.size > 0) {
        logger.warn({ cycleNodes: Array.from(cycleNodes) }, '[imports.service] Cycles detected in item parent chains - treating cycle nodes as roots');
    }

    // Phase 2: Calculate depths (cycle nodes treated as depth 0)
    function getItemDepth(tempId: string): number {
        if (itemDepths.has(tempId)) return itemDepths.get(tempId)!;

        if (cycleNodes.has(tempId)) {
            itemDepths.set(tempId, 0);
            return 0;
        }

        const item = itemsByTempId.get(tempId);
        if (!item) {
            itemDepths.set(tempId, 0);
            return 0;
        }

        if (!item.parentTempId || !itemsByTempId.has(item.parentTempId)) {
            itemDepths.set(tempId, 0);
            return 0;
        }

        const parentDepth = getItemDepth(item.parentTempId);
        const depth = parentDepth + 1;
        itemDepths.set(tempId, depth);
        return depth;
    }

    for (const item of items) {
        getItemDepth(item.tempId);
    }

    // Sort by depth ascending
    const sortedItems = [...items].sort((a, b) => {
        const aDepth = itemDepths.get(a.tempId) ?? 0;
        const bDepth = itemDepths.get(b.tempId) ?? 0;
        return aDepth - bDepth;
    });

    return { sortedItems, itemDepths, cycleNodes };
}

// ============================================================================
// PHASE 4: ACTION CREATION & EVENTS
// ============================================================================

/**
 * Check if a template already exists via external source mapping.
 * Returns the existing entity ID if found, or null if not.
 */
async function checkTemplateDeduplication(
    item: ImportPlanItem,
    ctx: ExecutionContext
): Promise<boolean> {
    const mondayMeta = item.metadata?.monday as { id?: string } | undefined;
    const mondayId = mondayMeta?.id;

    if (mondayId) {
        const existingMapping = await db
            .selectFrom('external_source_mappings')
            .select('local_entity_id')
            .where('provider', '=', 'monday')
            .where('external_id', '=', mondayId)
            .executeTakeFirst();

        if (existingMapping) {
            logger.debug({ title: item.title, mondayId, entityId: existingMapping.local_entity_id }, '[imports.service] Template already exists, reusing');
            ctx.createdIds[item.tempId] = existingMapping.local_entity_id;
            return true;
        }
    }
    return false;
}

/**
 * Resolve context and parent for an item.
 */
function resolveItemContext(
    item: ImportPlanItem,
    itemsByTempId: Map<string, ImportPlanItem>,
    ctx: ExecutionContext,
    targetProjectId: string | null
): { contextId: string | undefined; parentActionId: string | null } {
    const parentIsItem = item.parentTempId && itemsByTempId.has(item.parentTempId);

    let contextId: string | undefined;
    let parentActionId: string | null = null;

    if (parentIsItem) {
        const resolvedParentAction = ctx.createdIds[item.parentTempId!];
        parentActionId = resolvedParentAction ?? null;

        if (!resolvedParentAction) {
            logger.warn({
                tempId: item.tempId,
                title: item.title,
                parentTempId: item.parentTempId,
            }, '[imports.service] Parent item not yet created - action will have null parentActionId');
        }

        const parentItem = itemsByTempId.get(item.parentTempId!);
        if (parentItem?.parentTempId) {
            const grandparentId = ctx.createdIds[parentItem.parentTempId];
            if (!grandparentId && parentItem.parentTempId) {
                logger.warn({
                    tempId: item.tempId,
                    title: item.title,
                    grandparentTempId: parentItem.parentTempId,
                }, '[imports.service] Grandparent container not found - falling back to targetProjectId');
            }
            contextId = grandparentId ?? targetProjectId ?? undefined;
        } else {
            contextId = targetProjectId ?? undefined;
        }
    } else if (item.parentTempId) {
        const resolvedContainer = ctx.createdIds[item.parentTempId];
        if (!resolvedContainer) {
            logger.warn({
                tempId: item.tempId,
                title: item.title,
                parentTempId: item.parentTempId,
            }, '[imports.service] Parent container not found - falling back to targetProjectId');
        }
        contextId = resolvedContainer ?? targetProjectId ?? undefined;
    } else {
        contextId = targetProjectId ?? undefined;
    }

    return { contextId, parentActionId };
}

/**
 * Determine the effective context type from container or project.
 */
function resolveContextType(
    effectiveContextId: string,
    containerTypes: Map<string, string>,
    targetProjectId: string | null
): ContextType {
    if (effectiveContextId) {
        const parentType = containerTypes.get(effectiveContextId);
        if (parentType) {
            return getContextTypeFromNodeType(parentType);
        } else if (effectiveContextId === targetProjectId) {
            return 'project';
        } else {
            // Context ID exists but is not a known container or the target project
            // This may indicate an existing hierarchy node from a previous import
            logger.warn({
                effectiveContextId,
                targetProjectId,
            }, '[imports.service] Context ID not found in containerTypes or targetProjectId - defaulting to subprocess');
        }
    }
    return 'subprocess';
}

const VALID_CONFIDENCE_VALUES = new Set(['low', 'medium', 'high']);

/**
 * Process fact candidates from an interpretation plan.
 */
async function processFactCandidates(
    outputs: Array<{ kind: string; [key: string]: unknown }>,
    actionId: string,
    effectiveContextId: string,
    effectiveContextType: ContextType,
    ctx: ExecutionContext,
    userId?: string
): Promise<void> {
    for (const output of outputs) {
        if (output.kind === 'fact_candidate') {
            // Validate factKind is a non-empty string
            const rawFactKind = output.factKind;
            if (typeof rawFactKind !== 'string' || !rawFactKind.trim()) {
                logger.error({ output, actionId }, '[imports.service] Skipping fact_candidate with invalid or missing factKind');
                continue;
            }
            const factKind = rawFactKind.trim();

            // Validate and normalize confidence
            const rawConfidence = output.confidence;
            let confidence: 'low' | 'medium' | 'high' = 'medium';
            if (typeof rawConfidence === 'string' && VALID_CONFIDENCE_VALUES.has(rawConfidence)) {
                confidence = rawConfidence as 'low' | 'medium' | 'high';
            } else if (rawConfidence !== undefined && rawConfidence !== null) {
                logger.warn({ output, actionId, rawConfidence }, '[imports.service] Invalid confidence value, defaulting to medium');
            }

            const { kind: _kind, factKind: _, confidence: __, ...cleanPayload } = output;

            await ensureFactKindDefinition({
                factKind,
                source: 'csv-import',
                confidence,
                examplePayload: cleanPayload,
            });

            await emitEvent({
                contextId: effectiveContextId,
                contextType: effectiveContextType,
                actionId,
                type: 'FACT_RECORDED',
                payload: {
                    factKind,
                    source: 'csv-import',
                    confidence,
                    ...cleanPayload,
                },
                actorId: userId,
            });
            ctx.counters.factEventsEmitted++;
        }
    }
}

/**
 * Emit a work event (WORK_STARTED, WORK_FINISHED, WORK_BLOCKED).
 */
async function emitWorkEvent(
    statusEvent: { kind: string; eventType?: string; source?: string },
    originalStatus: string | undefined,
    actionId: string,
    effectiveContextId: string,
    effectiveContextType: ContextType,
    ctx: ExecutionContext,
    userId?: string
): Promise<void> {
    const typedEvent = statusEvent as {
        kind: 'work_event';
        eventType: 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED';
        source?: string;
    };

    // Guard against 'stage' contextType which is deprecated and will throw in emitEvent
    // Convert to 'subprocess' as the safe fallback
    let safeContextType: ContextType = effectiveContextType;
    if (effectiveContextType === 'stage') {
        logger.warn({
            actionId,
            effectiveContextId,
            originalContextType: effectiveContextType,
        }, '[imports.service] Stage context deprecated for work events - using subprocess');
        safeContextType = 'subprocess';
    }

    await emitEvent({
        contextId: effectiveContextId,
        contextType: safeContextType,
        actionId,
        type: typedEvent.eventType,
        payload: {
            source: typedEvent.source || 'csv-import',
            originalStatus,
        },
        actorId: userId,
    });
    ctx.counters.workEventsEmitted++;
}

/**
 * Process interpretation plan for an action (stored or fresh).
 */
async function processInterpretationForAction(
    item: ImportPlanItem,
    actionId: string,
    classification: ItemClassification | undefined,
    effectiveContextId: string,
    effectiveContextType: ContextType,
    ctx: ExecutionContext,
    userId?: string
): Promise<void> {
    const interpretationPlan = classification?.interpretationPlan;

    if (interpretationPlan) {
        // V2 Path: Process stored InterpretationPlan
        const shouldCommitFacts =
            classification?.outcome === 'FACT_EMITTED' ||
            (classification?.resolution?.resolvedOutcome === 'FACT_EMITTED');

        if (shouldCommitFacts) {
            await processFactCandidates(
                interpretationPlan.outputs,
                actionId,
                effectiveContextId,
                effectiveContextType,
                ctx,
                userId
            );
        }

        // Count field values
        for (const output of interpretationPlan.outputs) {
            if (output.kind === 'field_value') {
                ctx.counters.fieldValuesApplied++;
            }
        }

        // Auto-commit work_event from status
        if (interpretationPlan.statusEvent && interpretationPlan.statusEvent.kind === 'work_event') {
            await emitWorkEvent(
                interpretationPlan.statusEvent,
                interpretationPlan.raw.status,
                actionId,
                effectiveContextId,
                effectiveContextType,
                ctx,
                userId
            );
        }
    } else {
        // No stored plan - generate one on-the-fly
        const statusValue = (item.metadata as { status?: string })?.status;
        const targetDate = (item.metadata as { targetDate?: string })?.targetDate;
        const stageName = (item.metadata as { 'import.stage_name'?: string })?.['import.stage_name'];

        const freshPlan = interpretCsvRowPlan({
            text: item.title,
            status: statusValue,
            targetDate: targetDate,
            stageName: stageName ?? undefined,
        });

        // Process fact_candidate outputs
        await processFactCandidates(
            freshPlan.outputs,
            actionId,
            effectiveContextId,
            effectiveContextType,
            ctx,
            userId
        );

        // Auto-commit work_event from status
        if (freshPlan.statusEvent && freshPlan.statusEvent.kind === 'work_event') {
            await emitWorkEvent(
                freshPlan.statusEvent,
                statusValue,
                actionId,
                effectiveContextId,
                effectiveContextType,
                ctx,
                userId
            );
        }
    }
}

/**
 * Create a single action and emit associated events.
 */
async function createActionWithEvents(
    item: ImportPlanItem,
    itemsByTempId: Map<string, ImportPlanItem>,
    ctx: ExecutionContext,
    targetProjectId: string | null,
    userId?: string
): Promise<boolean> {
    // Skip if already created
    if (ctx.createdIds[item.tempId]) {
        return false;
    }

    // Template deduplication
    if (item.entityType === 'template') {
        const deduplicated = await checkTemplateDeduplication(item, ctx);
        if (deduplicated) return false;
    }

    // Resolve context
    const { contextId, parentActionId } = resolveItemContext(item, itemsByTempId, ctx, targetProjectId);

    // Templates without context can be created; others require context
    if (!contextId && item.entityType !== 'template') {
        logger.warn(
            {
                module: 'imports.service',
                operation: 'executePlanViaComposer',
                tempId: item.tempId,
                itemTitle: item.title,
                entityType: item.entityType,
                parentTempId: item.parentTempId,
            },
            'Skipping item without context'
        );
        ctx.counters.skippedNoContext++;
        return false;
    }

    const effectiveContextId = contextId ?? '';
    const effectiveContextType = resolveContextType(effectiveContextId, ctx.containerTypes, targetProjectId);

    // Create action
    const action = await db
        .insertInto('actions')
        .values({
            context_type: effectiveContextType,
            context_id: effectiveContextId,
            parent_action_id: parentActionId,
            type: 'Task',
            field_bindings: JSON.stringify([
                { fieldKey: 'title', value: item.title },
                ...item.fieldRecordings.map((fr: { fieldName: string; value: unknown }) => ({
                    fieldKey: fr.fieldName,
                    value: fr.value,
                })),
            ]),
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    ctx.createdIds[item.tempId] = action.id;
    ctx.counters.actionsCreated++;

    // Emit ACTION_DECLARED event
    await emitEvent({
        contextId: effectiveContextId,
        contextType: effectiveContextType,
        actionId: action.id,
        type: 'ACTION_DECLARED',
        payload: {
            title: item.title,
            metadata: item.metadata,
            parentActionId,
        },
        actorId: userId,
    });

    // Create sync mapping for Monday items
    const mondayMeta = (item.metadata as { monday?: { id: string; type: string } })?.monday;
    if (mondayMeta?.id) {
        await createMapping({
            provider: 'monday',
            externalId: mondayMeta.id,
            externalType: mondayMeta.type || 'item',
            localEntityType: 'action',
            localEntityId: action.id,
        });
    }

    // Process interpretation plan
    const classification = ctx.classificationMap.get(item.tempId);
    await processInterpretationForAction(
        item,
        action.id,
        classification,
        effectiveContextId,
        effectiveContextType,
        ctx,
        userId
    );

    return true;
}

// ============================================================================
// PHASE 5: RESULTS & PROJECTION REFRESH
// ============================================================================

interface ExecutionResults {
    createdIds: Record<string, string>;
    itemCount: number;
    containerCount: number;
    actionsCreated: number;
    recordsCreated: number;
    factEventsEmitted: number;
    workEventsEmitted: number;
    fieldValuesApplied: number;
    skippedNoContext: number;
    errors?: string[];
}

/**
 * Build execution results from context.
 */
function buildExecutionResults(plan: ImportPlan, ctx: ExecutionContext): ExecutionResults {
    logger.debug({
        containers: plan.containers.length,
        items: plan.items.length,
        actionsCreated: ctx.counters.actionsCreated,
        recordsCreated: ctx.counters.recordsCreated,
        skippedNoContext: ctx.counters.skippedNoContext,
        factEventsEmitted: ctx.counters.factEventsEmitted,
        workEventsEmitted: ctx.counters.workEventsEmitted,
    }, '[imports.service] Execution summary');

    return {
        createdIds: ctx.createdIds,
        itemCount: plan.items.length,
        containerCount: plan.containers.length,
        actionsCreated: ctx.counters.actionsCreated,
        recordsCreated: ctx.counters.recordsCreated,
        factEventsEmitted: ctx.counters.factEventsEmitted,
        workEventsEmitted: ctx.counters.workEventsEmitted,
        fieldValuesApplied: ctx.counters.fieldValuesApplied,
        skippedNoContext: ctx.counters.skippedNoContext,
        errors: ctx.executionErrors.length > 0 ? ctx.executionErrors : undefined,
    };
}

/**
 * Force projection refresh for target project.
 */
async function refreshProjectProjection(targetProjectId: string | null): Promise<void> {
    if (!targetProjectId) return;

    const { projectWorkflowSurface } = await import(
        '../../projections/workflow-surface.projector.js'
    );

    try {
        await projectWorkflowSurface(targetProjectId, 'project');
        logger.debug({ targetProjectId }, '[imports.service] Project projection refreshed');
    } catch (err) {
        logger.warn({ targetProjectId, error: err },
            '[imports.service] Failed to refresh project projection');
    }
}

// ============================================================================
// MAIN EXECUTION FUNCTION
// ============================================================================

async function executePlanViaComposer(
    plan: ImportPlan,
    targetProjectId: string | null,
    userId?: string
): Promise<ExecutionResults> {
    // Phase 1: Initialize execution context
    const ctx = createExecutionContext(plan);

    // Diagnostic: Log item distribution by entityType
    const entityTypeCounts = plan.items.reduce((acc, item) => {
        const type = item.entityType ?? 'undefined';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    logger.debug({ entityTypeCounts, classificationsCount: plan.classifications.length, targetProjectId }, '[imports.service] Plan execution starting');

    // Phase 2: Create containers (process, subprocess) as hierarchy nodes
    await createContainers(plan.containers, ctx, targetProjectId, userId);

    // Phase 3: Bulk Create Records
    const recordsByDef = groupRecordsByDefinition(plan.items, ctx.classificationMap);

    // Diagnostic: Log record filter results
    const recordCandidates = plan.items.filter(i => i.entityType === 'record').length;
    logger.debug({ recordCandidates, recordsWithSchema: Array.from(recordsByDef.values()).flat().length }, '[imports.service] Record filter results');

    // Execute bulk creation per definition
    for (const [defId, items] of recordsByDef) {
        await createBulkRecordsForDefinition(defId, items, ctx, targetProjectId, userId);
    }

    // Phase 4: Create work items via Actions + Events
    const itemsByTempId = new Map(plan.items.map(i => [i.tempId, i]));
    const { sortedItems } = topologicalSortItems(plan.items, itemsByTempId);

    // Create actions with events for each sorted item
    for (const item of sortedItems) {
        await createActionWithEvents(item, itemsByTempId, ctx, targetProjectId, userId);
    }

    // Phase 5: Build results and refresh projections
    await refreshProjectProjection(targetProjectId);
    return buildExecutionResults(plan, ctx);
}
