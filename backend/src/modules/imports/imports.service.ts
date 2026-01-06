/**
 * Imports Service
 *
 * Business logic for import sessions:
 * - Create/manage sessions
 * - Parse data and generate plans
 * - Execute plans via Action/Event creation
 * - Emit domain events from CSV subitems using interpreter mappings
 * - Auto-create fact kind definitions for discovered event types
 *
 * IMPORTANT: All event writes MUST go through emitEvent() to ensure
 * projection refresh and central validation guarantees.
 */

import { db } from '../../db/client.js';
import { MondayCSVParser } from './parsers/monday-csv-parser.js';
import { GenericCSVParser } from './parsers/generic-csv-parser.js';
import type { ImportPlan, ImportPlanContainer, ImportPlanItem } from './types.js';
import { interpretCsvRow, mapStatusToWorkEvent } from '../interpreter/interpreter.service.js';
import { ensureFactKindDefinition } from '../records/fact-kinds.service.js';
import { emitEvent } from '../events/events.service.js';

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
    'monday-csv': new MondayCSVParser(),
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

export async function getSession(id: string) {
    return db
        .selectFrom('import_sessions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
}

export async function listSessions(params: {
    status?: 'pending' | 'planned' | 'executing' | 'completed' | 'failed';
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

    const planData: ImportPlan = {
        sessionId,
        containers,
        items,
        validationIssues,
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

    // Update session status
    await db
        .updateTable('import_sessions')
        .set({ status: 'planned', updated_at: new Date() })
        .where('id', '=', sessionId)
        .execute();

    return planData;
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
// IMPORT EXECUTION
// ============================================================================

export async function executeImport(sessionId: string, userId?: string) {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const plan = await getLatestPlan(sessionId);
    if (!plan) throw new Error('No plan found');

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
        const contextId = createdIds[item.parentTempId];
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

        // Step 3: Interpret item title for domain events using mapping rules
        const statusValue = (item.metadata as { status?: string })?.status;
        const targetDate = (item.metadata as { targetDate?: string })?.targetDate;
        const stageName = (item.metadata as { 'import.stage_name'?: string })?.['import.stage_name'];

        // Pass parent context for richer rule matching
        const factEvents = interpretCsvRow({
            text: item.title,
            status: statusValue,
            targetDate: targetDate,
            stageName: stageName ?? undefined,
        });

        // Emit FACT_RECORDED events via emitEvent (ensures projection refresh)
        for (const factEvent of factEvents) {
            // Ensure fact kind definition exists (auto-create if needed)
            // Store clean payload (without wrapper envelope)
            const { factKind, source, confidence, ...cleanPayload } = factEvent.payload;
            await ensureFactKindDefinition({
                factKind: factEvent.payload.factKind,
                source: 'csv-import',
                confidence: factEvent.payload.confidence as 'low' | 'medium' | 'high',
                examplePayload: cleanPayload,
            });

            await emitEvent({
                contextId: contextId,
                contextType: 'subprocess',
                actionId: action.id,
                type: 'FACT_RECORDED',
                payload: factEvent.payload,
                actorId: userId,
            });
            factEventsEmitted++;
        }

        // Step 4: Map status column to work lifecycle event via emitEvent
        const workEventType = mapStatusToWorkEvent(statusValue);
        if (workEventType) {
            await emitEvent({
                contextId: contextId,
                contextType: 'subprocess',
                actionId: action.id,
                type: workEventType,
                payload: {
                    source: 'csv-import',
                    originalStatus: statusValue,
                },
                actorId: userId,
            });
            workEventsEmitted++;
        }
    }

    return {
        createdIds,
        itemCount: plan.items.length,
        containerCount: plan.containers.length,
        factEventsEmitted,
        workEventsEmitted,
    };
}

