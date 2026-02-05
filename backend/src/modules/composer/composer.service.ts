/**
 * Composer Service
 *
 * The Composer is the single entry point for creating "task-like" work items
 * on top of the Action + Event architecture.
 *
 * It:
 * 1. Creates an Action (the intent of the work item)
 * 2. Emits the minimal set of Events (ACTION_DECLARED, FIELD_VALUE_RECORDED, etc.)
 * 3. Creates ActionReferences that bind the action to existing records
 * 4. Returns a view (computed by the interpreter) for immediate rendering
 *
 * GUARDRAIL: Never writes to the legacy task tables.
 */

import { sql, type Transaction } from 'kysely';

import type { ComposerInput, ComposerResponse, ContextType, ActionReference } from '@autoart/shared';
import type { Database } from '../../db/schema.js';

import { EventFactory } from './event-factory.js';
import { db } from '../../db/client.js';
import { ValidationError } from '../../utils/errors.js';
import * as interpreterService from '../interpreter/interpreter.service.js';


// Forbidden action types - these are legacy and should not be created
const LEGACY_ACTION_TYPES = ['legacy_task', 'LEGACY_TASK', 'task_node', 'TASK_NODE'];

export interface ComposeOptions {
    /** ID of the user/service performing the composition */
    actorId: string | null;
    /** Skip view computation (for performance) */
    skipView?: boolean;
    /** Optional transaction — if provided, compose runs within it instead of creating its own */
    trx?: Transaction<Database>;
}

/**
 * Main entry point - creates an Action, the associated Events, and any ActionReferences.
 *
 * All operations happen within a single database transaction for atomicity.
 */
