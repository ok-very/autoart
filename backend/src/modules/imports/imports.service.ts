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

import { isInternalWork, type ClassificationOutcome } from '@autoart/shared';

import { getMondayToken } from './connections.service.js';
import { MondayConnector } from './connectors/monday-connector.js';
import { GenericCSVParser } from './parsers/generic-csv-parser.js';
import { MondayCSVParser } from './parsers/monday-csv-parser.js';
import { matchSchema } from './schema-matcher.js';
import { createMapping } from './sync.service.js';
import type { ImportPlan, ImportPlanContainer, ImportPlanItem, ItemClassification } from './types.js';
import { hasUnresolvedClassifications, countUnresolved } from './types.js';
import { db } from '../../db/client.js';
import type { RecordDefinition } from '../../db/schema.js';
import { emitEvent } from '../events/events.service.js';
import { interpretCsvRowPlan, mapStatusToWorkEvent, type InterpretationOutput, type InterpretationPlan } from '../interpreter/interpreter.service.js';
import { interpretMondayBoard } from '../interpreter/monday-interpreter.js';
import { ensureFactKindDefinition } from '../records/fact-kinds.service.js';
import { listDefinitions } from '../records/records.service.js';


// Connector imports

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
    const allItems = await interpretMondayBoard(allNodes, {
        projectId: session.target_project_id ?? undefined,
    });

    // DEBUG: Log what we received from interpreter (gated to avoid noise in production)
    if (process.env.NODE_ENV !== 'production') {
        const nodeTypeCounts = allNodes.reduce((acc, n) => {
            const key = n.type ?? 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const itemTypeCounts = allItems.reduce((acc, i) => {
            const key = i.entityType || 'undefined';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.debug('[imports.service] Monday import summary', {
            totalNodes: allNodes.length,
            totalItems: allItems.length,
            hasTargetProject: !!session.target_project_id,
            nodeTypeCounts,
            itemTypeCounts,
        });
    }

    // Separate containers (board → project only if no target, group → subprocess) from items
    const containers: ImportPlanContainer[] = [];
    const items: ImportPlanItem[] = [];
    const tempIdToContainer = new Map<string, ImportPlanContainer>();
    const groupIdToContainer = new Map<string, ImportPlanContainer>();

    // Track seen external IDs for template deduplication
    // Templates with the same Monday ID are deduplicated (linked/mirrored items)
    const seenExternalIds = new Map<string, string>(); // monday_id → tempId

    // Track boards already processed as containers (by Monday board ID)
    // This prevents boards from also appearing as items in the plan
    const boardsAsContainers = new Set<string>();

    // Track if we're importing into an existing project
    const hasTargetProject = !!session.target_project_id;

    // First pass: identify containers and build hierarchy
    for (const item of allItems) {
        const mondayMeta = item.metadata?.monday as {
            type?: string;
            groupId?: string;
            groupTitle?: string;
        } | undefined;
        const nodeType = mondayMeta?.type;

        if (nodeType === 'board') {
            // Board → Project container ONLY if no target project
            // When importing into existing project, board is just metadata
            if (!hasTargetProject) {
                const container: ImportPlanContainer = {
                    tempId: item.tempId,
                    type: 'project',
                    title: item.title,
                    parentTempId: null,
                };
                containers.push(container);
                tempIdToContainer.set(item.tempId, container);
            }
            // Track this board ID to prevent it from also appearing as an item
            const boardId = (mondayMeta as { id?: string; board_id?: string })?.board_id
                ?? (mondayMeta as { id?: string })?.id;
            if (boardId) {
                boardsAsContainers.add(boardId);
            }
            // Skip adding board as an item - it's structural only
            continue;
        } else if (nodeType === 'group') {
            // Groups become subprocesses - they provide organizational structure
            // This keeps "Templates", "Contact Lists", "Artist Lists" as containers
            const container: ImportPlanContainer = {
                tempId: item.tempId,
                type: 'subprocess',
                title: item.title,
                // Parent is either target project or the board-as-project
                parentTempId: hasTargetProject
                    ? null  // Will be resolved to target on execution
                    : (containers.find(c => c.type === 'project')?.tempId ?? null),
            };
            containers.push(container);
            tempIdToContainer.set(item.tempId, container);

            // Map group ID to container for child item assignment
            // Use both groupId (self-reference) and id (node ID) to ensure mapping
            const groupId = mondayMeta?.groupId ?? (mondayMeta as { id?: string })?.id;
            if (groupId) {
                groupIdToContainer.set(groupId, container);
            }
            continue; // Groups don't go in items array
        } else {
            // Items and subitems go to items array

            // BOARD DEDUPLICATION: Skip items that represent boards already added as containers
            const mondayBoardId = (mondayMeta as { board_id?: string })?.board_id
                ?? (item.entityType === 'project' ? (mondayMeta as { id?: string })?.id : null);
            if (mondayBoardId && boardsAsContainers.has(mondayBoardId)) {
                console.log(`[imports.service] Deduping board item "${item.title}" (board_id: ${mondayBoardId}) - already a container`);
                continue; // Skip duplicate board
            }

            // TEMPLATE DEDUPLICATION: Templates with the same Monday external_id
            // are deduplicated (e.g., "Vancouver Template" linked across multiple boards)
            const mondayId = (mondayMeta as { id?: string })?.id;
            if (item.entityType === 'template' && mondayId) {
                if (seenExternalIds.has(mondayId)) {
                    console.log(`[imports.service] Deduping template "${item.title}" (external_id: ${mondayId})`);
                    continue; // Skip duplicate template
                }
                seenExternalIds.set(mondayId, item.tempId);
            }

            // Parent assignment:
            // 1. Explicit subitem → parent item relationship (already set by interpreter)
            // 2. Group membership → subprocess container
            // 3. Fallback to project/target
            // NOTE: Templates skip parent assignment (hierarchy-agnostic)

            if (!item.parentTempId && item.entityType !== 'template') {
                const itemGroupId = mondayMeta?.groupId;
                const groupContainer = itemGroupId ? groupIdToContainer.get(itemGroupId) : null;

                if (groupContainer) {
                    // Item belongs to a group → parent is the group's subprocess
                    item.parentTempId = groupContainer.tempId;
                } else if (!hasTargetProject) {
                    // No group, no target → use first project container
                    const parentProject = containers.find(c => c.type === 'project');
                    item.parentTempId = parentProject?.tempId;
                }
                // When hasTargetProject && no group: leave parentTempId undefined
                // It will be resolved to target_project_id during execution
            }
            items.push(item);
        }
    }

    // Generate classifications (only for actual items, not containers)
    const definitions = await listDefinitions();
    const classifications = generateClassifications(items, definitions);

    // DEBUG: Log final result
    console.log('[imports.service] ===== DEBUG: Final Plan =====');
    console.log('[imports.service] Containers:', containers.length, containers.map(c => ({ type: c.type, title: c.title })));
    console.log('[imports.service] Items:', items.length, items.slice(0, 5).map(i => ({
        title: i.title,
        entityType: i.entityType,
        parentTempId: i.parentTempId?.slice(0, 10),
        groupTitle: (i.metadata?.monday as any)?.groupTitle,
    })));
    console.log('[imports.service] ================================');

    // Create the plan
    const plan: ImportPlan = {
        sessionId,
        items,
        containers,
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
    // Build itemsByTempId lookup for parent resolution
    const itemsByTempId = new Map(plan.items.map(i => [i.tempId, i]));

    // Sort items by parentage depth (items with container parents first, then children of items)
    // This ensures parents exist in createdIds before children are processed
    const sortedItems = [...plan.items].sort((a, b) => {
        // Items whose parent is a container come first
        const aParentIsItem = a.parentTempId && itemsByTempId.has(a.parentTempId);
        const bParentIsItem = b.parentTempId && itemsByTempId.has(b.parentTempId);
        if (aParentIsItem && !bParentIsItem) return 1;
        if (!aParentIsItem && bParentIsItem) return -1;
        return 0;
    });

    for (const item of sortedItems) {
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
                    console.log(`[imports.service] Template "${item.title}" already exists (mapped from ${mondayId}), reusing entity ${existingMapping.local_entity_id}`);
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
            console.warn(`Context not found for item: ${item.tempId} (${item.title})`);
            continue;
        }

        // Create action - type will be derived by projection from context and parent relationships
        // Use entityType hint if available for initial categorization, but projection is authoritative
        // For templates without context, use empty string to mark as hierarchy-agnostic.
        // Note: Empty string is intentional - null would violate FK constraints and emitEvent types.
        // Downstream logic should check for empty string to skip context-based projections.
        const effectiveContextId = contextId ?? '';

        const action = await db
            .insertInto('actions')
            .values({
                context_type: 'subprocess',
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

        // Record ACTION_DECLARED event - projection system updates views
        await emitEvent({
            contextId: effectiveContextId,
            contextType: 'subprocess',
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
                        const { kind, factKind: _, confidence: __, ...cleanPayload } = output;

                        // Ensure fact kind definition exists (auto-create if needed)
                        await ensureFactKindDefinition({
                            factKind,
                            source: 'csv-import',
                            confidence,
                            examplePayload: cleanPayload,
                        });

                        await emitEvent({
                            contextId: effectiveContextId,
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
                    contextId: effectiveContextId,
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
                        contextId: effectiveContextId,
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
                    contextId: effectiveContextId,
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

