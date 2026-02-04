/**
 * Monday OAuth Service
 *
 * Handles Monday.com OAuth 2.0 authentication flow.
 * Supports both login mode (create/find user) and link mode (connect to existing user).
 *
 * Flow:
 * 1. Generate auth URL with client_id and redirect_uri
 * 2. User authorizes in Monday.com
 * 3. Monday redirects back with authorization code
 * 4. Exchange code for access token
 * 5. Login mode: find/create user by email, return session data
 * 6. Link mode: store token in connection_credentials table
 *
 * Docs: https://developer.monday.com/apps/docs/oauth
 */

import { MondayClient } from './connectors/monday-client.js';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { AppError } from '../../utils/errors.js';
import { generateOAuthState, validateOAuthState, type OAuthMode } from '../auth/oauth-state.js';

/**
 * Check if Monday OAuth is configured
 */
export function isMondayOAuthConfigured(): boolean {
    return Boolean(env.MONDAY_CLIENT_ID && env.MONDAY_CLIENT_SECRET);
}

/**
 * Generate OAuth authorization URL.
 * If userId is provided, uses 'link' mode to connect Monday to an existing user.
 * Otherwise, uses 'login' mode to create/find a user.
 */
export function getMondayAuthUrl(userId?: string): { url: string; state: string } {
    if (!env.MONDAY_CLIENT_ID) {
        throw new AppError(500, 'Monday OAuth is not configured', 'MONDAY_OAUTH_NOT_CONFIGURED');
    }

    const mode: OAuthMode = userId ? 'link' : 'login';
    const state = generateOAuthState(mode, userId);

    // Use new unified route, with fallback for backward compatibility
    const redirectUri = env.MONDAY_REDIRECT_URI || `${env.CLIENT_ORIGIN || 'http://localhost:3001'}/api/auth/monday/callback`;

    const params = new URLSearchParams({
        client_id: env.MONDAY_CLIENT_ID,
        redirect_uri: redirectUri,
        state,
    });

    const url = `https://auth.monday.com/oauth2/authorize?${params.toString()}`;

    return { url, state };
}

export interface MondayCallbackResult {
    mode: OAuthMode;
    user?: { id: string; email: string; name: string };
    profile: { id: string; email: string; name: string };
    connected: boolean;
}

/**
 * Exchange authorization code for access token.
 * In 'login' mode: creates/finds user and returns user data.
 * In 'link' mode: stores credentials for existing user.
 */
export async function handleMondayCallback(code: string, state: string): Promise<MondayCallbackResult> {
    if (!env.MONDAY_CLIENT_ID || !env.MONDAY_CLIENT_SECRET) {
        throw new AppError(500, 'Monday OAuth is not configured', 'MONDAY_OAUTH_NOT_CONFIGURED');
    }

    // Validate state (CSRF protection)
    const statePayload = validateOAuthState(state);

    const redirectUri = env.MONDAY_REDIRECT_URI || `${env.CLIENT_ORIGIN || 'http://localhost:3001'}/api/auth/monday/callback`;

    // Debug: log what credentials are being used (masked)
    console.log('[Monday OAuth] Exchanging code with:', {
        client_id: env.MONDAY_CLIENT_ID,
        client_secret_length: env.MONDAY_CLIENT_SECRET?.length,
        client_secret_prefix: env.MONDAY_CLIENT_SECRET?.slice(0, 4) + '...',
        redirect_uri: redirectUri,
        mode: statePayload.mode,
    });

    // Exchange code for tokens
    const tokenResponse = await fetch('https://auth.monday.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: env.MONDAY_CLIENT_ID,
            client_secret: env.MONDAY_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
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

    const profile = {
        id: meResult.me.id,
        email: meResult.me.email,
        name: meResult.me.name,
    };

    let userId: string;
    let user: { id: string; email: string; name: string } | undefined;

    if (statePayload.mode === 'link') {
        // Link mode: use the userId from state
        userId = statePayload.userId!;
    } else {
        // Login mode: find or create user by Monday email
        const dbUser = await db
            .insertInto('users')
            .values({
                email: profile.email,
                name: profile.name,
                password_hash: '', // OAuth users have no password
            })
            .onConflict((oc) =>
                oc.column('email').doUpdateSet({
                    name: profile.name,
                })
            )
            .returningAll()
            .executeTakeFirstOrThrow();

        // Verify user is not soft-deleted
        if (dbUser.deleted_at !== null) {
            throw new AppError(403, 'This account has been deactivated', 'ACCOUNT_DEACTIVATED');
        }

        userId = dbUser.id;
        user = { id: dbUser.id, email: dbUser.email, name: dbUser.name };
    }

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
                monday_user_id: profile.id,
                monday_user_name: profile.name,
                monday_user_email: profile.email,
            }),
        })
        .execute();

    return {
        mode: statePayload.mode,
        user,
        profile,
        connected: true,
    };
}