export async function compose(
    input: ComposerInput,
    options: ComposeOptions
): Promise<ComposerResponse> {
    const { actorId, skipView = false } = options;

    // -----------------------------------------------------------------------
    // GUARDRAIL: Reject legacy task types
    // -----------------------------------------------------------------------
    if (LEGACY_ACTION_TYPES.includes(input.action.type)) {
        throw new ValidationError(
            `Legacy task creation is not allowed via Composer. ` +
            `Action type "${input.action.type}" is forbidden.`
        );
    }

    // Run everything in a transaction so we can roll back on any failure
    const execute = async (trx: Transaction<Database>) => {
        const contextId = input.action.contextId;
        const contextType = input.action.contextType;

        // -----------------------------------------------------------------------
        // 1. CREATE THE ACTION
        // -----------------------------------------------------------------------
        const action = await trx
            .insertInto('actions')
            .values({
                context_id: contextId,
                context_type: contextType,
                parent_action_id: input.action.parentActionId || null,
                type: input.action.type,
                field_bindings: sql`${JSON.stringify(input.action.fieldBindings || [])}::jsonb`,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // -----------------------------------------------------------------------
        // 2. BUILD AND EMIT EVENTS
        // -----------------------------------------------------------------------
        const eventsToCreate: Array<{
            context_id: string;
            context_type: ContextType;
            action_id: string;
            type: string;
            payload: Record<string, unknown>;
            actor_id: string | null;
        }> = [];

        // ACTION_DECLARED is always the first event - it anchors the entire chain
        const declaredEvent = EventFactory.actionDeclared(
            contextId,
            contextType,
            action.id,
            { type: input.action.type, fieldBindings: input.action.fieldBindings },
            actorId
        );
        eventsToCreate.push({
            context_id: declaredEvent.contextId,
            context_type: declaredEvent.contextType,
            action_id: declaredEvent.actionId,
            type: declaredEvent.type,
            payload: declaredEvent.payload,
            actor_id: declaredEvent.actorId,
        });

        // Emit FIELD_VALUE_RECORDED for each supplied field value
        if (input.fieldValues?.length) {
            for (const fv of input.fieldValues) {
                ensureFieldAllowed(input.action.fieldBindings || [], fv.fieldName);
                const fieldEvent = EventFactory.fieldValueRecorded(
                    contextId,
                    contextType,
                    action.id,
                    { fieldName: fv.fieldName, value: fv.value },
                    actorId
                );
                eventsToCreate.push({
                    context_id: fieldEvent.contextId,
                    context_type: fieldEvent.contextType,
                    action_id: fieldEvent.actionId,
                    type: fieldEvent.type,
                    payload: fieldEvent.payload,
                    actor_id: fieldEvent.actorId,
                });
            }
        }

        // Emit any extra events the caller requested
        if (input.emitExtraEvents?.length) {
            for (const extra of input.emitExtraEvents) {
                const genericEvent = EventFactory.generic(
                    contextId,
                    contextType,
                    action.id,
                    extra.type,
                    extra.payload || {},
                    actorId
                );
                eventsToCreate.push({
                    context_id: genericEvent.contextId,
                    context_type: genericEvent.contextType,
                    action_id: genericEvent.actionId,
                    type: genericEvent.type,
                    payload: genericEvent.payload,
                    actor_id: genericEvent.actorId,
                });
            }
        }

        // Bulk insert all events - serialize payload to JSONB
        if (eventsToCreate.length > 0) {
            for (const evt of eventsToCreate) {
                await trx
                    .insertInto('events')
                    .values({
                        context_id: evt.context_id,
                        context_type: evt.context_type,
                        action_id: evt.action_id,
                        type: evt.type,
                        payload: sql`${JSON.stringify(evt.payload)}::jsonb`,
                        actor_id: evt.actor_id,
                    })
                    .execute();
            }
        }

        // Fetch the created events for the response
        const createdEvents = await trx
            .selectFrom('events')
            .selectAll()
            .where('action_id', '=', action.id)
            .orderBy('occurred_at', 'asc')
            .execute();

        // -----------------------------------------------------------------------
        // 3. CREATE ACTION REFERENCES
        // -----------------------------------------------------------------------
        let createdReferences: ActionReference[] = [];
        if (input.references?.length) {
            const referencesToCreate = input.references.map((ref: { sourceRecordId: string; targetFieldKey?: string; mode?: 'static' | 'dynamic' }) => ({
                action_id: action.id,
                source_record_id: ref.sourceRecordId,
                target_field_key: ref.targetFieldKey || null,
                mode: ref.mode || 'dynamic',
            }));

            await trx
                .insertInto('action_references')
                .values(referencesToCreate)
                .execute();

            // Fetch the created references
            const dbRefs = await trx
                .selectFrom('action_references')
                .selectAll()
                .where('action_id', '=', action.id)
                .execute();

            createdReferences = dbRefs.map((ref) => ({
                id: ref.id,
                actionId: ref.action_id,
                sourceRecordId: ref.source_record_id,
                targetFieldKey: ref.target_field_key,
                mode: ref.mode,
                snapshotValue: ref.snapshot_value,
                createdAt: ref.created_at,
            }));
        }

        // -----------------------------------------------------------------------
        // 4. COMPUTE ACTION VIEW (optional)
        // -----------------------------------------------------------------------
        let view: ComposerResponse['view'] = undefined;
        if (!skipView) {
            try {
                // Note: This reads from the committed transaction, so the events must be visible
                const maybeView = await interpreterService.getActionViewById(action.id);
                // Convert null to undefined to satisfy Zod's optional() validation
                view = maybeView ?? undefined;
            } catch (error) {
                // Not fatal - the caller still gets the raw data
                console.warn('Composer: interpreter failed to compute view', error);
            }
        }

        // -----------------------------------------------------------------------
        // 5. RETURN THE COMPOSER RESPONSE
        // -----------------------------------------------------------------------
        const response: ComposerResponse = {
            action: {
                id: action.id,
                contextId: action.context_id,
                contextType: action.context_type,
                parentActionId: action.parent_action_id || null,
                type: action.type,
                fieldBindings: action.field_bindings as any || [],
                createdAt: action.created_at,
            },
            events: createdEvents.map((e) => ({
                id: e.id,
                contextId: e.context_id,
                contextType: e.context_type,
                actionId: e.action_id,
                type: e.type,
                payload: e.payload as Record<string, unknown>,
                actorId: e.actor_id,
                occurredAt: e.occurred_at,
            })),
            references: createdReferences.length > 0 ? createdReferences : undefined,
            view,
        };

        return response;
    };

    return options.trx ? execute(options.trx) : db.transaction().execute(execute);
}

/**
 * Validate that a field name exists in the action's declared bindings.
 */
function ensureFieldAllowed(fieldBindings: unknown[], fieldName: string): void {
    // If fieldBindings is empty or undefined, allow any field (permissive mode)
    if (!fieldBindings || fieldBindings.length === 0) {
        return;
    }

    // Check if the field is declared
    const binding = fieldBindings.find((b: any) => b.fieldKey === fieldName);
    if (!binding) {
        throw new ValidationError(
            `Field "${fieldName}" is not declared in the Action's fieldBindings. ` +
            `Only declared fields can have values recorded.`
        );
    }
}

