/**
 * Microsoft OAuth Service
 *
 * Handles Microsoft OAuth 2.0 authentication flow for OneDrive integration.
 * Uses direct fetch() to Microsoft identity platform endpoints (no heavy SDK).
 * Supports both login mode (create/find user) and link mode (connect to existing user).
 */

import { sql } from 'kysely';

import { db } from '../../db/client.js';
import { AppError } from '../../utils/errors.js';
import { generateOAuthState, validateOAuthState, type OAuthMode } from './oauth-state.js';

// Environment validation
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback';

if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    console.warn('Warning: Microsoft OAuth credentials not configured. Microsoft authentication will not work.');
}

// Microsoft OAuth v2.0 endpoints
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_USERINFO_URL = 'https://graph.microsoft.com/v1.0/me';

// Scopes for OneDrive file access
const SCOPES = [
    'Files.ReadWrite.All',
    'offline_access',
    'User.Read',
].join(' ');

/**
 * Generate Microsoft OAuth authorization URL.
 * If userId is provided, uses 'link' mode to connect Microsoft to an existing user.
 * Otherwise, uses 'login' mode to create/find a user.
 */
export function getMicrosoftAuthUrl(userId?: string): { url: string; state: string } {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        throw new AppError(500, 'Microsoft OAuth is not configured', 'OAUTH_NOT_CONFIGURED');
    }

    const mode: OAuthMode = userId ? 'link' : 'login';
    const state = generateOAuthState(mode, userId);

    const params = new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        response_type: 'code',
        redirect_uri: MICROSOFT_REDIRECT_URI,
        scope: SCOPES,
        state,
        response_mode: 'query',
        prompt: 'consent',
    });

    const url = `${MICROSOFT_AUTH_URL}?${params.toString()}`;
    return { url, state };
}

export interface MicrosoftCallbackResult {
    mode: OAuthMode;
    userId: string;
    user?: { id: string; email: string; name: string };
    profile: { email: string; name: string };
}

/**
 * Exchange authorization code for tokens and store credentials.
 * In 'login' mode: creates/finds user and returns user data.
 * In 'link' mode: stores credentials for existing user.
 */
export async function handleMicrosoftCallback(code: string, state: string): Promise<MicrosoftCallbackResult> {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        throw new AppError(500, 'Microsoft OAuth is not configured', 'OAUTH_NOT_CONFIGURED');
    }

    // Validate state (CSRF protection)
    const statePayload = validateOAuthState(state);

    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            code,
            redirect_uri: MICROSOFT_REDIRECT_URI,
            grant_type: 'authorization_code',
            scope: SCOPES,
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new AppError(
            500,
            `Failed to exchange Microsoft authorization code: ${errorText}`,
            'OAUTH_TOKEN_EXCHANGE_FAILED'
        );
    }

    const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope: string;
    };

    if (!tokens.access_token) {
        throw new AppError(500, 'No access token received from Microsoft', 'OAUTH_NO_ACCESS_TOKEN');
    }

    // Get user profile from Microsoft Graph
    const profile = await getMicrosoftProfile(tokens.access_token);

    let userId: string;
    let user: { id: string; email: string; name: string } | undefined;

    if (statePayload.mode === 'link') {
        // Link mode: use the userId from state
        userId = statePayload.userId!;
    } else {
        // Login mode: find or create user
        const dbUser = await db
            .insertInto('users')
            .values({
                email: profile.email,
                name: profile.name,
                password_hash: '',
            })
            .onConflict((oc) =>
                oc.column('email').doUpdateSet({
                    name: profile.name,
                })
            )
            .returningAll()
            .executeTakeFirstOrThrow();

        if (dbUser.deleted_at !== null) {
            throw new AppError(403, 'This account has been deactivated', 'ACCOUNT_DEACTIVATED');
        }

        userId = dbUser.id;
        user = { id: dbUser.id, email: dbUser.email, name: dbUser.name };
    }

    // Store Microsoft tokens in connection_credentials table
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db
        .insertInto('connection_credentials')
        .values({
            user_id: userId,
            provider: 'microsoft',
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expires_at: expiresAt,
            scopes: JSON.stringify(tokens.scope?.split(' ') || []),
            metadata: JSON.stringify({
                token_type: tokens.token_type,
                email: profile.email,
            }),
        })
        .onConflict((oc) =>
            oc.columns(['user_id', 'provider']).doUpdateSet({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token ? tokens.refresh_token : sql`refresh_token`,
                expires_at: expiresAt,
                scopes: JSON.stringify(tokens.scope?.split(' ') || []),
                metadata: JSON.stringify({
                    token_type: tokens.token_type,
                    email: profile.email,
                }),
                updated_at: new Date(),
            })
        )
        .execute();

    return { mode: statePayload.mode, userId, user, profile };
}

/**
 * Fetch Microsoft user profile from Graph API.
 */
async function getMicrosoftProfile(accessToken: string): Promise<{ email: string; name: string }> {
    const response = await fetch(MICROSOFT_USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const statusText = response.statusText;
        throw new AppError(
            500,
            'Failed to fetch Microsoft profile',
            'OAUTH_PROFILE_FAILED',
            { status: response.status, statusText }
        );
    }

    const data = await response.json() as {
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
    };

    const email = data.mail || data.userPrincipalName;
    if (!email) {
        throw new AppError(400, 'Microsoft profile missing email', 'OAUTH_PROFILE_MISSING_EMAIL');
    }

    return {
        email,
        name: data.displayName || email.split('@')[0],
    };
}
