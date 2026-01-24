/**
 * Import Plan Service
 *
 * Handles plan generation from various sources:
 * - CSV/file-based imports via parsers
 * - Connector-based imports (Monday, Asana, etc.)
 */

import { randomUUID } from 'node:crypto';

import { db } from '../../../db/client.js';
import { logger } from '../../../utils/logger.js';
import { getMondayToken } from '../connections.service.js';
import { MondayConnector } from '../connectors/monday-connector.js';
import { interpretMondayData, inferBoardConfig } from '../monday/monday-domain-interpreter.js';
import type { MondayWorkspaceConfig } from '../monday/monday-config.types.js';
import * as mondayWorkspaceService from '../monday/monday-workspace.service.js';
import { listDefinitions } from '../../records/records.service.js';
import type { ImportPlan } from '../types.js';
import { hasUnresolvedClassifications } from '../types.js';
import { getSession, getLatestPlan, PARSERS } from './import-sessions.service.js';
import { generateClassifications, generateClassificationsForConnectorItems } from './import-classification.service.js';

// Re-export getLatestPlan for convenience
export { getLatestPlan } from './import-sessions.service.js';

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

    // Validate raw_data exists and is a string before parsing
    if (session.raw_data === null || session.raw_data === undefined) {
        logger.error({ sessionId }, '[import-plan] Session raw_data is null or undefined');
        throw new Error(`Session ${sessionId} has no raw data to parse`);
    }
    if (typeof session.raw_data !== 'string') {
        logger.error({ sessionId, rawDataType: typeof session.raw_data }, '[import-plan] Session raw_data is not a string');
        throw new Error(`Session ${sessionId} has invalid raw data type`);
    }

    // Parse config from JSONB with error handling
    let config: Record<string, unknown>;
    try {
        config = typeof session.parser_config === 'string'
            ? JSON.parse(session.parser_config)
            : session.parser_config ?? {};
    } catch (err) {
        logger.error({ sessionId, error: err }, '[import-plan] Failed to parse parser_config JSON');
        throw new Error(`Malformed parser config for session ${sessionId}`);
    }

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

    // Determine session status based on classifications
    const hasUnresolved = hasUnresolvedClassifications(planData);
    const newStatus = hasUnresolved ? 'needs_review' : 'planned';

    // Use transaction with row-level locking to prevent concurrent plan creation
    await db.transaction().execute(async (trx) => {
        // Lock the session row to prevent concurrent generatePlan calls
        const lockedSession = await trx
            .selectFrom('import_sessions')
            .select('id')
            .where('id', '=', sessionId)
            .forUpdate()
            .executeTakeFirst();

        if (!lockedSession) {
            throw new Error(`Session ${sessionId} not found during plan creation`);
        }

        await trx
            .insertInto('import_plans')
            .values({
                session_id: sessionId,
                plan_data: JSON.stringify(planData),
                validation_issues: JSON.stringify(validationIssues),
            })
            .execute();

        await trx
            .updateTable('import_sessions')
            .set({ status: newStatus, updated_at: new Date() })
            .where('id', '=', sessionId)
            .execute();
    });

    return planData;
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

    // Parse connector config with defensive handling
    // createConnectorSession stores config as JSON string, so parse if needed
    let config: {
        boardId?: string;
        boardIds?: string[];
        includeSubitems?: boolean;
    };
    try {
        config = typeof session.parser_config === 'string'
            ? JSON.parse(session.parser_config)
            : (session.parser_config as typeof config) ?? {};
    } catch (err) {
        logger.error({ sessionId, error: err }, '[import-plan] Failed to parse connector parser_config JSON');
        throw new Error(`Malformed connector config for session ${sessionId}`);
    }

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
            .map(g => ({ id: g.id, title: g.title }));

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

    // Determine session status
    const newStatus = hasUnresolvedClassifications(plan)
        ? 'needs_review'
        : 'planned';

    // Use transaction with row-level locking to prevent concurrent plan creation
    await db.transaction().execute(async (trx) => {
        // Lock the session row to prevent concurrent generatePlan calls
        const lockedSession = await trx
            .selectFrom('import_sessions')
            .select('id')
            .where('id', '=', sessionId)
            .forUpdate()
            .executeTakeFirst();

        if (!lockedSession) {
            throw new Error(`Session ${sessionId} not found during plan creation`);
        }

        await trx
            .insertInto('import_plans')
            .values({
                session_id: sessionId,
                plan_data: JSON.stringify(plan),
                validation_issues: JSON.stringify(plan.validationIssues),
            })
            .execute();

        await trx
            .updateTable('import_sessions')
            .set({ status: newStatus, updated_at: new Date() })
            .where('id', '=', sessionId)
            .execute();
    });

    return plan;
}
