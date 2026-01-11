/**
 * Fact Kinds Routes
 *
 * REST API endpoints for managing fact kind definitions.
 * Supports the Definition Review UI.
 */

import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as factKindsService from './fact-kinds.service.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const FactKindDefinitionSchema = z.object({
    id: z.string().uuid(),
    fact_kind: z.string(),
    display_name: z.string(),
    description: z.string().nullable(),
    payload_schema: z.unknown(),
    example_payload: z.unknown().nullable(),
    source: z.string(),
    confidence: z.string(),
    needs_review: z.boolean(),
    is_known: z.boolean(),
    first_seen_at: z.coerce.date(),
    reviewed_at: z.coerce.date().nullable(),
    reviewed_by: z.string().uuid().nullable(),
});

const ListQuerySchema = z.object({
    needsReview: z.enum(['true', 'false']).optional(),
    source: z.string().optional(),
});

const ApproveBodySchema = z.object({
    reviewerId: z.string().uuid().optional(),
});

const MergeBodySchema = z.object({
    targetFactKind: z.string(),
    reviewerId: z.string().uuid().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function factKindsRoutes(app: FastifyInstance): Promise<void> {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // List all fact kind definitions
    typedApp.get(
        '/fact-kinds',
        {
            schema: {
                querystring: ListQuerySchema,
                response: {
                    200: z.object({
                        data: z.array(FactKindDefinitionSchema),
                    }),
                },
            },
        },
        async (request) => {
            const { needsReview, source } = request.query;
            const definitions = await factKindsService.listFactKindDefinitions({
                needsReview: needsReview === 'true' ? true : needsReview === 'false' ? false : undefined,
                source,
            });
            return { data: definitions };
        }
    );

    // Get stats (total, needs review, known)
    typedApp.get(
        '/fact-kinds/stats',
        {
            schema: {
                response: {
                    200: z.object({
                        total: z.number(),
                        needsReview: z.number(),
                        known: z.number(),
                    }),
                },
            },
        },
        async () => {
            return factKindsService.getFactKindStats();
        }
    );

    // Get a single fact kind definition
    typedApp.get(
        '/fact-kinds/:factKind',
        {
            schema: {
                params: z.object({
                    factKind: z.string(),
                }),
                response: {
                    200: z.object({
                        data: FactKindDefinitionSchema,
                    }),
                    404: z.object({
                        error: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { factKind } = request.params;
            const definition = await factKindsService.getFactKindDefinition(factKind);
            if (!definition) {
                return reply.status(404).send({ error: `Fact kind not found: ${factKind}` });
            }
            return { data: definition };
        }
    );

    // Approve a fact kind definition
    typedApp.post(
        '/fact-kinds/:factKind/approve',
        {
            schema: {
                params: z.object({
                    factKind: z.string(),
                }),
                body: ApproveBodySchema,
                response: {
                    200: z.object({
                        data: FactKindDefinitionSchema,
                    }),
                },
            },
        },
        async (request) => {
            const { factKind } = request.params;
            const { reviewerId } = request.body;
            const definition = await factKindsService.approveFactKindDefinition(factKind, reviewerId);
            return { data: definition };
        }
    );

    // Deprecate a fact kind definition
    typedApp.post(
        '/fact-kinds/:factKind/deprecate',
        {
            schema: {
                params: z.object({
                    factKind: z.string(),
                }),
                body: ApproveBodySchema,
                response: {
                    200: z.object({
                        data: FactKindDefinitionSchema,
                    }),
                },
            },
        },
        async (request) => {
            const { factKind } = request.params;
            const { reviewerId } = request.body;
            const definition = await factKindsService.deprecateFactKindDefinition(factKind, reviewerId);
            return { data: definition };
        }
    );

    // Merge one fact kind into another
    typedApp.post(
        '/fact-kinds/:factKind/merge',
        {
            schema: {
                params: z.object({
                    factKind: z.string(),
                }),
                body: MergeBodySchema,
                response: {
                    200: z.object({
                        source: FactKindDefinitionSchema,
                        target: FactKindDefinitionSchema,
                    }),
                },
            },
        },
        async (request) => {
            const { factKind } = request.params;
            const { targetFactKind, reviewerId } = request.body;
            const result = await factKindsService.mergeFactKindDefinitions(
                factKind,
                targetFactKind,
                reviewerId
            );
            return result;
        }
    );
}
