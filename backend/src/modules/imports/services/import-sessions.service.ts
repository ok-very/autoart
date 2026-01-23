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

// Maximum allowed size for config JSON (100KB) - applies to both parser config and connector config
const MAX_CONFIG_SIZE = 100 * 1024;

// Maximum allowed size for raw data (10MB) - prevents DoS via large payloads
const MAX_RAW_DATA_SIZE = 10 * 1024 * 1024;

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

    // Validate rawData is a string before computing byte length
    if (params.rawData === null || params.rawData === undefined) {
        throw new Error('rawData is required and cannot be null or undefined');
    }
    if (typeof params.rawData !== 'string') {
        throw new Error(`rawData must be a string, received ${typeof params.rawData}`);
    }

    // Validate rawData size to prevent DoS (use byte length for accuracy)
    const rawDataByteLength = Buffer.byteLength(params.rawData, 'utf8');
    if (rawDataByteLength > MAX_RAW_DATA_SIZE) {
        throw new Error(`Raw data exceeds maximum allowed size (${MAX_RAW_DATA_SIZE / 1024 / 1024}MB)`);
    }

    // Safely stringify config - catch non-serializable values (BigInt, circular refs, etc.)
    let configJson: string;
    try {
        configJson = JSON.stringify(params.config);
    } catch (err) {
        logger.error({ error: err }, '[import-sessions] Failed to serialize config');
        throw new Error('Config contains non-serializable values (e.g., BigInt, circular references, or functions)');
    }

    // Validate config size to prevent database bloat
    const configByteLength = Buffer.byteLength(configJson, 'utf8');
    if (configByteLength > MAX_CONFIG_SIZE) {
        throw new Error(`Config exceeds maximum allowed size (${MAX_CONFIG_SIZE / 1024}KB)`);
    }

    const session = await db
        .insertInto('import_sessions')
        .values({
            parser_name: params.parserName,
            raw_data: params.rawData,
            parser_config: configJson,
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
    // Use Buffer.byteLength for accurate byte counting (handles multi-byte UTF-8 characters)
    const configJson = JSON.stringify(params.connectorConfig);
    const configByteLength = Buffer.byteLength(configJson, 'utf8');
    if (configByteLength > MAX_CONFIG_SIZE) {
        throw new Error(`Connector config exceeds maximum allowed size (${MAX_CONFIG_SIZE / 1024}KB)`);
    }

    // Store connector config as parser_config, use connectorType as parser_name
    // Reuse configJson from validation to avoid redundant stringify
    const session = await db
        .insertInto('import_sessions')
        .values({
            parser_name: `connector:${params.connectorType}`,
            raw_data: '', // No raw data for connector imports
            parser_config: configJson,
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

// Maximum allowed limit for session queries to prevent resource exhaustion
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 20;

// Valid session statuses for runtime validation
const VALID_SESSION_STATUSES = new Set(['pending', 'planned', 'needs_review', 'executing', 'completed', 'failed']);

export async function listSessions(params: {
    status?: 'pending' | 'planned' | 'needs_review' | 'executing' | 'completed' | 'failed';
    limit?: number;
} = {}) {
    // Cap the limit to prevent excessive result sets, ensure at least 1
    const requestedLimit = params.limit ?? DEFAULT_LIST_LIMIT;
    const effectiveLimit = Math.max(1, Math.min(requestedLimit, MAX_LIST_LIMIT));

    let query = db
        .selectFrom('import_sessions')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(effectiveLimit);

    // Validate status at runtime to prevent unexpected values from untrusted input
    if (params.status) {
        if (!VALID_SESSION_STATUSES.has(params.status)) {
            logger.warn({ providedStatus: params.status }, '[import-sessions] Invalid status parameter ignored');
        } else {
            query = query.where('status', '=', params.status);
        }
    }

    return query.execute();
}

// Custom error class for plan data validation errors (avoids message text matching)
class PlanDataError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PlanDataError';
    }
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
        // Handle null/undefined/primitive values before parsing
        if (planRow.plan_data === null || planRow.plan_data === undefined) {
            logger.error({ sessionId }, '[import-sessions] plan_data is null or undefined');
            throw new PlanDataError(`Missing plan data for session ${sessionId}`);
        }

        const planData = typeof planRow.plan_data === 'string'
            ? JSON.parse(planRow.plan_data)
            : planRow.plan_data;

        // Validate that planData is an object with required ImportPlan fields
        if (typeof planData !== 'object' || planData === null) {
            logger.error({ sessionId, planDataType: typeof planData }, '[import-sessions] plan_data is not an object');
            throw new PlanDataError(`Invalid plan data format for session ${sessionId}`);
        }

        if (!Array.isArray(planData.containers) || !Array.isArray(planData.items) || !Array.isArray(planData.classifications)) {
            logger.error({ sessionId }, '[import-sessions] plan_data missing required arrays');
            throw new PlanDataError(`Incomplete plan data for session ${sessionId}`);
        }

        return planData as import('../types.js').ImportPlan;
    } catch (err) {
        // Re-throw our validation errors (use error type, not message text)
        if (err instanceof PlanDataError) {
            throw err;
        }
        logger.error({ sessionId, error: err }, '[import-sessions] Failed to parse plan_data JSON');
        throw new Error(`Malformed plan data for session ${sessionId}`);
    }
}
