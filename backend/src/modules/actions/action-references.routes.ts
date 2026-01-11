/**
 * Action References Routes
 *
 * API endpoints for managing action-to-record references.
 * All mutations emit events and let the projector update the snapshot table.
 *
 * Endpoints:
 * - POST   /actions/:id/references        - Add a reference (emit event)
 * - POST   /actions/:id/references/remove - Remove a reference (emit event)
 * - GET    /actions/:id/references        - Get all references (read snapshot)
 */

import { FastifyInstance } from 'fastify';

import * as actionsService from './actions.service.js';
import { emitEvent } from '../events/events.service.js';
import { getActionReferences } from '../projections/action-references.projector.js';

// Response schema for references
const referenceSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', format: 'uuid' },
        action_id: { type: 'string', format: 'uuid' },
        source_record_id: { type: 'string', format: 'uuid', nullable: true },
        target_field_key: { type: 'string', nullable: true },
        mode: { type: 'string', enum: ['static', 'dynamic'] },
        snapshot_value: { nullable: true },
        created_at: { type: 'string', format: 'date-time' },
    },
};

export async function actionReferencesRoutes(fastify: FastifyInstance) {
    /**
     * POST /actions/:id/references - Add a reference
     * Emits ACTION_REFERENCE_ADDED event → projector updates snapshot.
     */
    fastify.post<{
        Params: { id: string };
        Body: {
            sourceRecordId: string;
            targetFieldKey: string;
            snapshotValue?: unknown;
        };
    }>(
        '/:id/references',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['sourceRecordId', 'targetFieldKey'],
                    properties: {
                        sourceRecordId: { type: 'string', format: 'uuid' },
                        targetFieldKey: { type: 'string' },
                        snapshotValue: { nullable: true },
                    },
                },
                response: {
                    201: {
                        type: 'object',
                        properties: {
                            event: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    type: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { id: actionId } = request.params;
            const { sourceRecordId, targetFieldKey, snapshotValue } = request.body;

            // Verify action exists
            const action = await actionsService.getActionById(actionId);
            if (!action) {
                return reply.status(404).send({ error: 'Action not found' });
            }

            // Emit the event - projector handles the snapshot update
            const event = await emitEvent({
                contextId: action.context_id,
                contextType: action.context_type,
                actionId: action.id,
                type: 'ACTION_REFERENCE_ADDED',
                payload: {
                    sourceRecordId,
                    targetFieldKey,
                    snapshotValue,
                },
            });

            return reply.status(201).send({ event });
        }
    );

    /**
     * POST /actions/:id/references/remove - Remove a reference
     * Emits ACTION_REFERENCE_REMOVED event → projector updates snapshot.
     */
    fastify.post<{
        Params: { id: string };
        Body: {
            sourceRecordId: string;
            targetFieldKey: string;
        };
    }>(
        '/:id/references/remove',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['sourceRecordId', 'targetFieldKey'],
                    properties: {
                        sourceRecordId: { type: 'string', format: 'uuid' },
                        targetFieldKey: { type: 'string' },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            event: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    type: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { id: actionId } = request.params;
            const { sourceRecordId, targetFieldKey } = request.body;

            // Verify action exists
            const action = await actionsService.getActionById(actionId);
            if (!action) {
                return reply.status(404).send({ error: 'Action not found' });
            }

            // Emit the event - projector handles the snapshot update
            const event = await emitEvent({
                contextId: action.context_id,
                contextType: action.context_type,
                actionId: action.id,
                type: 'ACTION_REFERENCE_REMOVED',
                payload: {
                    sourceRecordId,
                    targetFieldKey,
                },
            });

            return reply.status(200).send({ event });
        }
    );

    /**
     * GET /actions/:id/references - Get all references for an action
     * Reads from the snapshot table (fast, consistent).
     */
    fastify.get<{
        Params: { id: string };
    }>(
        '/:id/references',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            references: { type: 'array', items: referenceSchema },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { id: actionId } = request.params;

            // Verify action exists
            const action = await actionsService.getActionById(actionId);
            if (!action) {
                return reply.status(404).send({ error: 'Action not found' });
            }

            const references = await getActionReferences(actionId);

            return { references };
        }
    );

    /**
     * PUT /actions/:id/references - Bulk replace all references
     * Diffs old → new and emits minimal add/remove events.
     * This is the preferred endpoint for the Composer.
     */
    fastify.put<{
        Params: { id: string };
        Body: {
            references: Array<{
                sourceRecordId: string;
                targetFieldKey: string;
                snapshotValue?: unknown;
            }>;
        };
    }>(
        '/:id/references',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['references'],
                    properties: {
                        references: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['sourceRecordId', 'targetFieldKey'],
                                properties: {
                                    sourceRecordId: { type: 'string', format: 'uuid' },
                                    targetFieldKey: { type: 'string' },
                                    snapshotValue: { nullable: true },
                                },
                            },
                        },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            references: { type: 'array', items: referenceSchema },
                            added: { type: 'number' },
                            removed: { type: 'number' },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { id: actionId } = request.params;
            const { references: newRefs } = request.body;

            // Verify action exists
            const action = await actionsService.getActionById(actionId);
            if (!action) {
                return reply.status(404).send({ error: 'Action not found' });
            }

            // Get current references
            const currentRefs = await getActionReferences(actionId);

            // Build lookup keys for comparison
            const makeKey = (r: { source_record_id?: string | null; sourceRecordId?: string; target_field_key?: string | null; targetFieldKey?: string }) =>
                `${r.source_record_id || r.sourceRecordId || ''}|${r.target_field_key || r.targetFieldKey || ''}`;

            const currentKeys = new Set(currentRefs.map(r => makeKey(r)));
            const newKeys = new Set(newRefs.map(r => makeKey(r)));

            // Determine what to remove (in current but not in new)
            const toRemove = currentRefs.filter(r => !newKeys.has(makeKey(r)));

            // Determine what to add (in new but not in current)
            const toAdd = newRefs.filter(r => !currentKeys.has(makeKey(r)));

            // Emit REMOVE events
            for (const ref of toRemove) {
                await emitEvent({
                    contextId: action.context_id,
                    contextType: action.context_type,
                    actionId: action.id,
                    type: 'ACTION_REFERENCE_REMOVED',
                    payload: {
                        sourceRecordId: ref.source_record_id,
                        targetFieldKey: ref.target_field_key,
                    },
                });
            }

            // Emit ADD events
            for (const ref of toAdd) {
                await emitEvent({
                    contextId: action.context_id,
                    contextType: action.context_type,
                    actionId: action.id,
                    type: 'ACTION_REFERENCE_ADDED',
                    payload: {
                        sourceRecordId: ref.sourceRecordId,
                        targetFieldKey: ref.targetFieldKey,
                        snapshotValue: ref.snapshotValue,
                    },
                });
            }

            // Return updated snapshot
            const updatedRefs = await getActionReferences(actionId);

            return {
                references: updatedRefs,
                added: toAdd.length,
                removed: toRemove.length,
            };
        }
    );
}
