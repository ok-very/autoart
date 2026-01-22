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
            connectionsService.isProviderConnected(userId ?? null, 'google'),
        ]);

        // Check AutoHelper connections for this user
        const autohelperSessions = userId
            ? connectionsService.getAutoHelperSessions(userId)
            : [];

        return reply.send({
            monday: { connected: mondayConnected },
            google: { connected: googleConnected },
            autohelper: {
                connected: autohelperSessions.length > 0,
                instanceCount: autohelperSessions.length,
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
    // MONDAY OAUTH
    // ============================================================================

    /**
     * Check if Monday OAuth is available
     */
    app.get('/connections/monday/oauth/status', async (_request, reply) => {
        const { isMondayOAuthConfigured } = await import('./monday-oauth.service.js');
        return reply.send({ available: isMondayOAuthConfigured() });
    });

    /**
     * Start Monday OAuth flow
     * Returns authorization URL for popup window
     */
    app.get('/connections/monday/oauth/authorize', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { getMondayAuthUrl, isMondayOAuthConfigured } = await import('./monday-oauth.service.js');

        if (!isMondayOAuthConfigured()) {
            return reply.status(501).send({
                error: 'Monday OAuth not configured',
                message: 'Set MONDAY_CLIENT_ID and MONDAY_CLIENT_SECRET environment variables'
            });
        }

        const { url, state } = getMondayAuthUrl(userId);
        return reply.send({ authUrl: url, state });
    });

    /**
     * Monday OAuth callback
     * Handles redirect from Monday after user authorization
     * Returns HTML that posts message to parent window and closes popup
     */
    app.get('/connections/monday/callback', async (request, reply) => {
        const { code, state, error } = request.query as {
            code?: string;
            state?: string;
            error?: string
        };

        const escapeHtml = (value: string): string => {
            return value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        // Helper to send HTML that closes the popup
        const sendPopupResponse = (success: boolean, message?: string) => {
            const safeMessage = message ? escapeHtml(message) : 'Unknown error';
            const targetOrigin = process.env.CLIENT_ORIGIN || 'https://example.com';
            const html = `
<!DOCTYPE html>
<html>
<head><title>Monday OAuth</title></head>
<body>
<script>
    (function() {
        var targetOrigin = ${JSON.stringify(targetOrigin)};
        if (window.opener && targetOrigin) {
            window.opener.postMessage({
                type: 'monday-oauth-callback',
                success: ${success ? 'true' : 'false'},
                message: ${JSON.stringify(safeMessage)}
            }, targetOrigin);
        }
        window.close();
    })();
</script>
<p>${success ? 'Connected! This window will close.' : `Error: ${safeMessage}`}</p>
</body>
</html>`;
            return reply.type('text/html').send(html);
        };

        if (error) {
            return sendPopupResponse(false, error);
        }

        if (!code || !state) {
            return sendPopupResponse(false, 'Missing parameters');
        }

        try {
            const { handleMondayCallback } = await import('./monday-oauth.service.js');
            await handleMondayCallback(code, state);
            return sendPopupResponse(true);
        } catch (err) {
            console.error('Monday OAuth callback error:', err);
            return sendPopupResponse(false, (err as Error).message);
        }
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
    // AUTOHELPER PAIRING ENDPOINTS
    // ============================================================================

    /**
     * Generate pairing code for AutoHelper connection
     * Requires authentication - code is tied to current user
     */
    app.post('/connections/autohelper/pair', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { code, expiresAt } = connectionsService.generatePairingCode(userId);

        return reply.send({
            code,
            expiresAt: expiresAt.toISOString(),
            expiresInSeconds: 300, // 5 minutes
        });
    });

    /**
     * AutoHelper handshake - exchange pairing code for session
     * No auth required - AutoHelper uses pairing code as proof
     */
    app.post('/connections/autohelper/handshake', async (request, reply) => {
        const body = request.body as { code?: string; instanceName?: string };

        if (!body.code) {
            return reply.status(400).send({ error: 'Pairing code is required' });
        }

        const result = connectionsService.validatePairingCode(
            body.code,
            body.instanceName || 'AutoHelper'
        );

        if (!result) {
            return reply.status(401).send({
                error: 'Invalid or expired pairing code',
                message: 'Please generate a new code in AutoArt Settings'
            });
        }

        return reply.send({
            sessionId: result.sessionId,
            message: 'Connected successfully'
        });
    });

    /**
     * Get proxied credentials for trusted AutoHelper session
     * Returns Monday API token (single source of truth)
     */
    app.get('/connections/autohelper/credentials', async (request, reply) => {
        const sessionId = (request.headers['x-autohelper-session'] as string) || '';

        if (!sessionId) {
            return reply.status(401).send({ error: 'Session ID required in X-AutoHelper-Session header' });
        }

        const mondayToken = await connectionsService.getProxiedMondayToken(sessionId);

        if (!mondayToken) {
            return reply.status(401).send({
                error: 'Invalid session or no Monday token configured',
                message: 'Re-pair with AutoArt or ensure Monday is connected'
            });
        }

        return reply.send({
            monday_api_token: mondayToken,
        });
    });

    /**
     * List connected AutoHelper instances
     * Requires authentication
     */
    app.get('/connections/autohelper', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const sessions = connectionsService.getAutoHelperSessions(userId);

        return reply.send({
            connected: sessions.length > 0,
            instances: sessions.map(s => ({
                displayId: s.displayId,
                instanceName: s.instanceName,
                connectedAt: s.connectedAt.toISOString(),
                lastSeen: s.lastSeen.toISOString(),
            })),
        });
    });

    /**
     * Disconnect AutoHelper instance
     * Requires authentication and verifies session ownership
     */
    app.delete('/connections/autohelper/:displayId', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const userId = (request.user as { userId?: string })?.userId;
        if (!userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        const { displayId } = request.params as { displayId: string };

        // Look up session by displayId and verify ownership
        const session = connectionsService.getSessionByDisplayId(userId, displayId);

        if (!session) {
            return reply.status(404).send({
                error: 'Session not found',
                message: 'Session not found or you do not have permission to disconnect it'
            });
        }

        // Session is verified to belong to this user, disconnect it
        const success = connectionsService.disconnectAutoHelper(session.sessionId);

        return reply.send({
            disconnected: success,
            message: success ? 'AutoHelper disconnected' : 'Failed to disconnect'
        });
    });
}

export default connectionsRoutes;
