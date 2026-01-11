/**
 * Connections Routes
 *
 * API endpoints for managing external service connections:
 * - GET /connections - List connected providers
 * - POST /connections/monday - Connect Monday.com with API key
 * - DELETE /connections/monday - Disconnect Monday.com
 * - GET /connections/monday/validate - Validate API key
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as connectionsService from './connections.service.js';
import { getMondayToken } from './connections.service.js';
import { MondayClient } from './connectors/monday-client.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const MondayConnectBodySchema = z.object({
    apiKey: z.string().min(1, 'API key is required'),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function connectionsRoutes(app: FastifyInstance) {
    /**
     * List connection status for all providers
     * Uses optional auth - works for both authenticated and anonymous users
     */
    app.get('/connections', {
        preHandler: app.authenticateOptional
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;

        const [mondayConnected, googleConnected] = await Promise.all([
            connectionsService.isProviderConnected(userId ?? null, 'monday'),
            connectionsService.isProviderConnected(userId ?? null, 'google' as any),
        ]);

        return reply.send({
            monday: { connected: mondayConnected },
            google: { connected: googleConnected },
        });
    });

    /**
     * Connect Monday.com with API key
     * Requires authentication
     */
    app.post('/connections/monday', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { apiKey } = MondayConnectBodySchema.parse(request.body);

        // Validate the API key by making a test call
        try {
            const client = new MondayClient({ token: apiKey });
            await client.query<{ me: { id: string; name: string } }>(`
                query {
                    me {
                        id
                        name
                    }
                }
            `);
        } catch (err) {
            return reply.status(400).send({
                error: 'Invalid API key',
                details: (err as Error).message,
            });
        }

        // Save the credential
        await connectionsService.saveCredential({
            user_id: userId,
            provider: 'monday',
            access_token: apiKey,
            refresh_token: null,
            expires_at: null, // API keys don't expire
            scopes: [],
            metadata: {},
        });

        return reply.status(201).send({ connected: true });
    });

    /**
     * Disconnect Monday.com
     * Requires authentication
     */
    app.delete('/connections/monday', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        await connectionsService.deleteCredential(userId, 'monday');

        return reply.send({ connected: false });
    });

    /**
     * Validate Monday API key without saving
     */
    app.post('/connections/monday/validate', async (request, reply) => {
        const { apiKey } = MondayConnectBodySchema.parse(request.body);

        try {
            const client = new MondayClient({ token: apiKey });
            const result = await client.query<{ me: { id: string; name: string; email: string } }>(`
                query {
                    me {
                        id
                        name
                        email
                    }
                }
            `);

            return reply.send({
                valid: true,
                user: result.me,
            });
        } catch (err) {
            return reply.send({
                valid: false,
                error: (err as Error).message,
            });
        }
    });

    /**
     * List accessible Monday.com boards for the current user
     * Uses optional auth - can use env token as fallback
     */
    app.get('/connectors/monday/boards', {
        preHandler: app.authenticateOptional
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;

        try {
            const token = await connectionsService.getMondayToken(userId);
            const client = new MondayClient({ token });

            const result = await client.query<{
                boards: Array<{
                    id: string;
                    name: string;
                    state: string;
                    workspace: { id: string; name: string } | null;
                    items_count: number;
                }>;
            }>(`
                query {
                    boards(limit: 50, order_by: created_at) {
                        id
                        name
                        state
                        workspace {
                            id
                            name
                        }
                        items_count
                    }
                }
            `);

            // Filter to active boards only and format response
            const boards = result.boards
                .filter(b => b.state === 'active')
                .map(b => ({
                    id: b.id,
                    name: b.name,
                    workspace: b.workspace?.name ?? 'Main workspace',
                    itemCount: b.items_count,
                }));

            return reply.send({ boards });
        } catch (err) {
            if ((err as Error).message.includes('No Monday API token')) {
                return reply.status(401).send({
                    error: 'Not connected',
                    message: 'Connect your Monday account in Settings → Integrations'
                });
            }
            throw err;
        }
    });

    // TODO: Google OAuth routes (Phase 5a continuation)
    // GET /connections/google/connect → Redirect to OAuth
    // GET /connections/google/callback → Handle callback
    // DELETE /connections/google → Revoke tokens
}

export default connectionsRoutes;
