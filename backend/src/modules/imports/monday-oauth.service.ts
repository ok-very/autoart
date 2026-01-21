/**
 * Monday OAuth Service
 *
 * Handles Monday.com OAuth 2.0 authentication flow.
 * Monday uses a simple OAuth flow similar to Google.
 *
 * Flow:
 * 1. Generate auth URL with client_id and redirect_uri
 * 2. User authorizes in Monday.com
 * 3. Monday redirects back with authorization code
 * 4. Exchange code for access token
 * 5. Store token in connection_credentials table
 *
 * Docs: https://developer.monday.com/apps/docs/oauth
 */

import crypto from 'crypto';
import { db } from '../../db/client.js';
import { AppError } from '../../utils/errors.js';
import { MondayClient } from './connectors/monday-client.js';

// Environment validation
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET;
const MONDAY_REDIRECT_URI = process.env.MONDAY_REDIRECT_URI || 'http://localhost:3001/api/connections/monday/callback';

// In-memory state store (replace with Redis in production)
const stateStore = new Map<string, { timestamp: number; userId: string }>();

// Clean up expired states (older than 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of stateStore.entries()) {
        if (now - data.timestamp > 10 * 60 * 1000) {
            stateStore.delete(state);
        }
    }
}, 60 * 1000);

/**
 * Check if Monday OAuth is configured
 */
export function isMondayOAuthConfigured(): boolean {
    return Boolean(MONDAY_CLIENT_ID && MONDAY_CLIENT_SECRET);
}

/**
 * Generate OAuth authorization URL
 */
export function getMondayAuthUrl(userId: string): { url: string; state: string } {
    if (!MONDAY_CLIENT_ID) {
        throw new AppError(500, 'Monday OAuth is not configured', 'MONDAY_OAUTH_NOT_CONFIGURED');
    }

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    stateStore.set(state, { timestamp: Date.now(), userId });

    const params = new URLSearchParams({
        client_id: MONDAY_CLIENT_ID,
        redirect_uri: MONDAY_REDIRECT_URI,
        state,
    });

    const url = `https://auth.monday.com/oauth2/authorize?${params.toString()}`;

    return { url, state };
}

/**
 * Validate state parameter (CSRF protection)
 */
function validateState(state: string): string | null {
    const data = stateStore.get(state);
    if (!data) {
        return null;
    }
    stateStore.delete(state);
    return data.userId;
}

/**
 * Exchange authorization code for access token
 */
export async function handleMondayCallback(code: string, state: string) {
    if (!MONDAY_CLIENT_ID || !MONDAY_CLIENT_SECRET) {
        throw new AppError(500, 'Monday OAuth is not configured', 'MONDAY_OAUTH_NOT_CONFIGURED');
    }

    // Validate state (CSRF protection)
    const userId = validateState(state);
    if (!userId) {
        throw new AppError(400, 'Invalid or expired state parameter', 'INVALID_STATE');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://auth.monday.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: MONDAY_CLIENT_ID,
            client_secret: MONDAY_CLIENT_SECRET,
            code,
            redirect_uri: MONDAY_REDIRECT_URI,
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new AppError(500, `Failed to exchange authorization code: ${errorText}`, 'MONDAY_TOKEN_EXCHANGE_FAILED');
    }

    const tokens = await tokenResponse.json() as {
        access_token: string;
        token_type: string;
        scope?: string;
    };

    if (!tokens.access_token) {
        throw new AppError(500, 'No access token received from Monday', 'MONDAY_NO_ACCESS_TOKEN');
    }

    // Verify token and get user info
    const client = new MondayClient({ token: tokens.access_token });
    const meResult = await client.query<{ me: { id: string; name: string; email: string } }>(`
        query {
            me {
                id
                name
                email
            }
        }
    `);

    // Store token in connection_credentials table
    // First delete any existing credential for this user/provider
    await db
        .deleteFrom('connection_credentials')
        .where('user_id', '=', userId)
        .where('provider', '=', 'monday')
        .execute();

    // Insert new credential
    await db
        .insertInto('connection_credentials')
        .values({
            user_id: userId,
            provider: 'monday',
            access_token: tokens.access_token,
            refresh_token: null, // Monday doesn't provide refresh tokens
            expires_at: null, // Monday tokens don't expire
            scopes: JSON.stringify(tokens.scope?.split(',') || []),
            metadata: JSON.stringify({
                token_type: tokens.token_type,
                monday_user_id: meResult.me.id,
                monday_user_name: meResult.me.name,
                monday_user_email: meResult.me.email,
            }),
        })
        .execute();

    return {
        user: meResult.me,
        connected: true,
    };
}
