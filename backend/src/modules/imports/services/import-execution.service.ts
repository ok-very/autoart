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

import { db } from '../../../db/client.js';
import type { ContextType } from '../../../db/schema.js';
import { emitEvent } from '../../events/events.service.js';
import { interpretCsvRowPlan } from '../../interpreter/interpreter.service.js';
import { ensureFactKindDefinition } from '../../records/fact-kinds.service.js';
import { bulkCreateRecords } from '../../records/records.service.js';
import { logger } from '../../../utils/logger.js';
import { createMapping } from '../sync.service.js';
import type { ImportPlan, ImportPlanItem, ItemClassification } from '../types.js';
import { hasUnresolvedClassifications, countUnresolved } from '../types.js';
import { getSession, getLatestPlan } from './import-sessions.service.js';

// ============================================================================
// IMPORT EXECUTION
// ============================================================================

export async function executeImport(sessionId: string, userId?: string) {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const plan = await getLatestPlan(sessionId);
    if (!plan) throw new Error('No plan found');

    // Gate: block execution if unresolved classifications exist
    if (hasUnresolvedClassifications(plan)) {
        const { ambiguous, unclassified } = countUnresolved(plan);
        await db
            .updateTable('import_sessions')
            .set({ status: 'needs_review', updated_at: new Date() })
            .where('id', '=', sessionId)
            .execute();
        return {
            blocked: true,
            unresolvedCount: ambiguous + unclassified,
            ambiguous,
            unclassified,
            message: 'Import blocked: resolve ambiguous/unclassified items first',
        };
    }

    // Get latest plan row for the plan_id
    const planRow = await db
        .selectFrom('import_plans')
        .select('id')
        .where('session_id', '=', sessionId)
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow();

    // Start execution
    const execution = await db
        .insertInto('import_executions')
        .values({
            session_id: sessionId,
            plan_id: planRow.id,
            status: 'running',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    // Update session status
    await db
        .updateTable('import_sessions')
        .set({ status: 'executing', updated_at: new Date() })
        .where('id', '=', sessionId)
        .execute();

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
        await db
            .updateTable('import_sessions')
            .set({ status: 'completed', updated_at: new Date() })
            .where('id', '=', sessionId)
            .execute();

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
        await db
            .updateTable('import_sessions')
            .set({ status: 'failed', updated_at: new Date() })
            .where('id', '=', sessionId)
            .execute();

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

async function executePlanViaComposer(
    plan: ImportPlan,
    targetProjectId: string | null,
    userId?: string
) {
    const createdIds: Record<string, string> = {};
    const containerTypes = new Map<string, string>(); // Track container types for context resolution
    const executionErrors: string[] = [];
    let factEventsEmitted = 0;
    let workEventsEmitted = 0;
    let fieldValuesApplied = 0;
    let actionsCreated = 0;
    let recordsCreated = 0;
    let skippedNoContext = 0;

    // Build lookup map: itemTempId -> classification
    const classificationMap = new Map<string, ItemClassification>(
        plan.classifications.map((c: ItemClassification) => [c.itemTempId, c])
    );

    // Diagnostic: Log item distribution by entityType
    const entityTypeCounts = plan.items.reduce((acc, item) => {
        const type = item.entityType ?? 'undefined';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    logger.debug({ entityTypeCounts, classificationsCount: plan.classifications.length, targetProjectId }, '[imports.service] Plan execution starting');

    // Step 1: Create containers (process, subprocess) as hierarchy nodes
    for (const container of plan.containers) {
        const parentId = container.parentTempId
            ? createdIds[container.parentTempId]
            : targetProjectId;

        // Build metadata including provenance info from container
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

        createdIds[container.tempId] = created.id;
        containerTypes.set(created.id, container.type);
    }

    // Step 1.5: Bulk Create Records (Optimization)
    // Identify valid records and group by definition for bulk processing
    const recordsByDef = new Map<string, ImportPlanItem[]>();

    // Helper to check if an item is a creatable record
    const isCreatableRecord = (item: ImportPlanItem) => {
        if (item.entityType !== 'record') return false;
        const classification = classificationMap.get(item.tempId);
        return !!classification?.schemaMatch?.definitionId;
    };

    for (const item of plan.items) {
        if (isCreatableRecord(item)) {
            const classification = classificationMap.get(item.tempId)!;
            // We checked existence above
            const definitionId = classification.schemaMatch!.definitionId!;

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

    // Diagnostic: Log record filter results
    const recordCandidates = plan.items.filter(i => i.entityType === 'record').length;
    logger.debug({ recordCandidates, recordsWithSchema: Array.from(recordsByDef.values()).flat().length }, '[imports.service] Record filter results');

    // Execute bulk creation per definition
    for (const [defId, items] of recordsByDef) {
        logger.debug({ definitionId: defId, count: items.length }, '[imports.service] Creating records for definition');
        const bulkInput = items.map(item => {
            const recordData = (item.fieldRecordings || []).reduce((acc, fr) => {
                acc[fr.fieldName] = fr.value;
                return acc;
            }, {} as Record<string, unknown>);

            // Add title as a standard field if not present (convention)
            if (!recordData.name && !recordData.title) {
                recordData.title = item.title;
            }

            // Use parent container as classification node if available
            const parentContainerId = item.parentTempId
                ? createdIds[item.parentTempId]
                : null;

            // Use tempId as uniqueName to prevent collisions when multiple items share the same title
            // The tempId is guaranteed unique within the import session
            return {
                uniqueName: item.tempId,
                data: recordData,
                classificationNodeId: parentContainerId
            };
        });

        // Execute bulk upsert
        // Returns { created, updated, errors, records[] }
        const result = await bulkCreateRecords(defId, bulkInput, userId);

        if (result.errors.length > 0) {
            console.warn(`[imports.service] Bulk record creation had ${result.errors.length} errors`, result.errors);
            // Propagate errors to response
            executionErrors.push(
                ...result.errors.map(e => `Record "${e.uniqueName}": ${e.error}`)
            );
        }

        // Map created records back to items to populate createdIds and mappings
        // Records are keyed by tempId (used as uniqueName) for collision-free lookups
        const recordsByTempId = new Map(result.records.map(r => [r.unique_name, r]));
        recordsCreated += result.created;
        logger.debug({ created: result.created, updated: result.updated, errors: result.errors.length }, '[imports.service] Bulk create result');

        for (const item of items) {
            const record = recordsByTempId.get(item.tempId);
            if (record) {
                createdIds[item.tempId] = record.id;

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

                // Create external source mapping
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
                console.error(`[imports.service] Failed to match created record for item "${item.title}"`);
            }
        }
    }

    // Step 2: Create work items via Actions + Events (proper Composer pattern)
    // Build itemsByTempId lookup for parent resolution
    const itemsByTempId = new Map(plan.items.map(i => [i.tempId, i]));

    // Sort items by parentage depth (items with container parents first, then children of items)
    // This ensures parents exist in createdIds before children are processed
    const sortedItems = [...plan.items].sort((a, b) => {
        // Items whose parent is a container come first
        const aParentIsItem = Boolean(a.parentTempId && itemsByTempId.has(a.parentTempId));
        const bParentIsItem = Boolean(b.parentTempId && itemsByTempId.has(b.parentTempId));
        if (aParentIsItem && !bParentIsItem) return 1;
        if (!aParentIsItem && bParentIsItem) return -1;
        return 0;
    });

    for (const item of sortedItems) {
        // SKIP if already created (e.g. Bulk Records or Templates)
        if (createdIds[item.tempId]) {
            continue;
        }

        // CROSS-IMPORT TEMPLATE DEDUPLICATION
        // Templates are singletons - check if already imported from same external source
        if (item.entityType === 'template') {
            const mondayMeta = item.metadata?.monday as { id?: string } | undefined;
            const mondayId = mondayMeta?.id;

            if (mondayId) {
                // Check if this template already exists via external_source_mapping
                const existingMapping = await db
                    .selectFrom('external_source_mappings')
                    .select('local_entity_id')
                    .where('provider', '=', 'monday')
                    .where('external_id', '=', mondayId)
                    .executeTakeFirst();

                if (existingMapping) {
                    // Link to existing template instead of creating new
                    logger.debug({ title: item.title, mondayId, entityId: existingMapping.local_entity_id }, '[imports.service] Template already exists, reusing');
                    createdIds[item.tempId] = existingMapping.local_entity_id;
                    continue;
                }
            }
        }

        // Derive parent relationship from parentTempId:
        // - If parentTempId refers to another item → this is a child action (parent_action_id set)
        // - If parentTempId refers to a container → this is a container-scoped action
        // - Type is derived by projection system from context, not set explicitly here
        const parentIsItem = item.parentTempId && itemsByTempId.has(item.parentTempId);

        let contextId: string | undefined;
        let parentActionId: string | null = null;

        if (parentIsItem) {
            // Parent is another action (child relationship)
            parentActionId = createdIds[item.parentTempId!] ?? null;
            // Context inherited from parent item's context
            const parentItem = itemsByTempId.get(item.parentTempId!);
            if (parentItem?.parentTempId) {
                // Parent item's parent could be a container
                contextId = createdIds[parentItem.parentTempId] ?? targetProjectId ?? undefined;
            } else {
                contextId = targetProjectId ?? undefined;
            }
        } else if (item.parentTempId) {
            // Parent is a container (container-scoped action)
            contextId = createdIds[item.parentTempId] ?? targetProjectId ?? undefined;
        } else {
            // No parent, use project context
            // Templates can be context-free, use target project if available
            contextId = targetProjectId ?? undefined;
        }

        // Templates without context can still be created (they're hierarchy-agnostic)
        // For non-templates, context is required
        if (!contextId && item.entityType !== 'template') {
            console.warn(`[imports.service] Skipping item without context: ${item.tempId} (${item.title}) - entityType: ${item.entityType}, parentTempId: ${item.parentTempId}`);
            skippedNoContext++;
            continue;
        }

        // Create action - type will be derived by projection from context and parent relationships
        // Use entityType hint if available for initial categorization, but projection is authoritative
        // For templates without context, use empty string to mark as hierarchy-agnostic.
        // Note: Empty string is intentional - null would violate FK constraints and emitEvent types.
        // Downstream logic should check for empty string to skip context-based projections.
        const effectiveContextId = contextId ?? '';

        // Determine correct context type from parent container or target project
        let effectiveContextType: ContextType = 'subprocess';
        if (effectiveContextId) {
            const parentType = containerTypes.get(effectiveContextId);
            if (parentType) {
                effectiveContextType = getContextTypeFromNodeType(parentType);
            } else if (effectiveContextId === targetProjectId) {
                effectiveContextType = 'project';
            }
        }

        // NOTE: Record creation logic removed from here as it is handled by Bulk processing above.
        // Only Actions fall through to here.

        const action = await db
            .insertInto('actions')
            .values({
                context_type: effectiveContextType,
                context_id: effectiveContextId,
                parent_action_id: parentActionId,
                type: 'Task', // Base type - projection derives actual type from relationships
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

        createdIds[item.tempId] = action.id;
        actionsCreated++;

        // Record ACTION_DECLARED event - projection system updates views
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

        // Step 2b: Create sync mapping for Monday items (enables future bi-directional sync)
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

        // Step 3: Use classification's interpretationPlan if available (V2 API)
        const classification = classificationMap.get(item.tempId);
        const interpretationPlan = classification?.interpretationPlan;

        if (interpretationPlan) {
            // V2 Path: Process InterpretationPlan outputs

            // Determine if fact_candidates should be committed
            // fact_candidate: Only commit if user approved (resolved to FACT_EMITTED)
            // work_event: Always auto-commit
            // field_value: Always auto-commit
            // action_hint: Never commit (stored as classification only)
            const shouldCommitFacts =
                classification?.outcome === 'FACT_EMITTED' ||
                (classification?.resolution?.resolvedOutcome === 'FACT_EMITTED');

            // Process fact_candidate outputs → FACT_RECORDED events (only if approved)
            if (shouldCommitFacts) {
                for (const output of interpretationPlan.outputs) {
                    if (output.kind === 'fact_candidate') {
                        const factKind = output.factKind as string;
                        const confidence = (output.confidence as 'low' | 'medium' | 'high') || 'medium';
                        const { kind: _kind, factKind: _, confidence: __, ...cleanPayload } = output;

                        // Ensure fact kind definition exists (auto-create if needed)
                        await ensureFactKindDefinition({
                            factKind,
                            source: 'csv-import',
                            confidence,
                            examplePayload: cleanPayload,
                        });

                        await emitEvent({
                            contextId: effectiveContextId,
                            contextType: effectiveContextType,
                            actionId: action.id,
                            type: 'FACT_RECORDED',
                            payload: {
                                factKind,
                                source: 'csv-import',
                                confidence,
                                ...cleanPayload,
                            },
                            actorId: userId,
                        });
                        factEventsEmitted++;
                    }
                }
            }

            // Auto-commit field_value outputs (always)
            for (const output of interpretationPlan.outputs) {
                if (output.kind === 'field_value') {
                    // Field values update the action's field_bindings
                    // For now, we track them but don't persist separately
                    // The field binding was already set in action creation
                    fieldValuesApplied++;
                }
            }

            // Auto-commit work_event from status (if present)
            if (interpretationPlan.statusEvent && interpretationPlan.statusEvent.kind === 'work_event') {
                const statusEvent = interpretationPlan.statusEvent as {
                    kind: 'work_event';
                    eventType: 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED';
                    source?: string;
                };
                await emitEvent({
                    contextId: effectiveContextId,
                    contextType: effectiveContextType,
                    actionId: action.id,
                    type: statusEvent.eventType,
                    payload: {
                        source: statusEvent.source || 'csv-import',
                        originalStatus: interpretationPlan.raw.status,
                    },
                    actorId: userId,
                });
                workEventsEmitted++;
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
            for (const output of freshPlan.outputs) {
                if (output.kind === 'fact_candidate') {
                    const factKind = output.factKind as string;
                    const confidence = (output.confidence as 'low' | 'medium' | 'high') || 'medium';
                    const { kind: _kind2, factKind: _, confidence: __, ...cleanPayload } = output;

                    await ensureFactKindDefinition({
                        factKind,
                        source: 'csv-import',
                        confidence,
                        examplePayload: cleanPayload,
                    });

                    await emitEvent({
                        contextId: effectiveContextId,
                        contextType: effectiveContextType,
                        actionId: action.id,
                        type: 'FACT_RECORDED',
                        payload: {
                            factKind,
                            source: 'csv-import',
                            confidence,
                            ...cleanPayload,
                        },
                        actorId: userId,
                    });
                    factEventsEmitted++;
                }
            }

            // Auto-commit work_event from status
            if (freshPlan.statusEvent && freshPlan.statusEvent.kind === 'work_event') {
                const statusEvent = freshPlan.statusEvent as {
                    kind: 'work_event';
                    eventType: 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED';
                    source?: string;
                };
                await emitEvent({
                    contextId: effectiveContextId,
                    contextType: effectiveContextType,
                    actionId: action.id,
                    type: statusEvent.eventType,
                    payload: {
                        source: statusEvent.source || 'csv-import',
                        originalStatus: statusValue,
                    },
                    actorId: userId,
                });
                workEventsEmitted++;
            }
        }
    }

    // Final diagnostic summary
    logger.debug({
        containers: plan.containers.length,
        items: plan.items.length,
        actionsCreated,
        recordsCreated,
        skippedNoContext,
        factEventsEmitted,
        workEventsEmitted,
    }, '[imports.service] Execution summary');

    // Force projection refresh for target project to ensure data is visible
    if (targetProjectId) {
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

    return {
        createdIds,
        itemCount: plan.items.length,
        containerCount: plan.containers.length,
        actionsCreated,
        recordsCreated,
        factEventsEmitted,
        workEventsEmitted,
        fieldValuesApplied,
        skippedNoContext,
        errors: executionErrors.length > 0 ? executionErrors : undefined,
    };
}
