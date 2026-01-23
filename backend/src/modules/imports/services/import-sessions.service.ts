/**
 * Import Sessions Service
 *
 * Handles session lifecycle: create, get, list.
 * Sessions track import state and configuration.
 */

import { db } from '../../../db/client.js';
import { logger } from '../../../utils/logger.js';
import { MondayCSVParser } from '../parsers/monday-csv-parser.js';
import { GenericCSVParser } from '../parsers/generic-csv-parser.js';
import type { ImportPlanContainer, ImportPlanItem } from '../types.js';

// Maximum allowed size for connector config JSON (100KB)
const MAX_CONNECTOR_CONFIG_SIZE = 100 * 1024;

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

export const PARSERS: Record<string, Parser> = {
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
    // Validate parserName against supported parsers
    if (!PARSERS[params.parserName]) {
        throw new Error(`Unsupported parser: ${params.parserName}. Supported parsers: ${Object.keys(PARSERS).join(', ')}`);
    }

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
    // Validate connector config size to prevent database bloat
    const configJson = JSON.stringify(params.connectorConfig);
    if (configJson.length > MAX_CONNECTOR_CONFIG_SIZE) {
        throw new Error(`Connector config exceeds maximum allowed size (${MAX_CONNECTOR_CONFIG_SIZE} bytes)`);
    }

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
} = {}) {
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

export async function getLatestPlan(sessionId: string): Promise<import('../types.js').ImportPlan | null> {
    const planRow = await db
        .selectFrom('import_plans')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('created_at', 'desc')
        .executeTakeFirst();

    if (!planRow) return null;

    try {
        const planData = typeof planRow.plan_data === 'string'
            ? JSON.parse(planRow.plan_data)
            : planRow.plan_data;

        return planData as import('../types.js').ImportPlan;
    } catch (err) {
        logger.error({ sessionId, error: err }, '[import-sessions] Failed to parse plan_data JSON');
        throw new Error(`Malformed plan data for session ${sessionId}`);
    }
}
