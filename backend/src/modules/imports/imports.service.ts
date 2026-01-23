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

import { randomUUID } from 'node:crypto';
import { isInternalWork, type ClassificationOutcome } from '@autoart/shared';

import { logger } from '../../utils/logger.js';

import { getMondayToken } from './connections.service.js';
import { MondayConnector } from './connectors/monday-connector.js';
import { GenericCSVParser } from './parsers/generic-csv-parser.js';
import { MondayCSVParser } from './parsers/monday-csv-parser.js';
import { matchSchema } from './schema-matcher.js';
import { createMapping } from './sync.service.js';
import type { ImportPlan, ImportPlanContainer, ImportPlanItem, ItemClassification, PendingLinkReference } from './types.js';
import { hasUnresolvedClassifications, countUnresolved } from './types.js';
import { db } from '../../db/client.js';
import type { RecordDefinition } from '../../db/schema.js';
import { emitEvent } from '../events/events.service.js';
import { interpretCsvRowPlan, type InterpretationOutput } from '../interpreter/interpreter.service.js';
import { interpretMondayData, inferBoardConfig } from './monday/monday-domain-interpreter.js';
import type { MondayWorkspaceConfig } from './monday/monday-config.types.js';
import * as mondayWorkspaceService from './monday/monday-workspace.service.js';
import { ensureFactKindDefinition } from '../records/fact-kinds.service.js';
import { listDefinitions, createRecord, bulkCreateRecords } from '../records/records.service.js';

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

// ... (skipping to executePlanViaComposer content)

// Execute bulk creation per definition

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

    // Use provided userId or fall back to session creator
    const effectiveUserId = userId ?? session.created_by ?? undefined;

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
    const token = await getMondayToken(effectiveUserId);
    const connector = new MondayConnector(token);

    // Collect all nodes from all boards
    const allNodes: any[] = [];
    for (const boardId of boardIds) {
        for await (const node of connector.traverseHierarchy(boardId, {
            includeSubitems: config.includeSubitems ?? true,
        })) {
            allNodes.push(node);
        }
    }

    // 1. Identify/Ensure Workspace
    // For V1, we try to use an existing workspace created by this user or create a default one.
    // In future, UI should allow selecting workspace.
    const existingWorkspaces = await mondayWorkspaceService.listWorkspaces(effectiveUserId);
    let workspaceConfig: MondayWorkspaceConfig | null = null;
    let workspaceId = existingWorkspaces[0]?.id;

    if (workspaceId) {
        workspaceConfig = await mondayWorkspaceService.getFullWorkspaceConfig(workspaceId);
    }

    if (!workspaceConfig) {
        // Create new default workspace
        workspaceId = randomUUID();
        const newWorkspace = await mondayWorkspaceService.createWorkspace({
            id: workspaceId,
            name: 'Monday.com Workspace',
            created_by: effectiveUserId,
            settings: {},
        });

        // Hydrate empty config
        workspaceConfig = {
            id: newWorkspace.id,
            name: newWorkspace.name,
            providerAccountId: newWorkspace.provider_account_id ?? undefined,
            defaultProjectId: newWorkspace.default_project_id ?? undefined,
            settings: newWorkspace.settings as any,
            boards: [],
            createdAt: newWorkspace.created_at,
            updatedAt: newWorkspace.updated_at,
        };
    }

    // 2. Resolve Board Configs
    const uniqueBoardIds = Array.from(new Set(allNodes.filter((n) => n.type === 'board').map((n) => n.id)));

    // We already have board configs in `workspaceConfig.boards` if we fetched full config
    const existingBoardConfigMap = new Map(workspaceConfig!.boards.map(b => [b.boardId, b]));

    const boardConfigsToUpsert: any[] = [];

    for (const boardId of uniqueBoardIds) {
        if (existingBoardConfigMap.has(boardId)) {
            continue; // Already configured
        }

        // Infer config for new board
        const boardNode = allNodes.find(n => n.type === 'board' && n.id === boardId);
        const boardName = boardNode?.name || `Board ${boardId}`;

        const groups = allNodes
            .filter(n => n.type === 'group' && n.metadata.boardId === boardId)
            .map(g => ({ id: g.id, title: g.name }));

        // Collect unique columns
        const columnMap = new Map<string, { id: string, title: string, type: string }>();
        for (const node of allNodes) {
            // Inspect column values from items to discover columns
            if (node.metadata.boardId === boardId && node.columnValues) {
                for (const cv of node.columnValues) {
                    if (!columnMap.has(cv.id)) {
                        columnMap.set(cv.id, { id: cv.id, title: cv.title, type: cv.type });
                    }
                }
            }
        }
        const columns = Array.from(columnMap.values());

        const inferred = inferBoardConfig(boardId, boardName, groups, columns);
        boardConfigsToUpsert.push(inferred);
    }

    // Upsert Inferred Configs (Persist to DB)
    if (boardConfigsToUpsert.length > 0) {
        // We utilize saveFullWorkspaceConfig to merge new boards. 
        // We construct a composite config.
        const updatedConfig: MondayWorkspaceConfig = {
            ...workspaceConfig!,
            boards: [...workspaceConfig!.boards, ...boardConfigsToUpsert],
        };

        // Save to DB
        await mondayWorkspaceService.saveFullWorkspaceConfig(updatedConfig, effectiveUserId);

        // Refresh local config variable
        const refetched = await mondayWorkspaceService.getFullWorkspaceConfig(workspaceId!);
        if (refetched) {
            workspaceConfig = refetched;
        }
    }

    // 3. Interpret using Domain Interpreter
    if (!workspaceConfig) throw new Error('Failed to resolve workspace config');

    const plan = interpretMondayData(
        allNodes,
        workspaceConfig,
        sessionId
    );

    // 4. Generate classifications for Monday items (same as CSV imports)
    // This enables proper gating and schema matching for records
    const definitions = await listDefinitions({ definitionKind: 'record' });
    plan.classifications = generateClassificationsForConnectorItems(plan.items, definitions);

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

    // Handle connector sessions
    if (session.parser_name.startsWith('connector:')) {
        if (session.parser_name === 'connector:monday') {
            return generatePlanFromConnector(sessionId, session.created_by ?? undefined);
        }
        throw new Error(`Connector ${session.parser_name} not supported for regeneration`);
    }

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
 * Generate classifications for connector (Monday) imports.
 *
 * Unlike CSV imports which use text interpretation rules,
 * connector imports classify based on entityType:
 * - 'record' → DERIVED_STATE (needs schema matching)
 * - 'template' → DERIVED_STATE (auto-commit, no schema match needed)
 * - 'action'/'task'/'subtask' → INTERNAL_WORK (create as action)
 * - others → UNCLASSIFIED
 */
