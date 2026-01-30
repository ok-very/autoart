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

import { MondayClient } from './connectors/monday-client.js';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { AppError } from '../../utils/errors.js';

/**
 * Check if Monday OAuth is configured
 */
export function isMondayOAuthConfigured(): boolean {
    return Boolean(env.MONDAY_CLIENT_ID && env.MONDAY_CLIENT_SECRET);
}

/**
 * Generate a signed state parameter for CSRF protection
 * Payload: userId:timestamp:entropy
 * Signature: HMAC(payload, secret)
 */
function generateState(userId: string): string {
    const timestamp = Date.now();
    const entropy = crypto.randomBytes(8).toString('hex');
    const payload = `${userId}:${timestamp}:${entropy}`;

    // Sign the payload
    const signature = crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(payload)
        .digest('base64url');

    return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

/**
 * Validate the state parameter and return the userId
 */
function validateState(state: string): string {
    const [payloadBase64, providedSignature] = state.split('.');

    if (!payloadBase64 || !providedSignature) {
        throw new AppError(400, 'Invalid state format', 'INVALID_STATE');
    }

    // Verify signature
    const payload = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const expectedSignature = crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(payload)
        .digest('base64url');

    if (providedSignature !== expectedSignature) {
        throw new AppError(400, 'Invalid state signature', 'INVALID_STATE');
    }

    const [userId, timestampStr] = payload.split(':');
    const timestamp = parseInt(timestampStr, 10);

    // Check expiration (10 minutes)
    if (Date.now() - timestamp > 10 * 60 * 1000) {
        throw new AppError(400, 'State expired', 'STATE_EXPIRED');
    }

    return userId;
}

/**
 * Generate OAuth authorization URL
 */
export function getMondayAuthUrl(userId: string): { url: string; state: string } {
    if (!env.MONDAY_CLIENT_ID) {
        throw new AppError(500, 'Monday OAuth is not configured', 'MONDAY_OAUTH_NOT_CONFIGURED');
    }

    // Generate stateless CSRF token
    const state = generateState(userId);
    const redirectUri = env.MONDAY_REDIRECT_URI || 'http://localhost:3001/api/connections/monday/callback';

    const params = new URLSearchParams({
        client_id: env.MONDAY_CLIENT_ID,
        redirect_uri: redirectUri,
        state,
    });

    const url = `https://auth.monday.com/oauth2/authorize?${params.toString()}`;

    return { url, state };
}

/**
 * Exchange authorization code for access token
 */
export async function handleMondayCallback(code: string, state: string) {
    if (!env.MONDAY_CLIENT_ID || !env.MONDAY_CLIENT_SECRET) {
        throw new AppError(500, 'Monday OAuth is not configured', 'MONDAY_OAUTH_NOT_CONFIGURED');
    }

    // Validate state (CSRF protection)
    const userId = validateState(state);
    const redirectUri = env.MONDAY_REDIRECT_URI || 'http://localhost:3001/api/connections/monday/callback';

    // Debug: log what credentials are being used (masked)
    console.log('[Monday OAuth] Exchanging code with:', {
        client_id: env.MONDAY_CLIENT_ID,
        client_secret_length: env.MONDAY_CLIENT_SECRET?.length,
        client_secret_prefix: env.MONDAY_CLIENT_SECRET?.slice(0, 4) + '...',
        redirect_uri: redirectUri,
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
