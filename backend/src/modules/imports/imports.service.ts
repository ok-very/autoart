/**
 * Imports Service
 *
 * Business logic for import sessions:
 * - Create/manage sessions
 * - Parse data and generate plans
 * - Execute plans via Action/Event creation
 * - Emit domain events from CSV subitems using interpreter mappings
 * - Auto-create fact kind definitions for discovered event types
 * - Connect to external sources (Monday, Asana) via connectors
 *
 * IMPORTANT: All event writes MUST go through emitEvent() to ensure
 * projection refresh and central validation guarantees.
 */

import { db } from '../../db/client.js';
import { MondayCSVParser } from './parsers/monday-csv-parser.js';
import { GenericCSVParser } from './parsers/generic-csv-parser.js';
import type { ImportPlan, ImportPlanContainer, ImportPlanItem, ItemClassification } from './types.js';
import { hasUnresolvedClassifications, countUnresolved } from './types.js';
import { interpretCsvRowPlan, mapStatusToWorkEvent, type InterpretationOutput, type InterpretationPlan } from '../interpreter/interpreter.service.js';
import { ensureFactKindDefinition } from '../records/fact-kinds.service.js';
import { listDefinitions } from '../records/records.service.js';
import { matchSchema } from './schema-matcher.js';
import { emitEvent } from '../events/events.service.js';
import { isInternalWork, type ClassificationOutcome } from '@autoart/shared';
import type { RecordDefinition } from '../../db/schema.js';

// Connector imports
import { MondayConnector } from './connectors/monday-connector.js';
import { getMondayToken } from './connections.service.js';
import { createMapping } from './sync.service.js';
import { interpretMondayBoard } from '../interpreter/monday-interpreter.js';

// ============================================================================
// PARSER REGISTRY
// ============================================================================

interface Parser {
    parse(rawData: string, config: Record<string, unknown>): {
        containers: ImportPlanContainer[];
        items: ImportPlanItem[];
        validationIssues: Array<{ severity: 'error' | 'warning'; message: string; recordTempId?: string }>;
    };
}