function generateClassificationsForConnectorItems(
    items: ImportPlanItem[],
    definitions: RecordDefinition[]
): ItemClassification[] {
    return items.map((item) => {
        let baseClassification: ItemClassification;

        switch (item.entityType) {
            case 'record': {
                // Records with no field data should be marked as needing review
                // Include empty schemaMatch for consistent object shape across all code paths
                const hasFieldData = item.fieldRecordings && item.fieldRecordings.length > 0;
                if (!hasFieldData) {
                    return {
                        itemTempId: item.tempId,
                        outcome: 'AMBIGUOUS' as ClassificationOutcome,
                        confidence: 'low' as const,
                        rationale: 'Record has no field data - cannot match to schema',
                        schemaMatch: {
                            definitionId: null,
                            definitionName: null,
                            matchScore: 0,
                            proposedDefinition: undefined,
                        },
                    };
                }
                // Records need schema matching to determine target definition
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'FACT_EMITTED' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: 'Record from connector - requires schema match',
                };
                // Add schema matching only for record types
                return addSchemaMatch(baseClassification, item.fieldRecordings, definitions);
            }

            case 'template':
                // Templates are auto-committed, no schema match needed
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'DERIVED_STATE' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: 'Template from connector - auto-commit',
                };
                return baseClassification;

            case 'action':
            case 'task':
            case 'subtask':
                // Actions are created as work items; no record schema match
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'INTERNAL_WORK' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: `${item.entityType} from connector - create as action`,
                };
                return baseClassification;

            case 'project':
            case 'stage':
                // These are containers, not items - treat as internal work without schema match
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'INTERNAL_WORK' as ClassificationOutcome,
                    confidence: 'high' as const,
                    rationale: `Container type ${item.entityType} - structural item`,
                };
                return baseClassification;

            default:
                // Unknown entity type - mark unclassified without schema match
                baseClassification = {
                    itemTempId: item.tempId,
                    outcome: 'UNCLASSIFIED' as ClassificationOutcome,
                    confidence: 'low' as const,
                    rationale: `Unknown entity type: ${item.entityType ?? 'undefined'}`,
                };
                return baseClassification;
        }
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
    // If no field recordings, return with empty schemaMatch for consistent shape
    if (!fieldRecordings || fieldRecordings.length === 0) {
        return {
            ...classification,
            schemaMatch: {
                definitionId: null,
                definitionName: null,
                matchScore: 0,
                proposedDefinition: undefined,
            },
        };
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
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        createdIds[container.tempId] = created.id;
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

            return {
                uniqueName: item.title,
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
        const recordsByName = new Map(result.records.map(r => [r.unique_name, r]));
        recordsCreated += result.created;
        logger.debug({ created: result.created, updated: result.updated, errors: result.errors.length }, '[imports.service] Bulk create result');

        for (const item of items) {
            const record = recordsByName.get(item.title);
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
        const aParentIsItem = a.parentTempId && itemsByTempId.has(a.parentTempId);
        const bParentIsItem = b.parentTempId && itemsByTempId.has(b.parentTempId);
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

        // NOTE: Record creation logic removed from here as it is handled by Bulk processing above.
        // Only Actions fall through to here.

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
        actionsCreated++;

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
                    const { kind: _kind2, factKind: _, confidence: __, ...cleanPayload } = output;

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

