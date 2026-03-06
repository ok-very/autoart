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

import { ClickUp } from '@autoart/clickup';

import * as connectionsService from './connections.service.js';
import { MondayClient } from './connectors/monday-client.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const MondayConnectBodySchema = z.object({
    apiKey: z.string().min(1, 'API key is required'),
});

const ClickUpConnectBodySchema = z.object({
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

        const [mondayConnected, clickupConnected, googleConnected] = await Promise.all([
            connectionsService.isProviderConnected(userId ?? null, 'monday'),
            connectionsService.isProviderConnected(userId ?? null, 'clickup'),
            connectionsService.isProviderConnected(userId ?? null, 'google'),
        ]);

        // Check if AutoHelper has a link key for this user
        const autohelperConnected = userId
            ? await connectionsService.isProviderConnected(userId, 'autohelper')
            : false;

        return reply.send({
            monday: { connected: mondayConnected },
            clickup: { connected: clickupConnected },
            google: { connected: googleConnected },
            autohelper: {
                connected: autohelperConnected,
            },
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

    // ============================================================================
    // MONDAY OAUTH (DEPRECATED - use /auth/monday instead)
    // ============================================================================

    /**
     * @deprecated Use GET /auth/monday/status instead
     */
    app.get('/connections/monday/oauth/status', async (_request, reply) => {
        return reply.status(410).send({
            error: 'GONE',
            message: 'This endpoint has been moved to /auth/monday/status',
        });
    });

    /**
     * @deprecated Use GET /auth/monday instead
     */
    app.get('/connections/monday/oauth/authorize', async (_request, reply) => {
        return reply.status(410).send({
            error: 'GONE',
            message: 'This endpoint has been moved to /auth/monday',
        });
    });

    /**
     * @deprecated Use GET /auth/monday/callback instead
     */
    app.get('/connections/monday/callback', async (_request, reply) => {
        return reply.status(410).send({
            error: 'GONE',
            message: 'This endpoint has been moved to /auth/monday/callback',
        });
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
                    type: string;
                    board_kind: string;
                    workspace: { id: string; name: string } | null;
                    items_count: number;
                }>;
            }>(`
                query {
                    boards(limit: 500, order_by: created_at) {
                        id
                        name
                        state
                        type
                        board_kind
                        workspace {
                            id
                            name
                        }
                        items_count
                    }
                }
            `);

            // DEBUG: Log raw response from Monday
            console.log('[monday/boards] Raw from Monday API:', result.boards.length, 'boards');
            console.log('[monday/boards] Sample:', result.boards.slice(0, 5).map(b => ({
                id: b.id,
                name: b.name,
                type: b.type,
                board_kind: b.board_kind,
                items_count: b.items_count,
            })));

            // Filter to actual project boards only:
            // 1. Active state
            // 2. type = 'board'
            // 3. Exclude "Subitems of"
            // 4. Exclude 'share' boards (often single-item ghosts)
            const rawBoards = result.boards
                .filter(b => b.state === 'active')
                .filter(b => b.type === 'board')
                .filter(b => b.board_kind !== 'share')
                .filter(b => !b.name.startsWith('Subitems of '));

            // Smart Deduplication:
            // If multiple boards have the exact same name, keep only the one with the most items.
            // This handles "split-outs" where a template might have a shadow copy.
            const bestBoardsByName = new Map<string, typeof rawBoards[0]>();

            for (const board of rawBoards) {
                const existing = bestBoardsByName.get(board.name);
                if (!existing || board.items_count > existing.items_count) {
                    bestBoardsByName.set(board.name, board);
                }
            }

            const uniqueBoards = Array.from(bestBoardsByName.values())
                .map(b => ({
                    id: b.id,
                    name: b.name,
                    workspace: b.workspace?.name ?? 'Main workspace',
                    itemCount: b.items_count,
                    boardKind: b.board_kind,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            console.log('[monday/boards] Final unique boards:', uniqueBoards.length);
            return reply.send({ boards: uniqueBoards });
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

    // ============================================================================
    // GOOGLE OAUTH
    // ============================================================================

    /**
     * Disconnect Google (revoke tokens)
     * Requires authentication
     */
    app.delete('/connections/google', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        await connectionsService.deleteCredential(userId, 'google');

        return reply.send({ disconnected: true });
    });

    // ============================================================================
    // CLICKUP API KEY
    // ============================================================================

    /**
     * Connect ClickUp with API key
     * Requires authentication
     */
    app.post('/connections/clickup', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { apiKey } = ClickUpConnectBodySchema.parse(request.body);

        // Validate the API key by making a test call
        try {
            const client = new ClickUp({ token: apiKey });
            await client.tasks.get('test_validation_probe');
        } catch (err) {
            // 401/403 means invalid key. Anything else (404, etc.) means key works.
            const message = (err as Error).message;
            if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('unauthorized')) {
                return reply.status(400).send({
                    error: 'Invalid API key',
                    details: message,
                });
            }
            // If we got a 404 or other non-auth error, the key is valid
        }

        await connectionsService.saveCredential({
            user_id: userId,
            provider: 'clickup',
            access_token: apiKey,
            refresh_token: null,
            expires_at: null,
            scopes: [],
            metadata: {},
        });

        return reply.status(201).send({ connected: true });
    });

    /**
     * Disconnect ClickUp
     * Requires authentication
     */
    app.delete('/connections/clickup', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        await connectionsService.deleteCredential(userId, 'clickup');

        return reply.send({ connected: false });
    });

    /**
     * Validate ClickUp API key without saving
     */
    app.post('/connections/clickup/validate', async (request, reply) => {
        const { apiKey } = ClickUpConnectBodySchema.parse(request.body);

        try {
            const client = new ClickUp({ token: apiKey });
            const { teams } = await client.spaces.getTeams();

            return reply.send({
                valid: true,
                teams: teams.map(t => ({ id: t.id, name: t.name })),
            });
        } catch (err) {
            return reply.send({
                valid: false,
                error: (err as Error).message,
            });
        }
    });

    /**
     * List accessible ClickUp spaces for the current user
     * Uses optional auth - can use env token as fallback
     */
    app.get('/connectors/clickup/spaces', {
        preHandler: app.authenticateOptional
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;

        try {
            const token = await connectionsService.getClickUpToken(userId);
            const client = new ClickUp({ token });

            const { teams } = await client.spaces.getTeams();
            const allSpaces: Array<{
                id: string;
                name: string;
                teamId: string;
                teamName: string;
            }> = [];

            for (const team of teams) {
                const { spaces } = await client.spaces.list(team.id);
                for (const space of spaces) {
                    allSpaces.push({
                        id: space.id,
                        name: space.name,
                        teamId: team.id,
                        teamName: team.name,
                    });
                }
            }

            return reply.send({ spaces: allSpaces });
        } catch (err) {
            if ((err as Error).message.includes('No ClickUp API token')) {
                return reply.status(401).send({
                    error: 'Not connected',
                    message: 'Connect your ClickUp account in Settings → Integrations'
                });
            }
            throw err;
        }
    });

    /**
     * List accessible ClickUp lists for a given space
     * Uses optional auth - can use env token as fallback
     */
    app.get('/connectors/clickup/lists', {
        preHandler: app.authenticateOptional
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        const { spaceId } = z.object({ spaceId: z.string().min(1) }).parse(request.query);

        try {
            const token = await connectionsService.getClickUpToken(userId);
            const client = new ClickUp({ token });

            const { folders } = await client.spaces.getFolders(spaceId);
            const allLists: Array<{
                id: string;
                name: string;
                folderId?: string;
                folderName?: string;
                taskCount: number;
            }> = [];

            // Lists inside folders
            for (const folder of folders) {
                for (const list of folder.lists) {
                    allLists.push({
                        id: list.id,
                        name: list.name,
                        folderId: folder.id,
                        folderName: folder.name,
                        taskCount: list.task_count ?? 0,
                    });
                }
            }

            // Folderless lists
            const { lists } = await client.lists.listInSpace(spaceId);
            for (const list of lists) {
                allLists.push({
                    id: list.id,
                    name: list.name,
                    taskCount: list.task_count ?? 0,
                });
            }

            return reply.send({ lists: allLists });
        } catch (err) {
            if ((err as Error).message.includes('No ClickUp API token')) {
                return reply.status(401).send({
                    error: 'Not connected',
                    message: 'Connect your ClickUp account in Settings → Integrations'
                });
            }
            throw err;
        }
    });

    // ============================================================================
    // AUTOHELPER CLAIM TOKEN ENDPOINTS (Plex-style pairing)
    // ============================================================================

    /**
     * Generate a claim code for pairing.
     * User displays this code and enters it into AutoHelper's tray menu.
     * Code expires in 5 minutes.
     */
    app.post('/pair/claim', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { code, expiresAt } = await connectionsService.generateClaimToken(userId);

        return reply.send({ code, expiresAt: expiresAt.toISOString() });
    });

    /**
     * Redeem a claim code (called by AutoHelper, unauthenticated).
     * Validates the code, generates a link key, returns it to AutoHelper.
     */
    app.post('/pair/redeem', async (request, reply) => {
        const { code } = z.object({ code: z.string().trim().min(1) }).parse(request.body);

        const result = await connectionsService.redeemClaimToken(code);

        if (!result) {
            return reply.status(400).send({
                error: 'Invalid or expired code',
                message: 'The pairing code is invalid or has expired. Generate a new code and try again.'
            });
        }

        return reply.send({ key: result.key });
    });

    /**
     * Poll for claim status (called by frontend).
     * Returns whether the claim has been redeemed.
     */
    app.get('/pair/status', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const status = await connectionsService.getClaimStatus(userId);

        return reply.send(status);
    });

    // ============================================================================
    // AUTOHELPER LINK KEY ENDPOINTS
    // ============================================================================

    /**
     * Verify an AutoHelper link key is valid (no Monday dependency).
     * Used by AutoHelper during pairing to confirm the key is recognized.
     */
    app.get('/connections/autohelper/verify', async (request, reply) => {
        const keyHeader = request.headers['x-autohelper-key'];
        const key = Array.isArray(keyHeader) ? keyHeader[0] ?? '' : keyHeader ?? '';

        if (!key) {
            return reply.status(401).send({ error: 'Link key required' });
        }

        const userId = await connectionsService.validateLinkKey(key);
        if (!userId) {
            return reply.status(401).send({ error: 'Invalid link key' });
        }

        return reply.send({ valid: true });
    });

    /**
     * Revoke the AutoHelper link key for the current user.
     * Requires authentication.
     */
    app.delete('/connections/autohelper', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        await connectionsService.revokeLinkKey(userId);

        return reply.send({ disconnected: true });
    });
}

export default connectionsRoutes;