const PARSERS: Record<string, Parser> = {
    'monday': new MondayCSVParser(),
    'generic-csv': new GenericCSVParser(),
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export async function createSession(params: {
    parserName: string;
    rawData: string;
    config: Record<string, unknown>;
    targetProjectId?: string;
    userId?: string;
}) {
    const session = await db
        .insertInto('import_sessions')
        .values({
            parser_name: params.parserName,
            raw_data: params.rawData,
            parser_config: JSON.stringify(params.config),
            target_project_id: params.targetProjectId ?? null,
            status: 'pending',
            created_by: params.userId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return session;
}

/**
 * Create an import session from an external connector (Monday, Asana, etc.)
 */
export async function createConnectorSession(params: {
    connectorType: 'monday' | 'asana' | 'notion';
    connectorConfig: {
        boardId?: string;
        boardIds?: string[];
        includeSubitems?: boolean;
    };
    targetProjectId?: string;
    userId?: string;
}) {
    // Store connector config as parser_config, use connectorType as parser_name
    const session = await db
        .insertInto('import_sessions')
        .values({
            parser_name: `connector:${params.connectorType}`,
            raw_data: '', // No raw data for connector imports
            parser_config: JSON.stringify(params.connectorConfig),
            target_project_id: params.targetProjectId ?? null,
            status: 'pending',
            created_by: params.userId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return session;
}

/**
 * Generate a plan from a Monday.com connector session.
 */
export async function generatePlanFromConnector(
    sessionId: string,
    userId?: string
): Promise<ImportPlan> {
    const session = await getSession(sessionId);
    if (!session) {
        throw new Error(`Session ${sessionId} not found`);
    }

    // Parse connector config
    const config = session.parser_config as {
        boardId?: string;
        boardIds?: string[];
        includeSubitems?: boolean;
    };

    const boardIds = config.boardIds ?? (config.boardId ? [config.boardId] : []);
    if (boardIds.length === 0) {
        throw new Error('No board IDs specified in connector config');
    }

    // Get token for the user
    const token = await getMondayToken(userId);
    const connector = new MondayConnector(token);

    // Collect all nodes from all boards
    const allNodes: Parameters<typeof interpretMondayBoard>[0] = [];
    for (const boardId of boardIds) {
        for await (const node of connector.traverseHierarchy(boardId, {
            includeSubitems: config.includeSubitems ?? true,
        })) {
            allNodes.push(node);
        }
    }

    // Interpret nodes into ImportPlanItems
    const items = await interpretMondayBoard(allNodes, {
        projectId: session.target_project_id ?? undefined,
    });

    // Generate classifications
    const definitions = await listDefinitions();
    const classifications = generateClassifications(items, definitions);

    // Create the plan
    const plan: ImportPlan = {
        sessionId,
        items,
        containers: [], // Monday groups become stages, not containers
        classifications,
        validationIssues: [],
    };

    // Save plan to database
    await db
        .insertInto('import_plans')
        .values({
            session_id: sessionId,
            plan_data: JSON.stringify(plan),
            validation_issues: JSON.stringify(plan.validationIssues),
        })
        .execute();

    // Update session status
    const newStatus = hasUnresolvedClassifications(plan)
        ? 'needs_review'
        : 'planned';

    await db
        .updateTable('import_sessions')
        .set({ status: newStatus })
        .where('id', '=', sessionId)
        .execute();

    return plan;
}

export async function getSession(id: string) {
    return db
        .selectFrom('import_sessions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
}

export async function listSessions(params: {
    status?: 'pending' | 'planned' | 'needs_review' | 'executing' | 'completed' | 'failed';
    limit?: number;
}) {
    let query = db
        .selectFrom('import_sessions')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(params.limit ?? 20);

    if (params.status) {
        query = query.where('status', '=', params.status);
    }

    return query.execute();
}

// ============================================================================
// PLAN GENERATION
// ============================================================================

export async function generatePlan(sessionId: string): Promise<ImportPlan> {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const parser = PARSERS[session.parser_name];
    if (!parser) throw new Error(`Parser ${session.parser_name} not found`);

    // Parse config from JSONB
    const config = typeof session.parser_config === 'string'
        ? JSON.parse(session.parser_config)
        : session.parser_config ?? {};

    // Parse raw data into plan
    const { containers, items, validationIssues } = parser.parse(session.raw_data, config);

    // Fetch definitions for schema matching
    const definitions = await listDefinitions({ definitionKind: 'record' });

    // Generate classifications for each item (with schema matching)
    const classifications = generateClassifications(items, definitions);

    const planData: ImportPlan = {
        sessionId,
        containers,
        items,
        validationIssues,
        classifications,
    };

    // Persist plan
    await db
        .insertInto('import_plans')
        .values({
            session_id: sessionId,
            plan_data: JSON.stringify(planData),
            validation_issues: JSON.stringify(validationIssues),
        })
        .execute();

    // Determine session status based on classifications
    const hasUnresolved = hasUnresolvedClassifications(planData);
    const newStatus = hasUnresolved ? 'needs_review' : 'planned';

    await db
        .updateTable('import_sessions')
        .set({ status: newStatus, updated_at: new Date() })
        .where('id', '=', sessionId)
        .execute();

    return planData;
}

// ============================================================================
// CLASSIFICATION GENERATION
// ============================================================================

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
function generateClassifications(items: ImportPlanItem[], definitions: RecordDefinition[]): ItemClassification[] {
    return items.map((item) => {
        const text = item.title;
        const statusValue = (item.metadata as { status?: string })?.status;
        const targetDate = (item.metadata as { targetDate?: string })?.targetDate;
        const stageName = (item.metadata as { 'import.stage_name'?: string })?.['import.stage_name'];

        let baseClassification: ItemClassification;

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
            if (factCandidates.length > 0) {
                const emittedEvents = factCandidates.map(fc => ({
                    type: 'FACT_RECORDED' as const,
                    payload: {
                        factKind: fc.factKind,
                        source: 'csv-import' as const,
                        confidence: fc.confidence,
                        ...fc.payload,
                    },
                }));

                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'FACT_EMITTED' as ClassificationOutcome,
                    confidence: factCandidates[0].confidence || 'medium',
                    rationale: `Matched rule for ${factCandidates[0].factKind}`,
                    emittedEvents,
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
 * Add schema matching result to a classification
 */
function addSchemaMatch(
    classification: ItemClassification,
    fieldRecordings: ImportPlanItem['fieldRecordings'],
    definitions: RecordDefinition[]
): ItemClassification {
    // Skip schema matching if no field recordings
    if (!fieldRecordings || fieldRecordings.length === 0) {
        return classification;
    }

    const schemaResult = matchSchema(fieldRecordings, definitions);

    return {
        ...classification,
        schemaMatch: {
            definitionId: schemaResult.matchedDefinition?.id ?? null,
            definitionName: schemaResult.matchedDefinition?.name ?? null,
            matchScore: schemaResult.matchScore,
            proposedDefinition: schemaResult.proposedDefinition,
        },
    };
}

export async function getLatestPlan(sessionId: string): Promise<ImportPlan | null> {
    const planRow = await db
        .selectFrom('import_plans')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('created_at', 'desc')
        .executeTakeFirst();

    if (!planRow) return null;

    const planData = typeof planRow.plan_data === 'string'
        ? JSON.parse(planRow.plan_data)
        : planRow.plan_data;

    return planData as ImportPlan;
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
 */
export async function saveResolutions(
    sessionId: string,
    resolutions: Resolution[]
): Promise<ImportPlan> {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const plan = await getLatestPlan(sessionId);
    if (!plan) throw new Error('No plan found');

    // Apply resolutions to classifications
    for (const res of resolutions) {
        const classification = plan.classifications.find((c: ItemClassification) => c.itemTempId === res.itemTempId);
        if (classification) {
            classification.resolution = {
                resolvedOutcome: res.resolvedOutcome as any,
                resolvedFactKind: res.resolvedFactKind,
                resolvedPayload: res.resolvedPayload,
            };
        }
    }

    // Update the plan in database
    await db
        .updateTable('import_plans' as any)
        .set({ plan_data: JSON.stringify(plan) })
        .where('session_id', '=', sessionId)
        .execute();

    // Recalculate session status
    const hasUnresolved = hasUnresolvedClassifications(plan);
    const newStatus = hasUnresolved ? 'needs_review' : 'planned';

    await db
        .updateTable('import_sessions')
        .set({ status: newStatus, updated_at: new Date() })
        .where('id', '=', sessionId)
        .execute();

    return plan;
}

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

async function executePlanViaComposer(
    plan: ImportPlan,
    targetProjectId: string | null,
    userId?: string
) {
    const createdIds: Record<string, string> = {};
    let factEventsEmitted = 0;
    let workEventsEmitted = 0;
    let fieldValuesApplied = 0;

    // Build lookup map: itemTempId -> classification
    const classificationMap = new Map<string, ItemClassification>(
        plan.classifications.map((c: ItemClassification) => [c.itemTempId, c])
    );

    // Step 1: Create containers (process, subprocess) as hierarchy nodes
    for (const container of plan.containers) {
        const parentId = container.parentTempId
            ? createdIds[container.parentTempId]
            : targetProjectId;

        const created = await db
            .insertInto('hierarchy_nodes')
            .values({
                parent_id: parentId ?? null,
                type: container.type,
                title: container.title,
                metadata: JSON.stringify({}),
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        createdIds[container.tempId] = created.id;
    }

    // Step 2: Create work items via Actions + Events (proper Composer pattern)
    for (const item of plan.items) {
        // Use parent container if specified, otherwise fall back to target project
        const contextId = item.parentTempId
            ? createdIds[item.parentTempId]
            : targetProjectId;
        if (!contextId) {
            console.warn(`Parent container not found for item: ${item.tempId}`);
            continue;
        }

        // Create action for the work item
        const action = await db
            .insertInto('actions')
            .values({
                context_type: 'subprocess',
                context_id: contextId,
                type: 'Task', // Default to Task type
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

        // Record ACTION_DECLARED event via emitEvent (ensures projection refresh)
        await emitEvent({
            contextId: contextId,
            contextType: 'subprocess',
            actionId: action.id,
            type: 'ACTION_DECLARED',
            payload: {
                actionType: 'Task',
                title: item.title,
                metadata: item.metadata,
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
                        const { kind, factKind: _, confidence: __, ...cleanPayload } = output;

                        // Ensure fact kind definition exists (auto-create if needed)
                        await ensureFactKindDefinition({
                            factKind,
                            source: 'csv-import',
                            confidence,
                            examplePayload: cleanPayload,
                        });

                        await emitEvent({
                            contextId: contextId,
                            contextType: 'subprocess',
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
                    contextId: contextId,
                    contextType: 'subprocess',
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

            const plan = interpretCsvRowPlan({
                text: item.title,
                status: statusValue,
                targetDate: targetDate,
                stageName: stageName ?? undefined,
            });

            // Process fact_candidate outputs
            for (const output of plan.outputs) {
                if (output.kind === 'fact_candidate') {
                    const factKind = output.factKind as string;
                    const confidence = (output.confidence as 'low' | 'medium' | 'high') || 'medium';
                    const { kind, factKind: _, confidence: __, ...cleanPayload } = output;

                    await ensureFactKindDefinition({
                        factKind,
                        source: 'csv-import',
                        confidence,
                        examplePayload: cleanPayload,
                    });

                    await emitEvent({
                        contextId: contextId,
                        contextType: 'subprocess',
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
            if (plan.statusEvent && plan.statusEvent.kind === 'work_event') {
                const statusEvent = plan.statusEvent as {
                    kind: 'work_event';
                    eventType: 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED';
                    source?: string;
                };
                await emitEvent({
                    contextId: contextId,
                    contextType: 'subprocess',
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

    return {
        createdIds,
        itemCount: plan.items.length,
        containerCount: plan.containers.length,
        factEventsEmitted,
        workEventsEmitted,
        fieldValuesApplied,
    };
}

