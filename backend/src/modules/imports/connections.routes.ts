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

        // Check if AutoHelper has a link key for this user
        const autohelperConnected = userId
            ? await connectionsService.isProviderConnected(userId, 'autohelper')
            : false;

        // Debug: log connection check result
        console.log('[/connections] userId=%s autohelper=%s', userId, autohelperConnected);

        return reply.send({
            monday: { connected: mondayConnected },
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

        /**
         * Normalize OAuth error messages to prevent reflection of untrusted content.
         * Maps known error codes to user-friendly messages and redacts unknown ones.
         */
        const normalizeOAuthError = (errorParam: string): string => {
            // Standard OAuth error codes
            const knownErrors: Record<string, string> = {
                'access_denied': 'Authorization was denied. Please try again.',
                'invalid_request': 'Invalid authorization request.',
                'unauthorized_client': 'This application is not authorized.',
                'unsupported_response_type': 'Unsupported authorization type.',
                'invalid_scope': 'Invalid permissions requested.',
                'server_error': 'The authorization server encountered an error.',
                'temporarily_unavailable': 'Service temporarily unavailable. Please try again.',
            };

            const normalized = errorParam.toLowerCase().trim();
            if (knownErrors[normalized]) {
                return knownErrors[normalized];
            }

            // Log unknown errors for debugging but don't expose to user
            console.warn('Monday OAuth callback: Unknown error code received:', errorParam);
            return 'Authorization failed. Please try again.';
        };

        // Helper to send HTML that closes the popup
        const sendPopupResponse = (success: boolean, message?: string) => {
            const safeMessage = message ? escapeHtml(message) : 'Unknown error';
            const targetOrigin = process.env.CLIENT_ORIGIN;

            // Fail fast if CLIENT_ORIGIN is not configured
            if (!targetOrigin) {
                console.error('Monday OAuth callback: CLIENT_ORIGIN environment variable is not set');
                const errorHtml = `
<!DOCTYPE html>
<html>
<head><title>Monday OAuth Error</title></head>
<body>
<h1>Configuration Error</h1>
<p>OAuth callback cannot complete: CLIENT_ORIGIN is not configured on the server.</p>
<p>Please contact your administrator.</p>
</body>
</html>`;
                return reply.type('text/html').status(500).send(errorHtml);
            }

            // Validate CLIENT_ORIGIN is a valid URL with appropriate protocol
            let safeTargetOrigin: string;
            try {
                const originUrl = new URL(targetOrigin);
                const isLocalhost = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
                // Allow HTTP only for localhost (development), require HTTPS otherwise
                if (originUrl.protocol === 'http:' && !isLocalhost) {
                    throw new Error('HTTP protocol only allowed for localhost');
                }
                if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
                    throw new Error('Invalid protocol');
                }
                // Strip path/query/fragment - use only the origin for postMessage security
                if (originUrl.pathname !== '/' || originUrl.search || originUrl.hash) {
                    console.warn('Monday OAuth callback: CLIENT_ORIGIN had path/query/hash which was stripped');
                }
                safeTargetOrigin = originUrl.origin;
            } catch {
                console.error('Monday OAuth callback: CLIENT_ORIGIN is not a valid URL:', targetOrigin);
                const errorHtml = `
<!DOCTYPE html>
<html>
<head><title>Monday OAuth Error</title></head>
<body>
<h1>Configuration Error</h1>
<p>OAuth callback cannot complete: CLIENT_ORIGIN is misconfigured.</p>
<p>Please contact your administrator.</p>
</body>
</html>`;
                return reply.type('text/html').status(500).send(errorHtml);
            }
            const html = `
<!DOCTYPE html>
<html>
<head><title>Monday OAuth</title></head>
<body>
<script>
    (function() {
        var targetOrigin = ${JSON.stringify(safeTargetOrigin)};
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
            return sendPopupResponse(false, normalizeOAuthError(error));
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
            // Don't expose internal error details to the user
            // Known safe errors from our code can be passed through
            const errorMessage = (err as Error).message;
            const safeMessages = [
                'Invalid or expired state parameter',
                'Failed to exchange authorization code',
                'Missing user ID in state',
            ];
            const isSafeMessage = safeMessages.some(msg => errorMessage.includes(msg));
            return sendPopupResponse(false, isSafeMessage ? errorMessage : 'Authorization failed. Please try again.');
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
     * Get proxied credentials for a trusted AutoHelper link key.
     * Returns Monday API token (single source of truth).
     */
    app.get('/connections/autohelper/credentials', async (request, reply) => {
        const keyHeader = request.headers['x-autohelper-key'];
        const key = Array.isArray(keyHeader) ? keyHeader[0] ?? '' : keyHeader ?? '';

        if (!key) {
            return reply.status(401).send({ error: 'Link key required in X-AutoHelper-Key header' });
        }

        const mondayToken = await connectionsService.getProxiedMondayToken(key);

        if (!mondayToken) {
            return reply.status(401).send({
                error: 'Invalid key or no Monday token configured',
                message: 'Re-pair with AutoArt or ensure Monday is connected'
            });
        }

        return reply.send({
            monday_api_token: mondayToken,
        });
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
