/**
 * OAuth Service
 *
 * Handles Google OAuth 2.0 authentication flow.
 * Supports both login mode (create/find user) and link mode (connect to existing user).
 */

import { OAuth2Client } from 'google-auth-library';
import { sql } from 'kysely';

import { db } from '../../db/client.js';
import { AppError } from '../../utils/errors.js';
import { generateOAuthState, validateOAuthState, type OAuthMode } from './oauth-state.js';


// Environment validation
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('Warning: Google OAuth credentials not configured. Google authentication will not work.');
}

const oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

/**
 * Generate OAuth authorization URL.
 * If userId is provided, uses 'link' mode to connect Google to an existing user.
 * Otherwise, uses 'login' mode to create/find a user.
 */
export function getGoogleAuthUrl(userId?: string): { url: string; state: string } {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new AppError(500, 'Google OAuth is not configured', 'OAUTH_NOT_CONFIGURED');
    }

    const mode: OAuthMode = userId ? 'link' : 'login';
    const state = generateOAuthState(mode, userId);

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/drive.file', // For exports
            'https://www.googleapis.com/auth/spreadsheets', // For Sheets exports
            'https://www.googleapis.com/auth/presentations', // For Slides exports
        ],
        state,
        prompt: 'consent', // Force consent screen to get refresh token
    });

    return { url, state };
}

export interface GoogleCallbackResult {
    mode: OAuthMode;
    user?: { id: string; email: string; name: string };
    profile: { email: string; name: string };
    connected: boolean;
}

/**
 * Exchange authorization code for tokens.
 * In 'login' mode: creates/finds user and returns user data.
 * In 'link' mode: stores credentials for existing user.
 */
export async function handleGoogleCallback(code: string, state: string): Promise<GoogleCallbackResult> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new AppError(500, 'Google OAuth is not configured', 'OAUTH_NOT_CONFIGURED');
    }

    // Validate state (CSRF protection)
    const statePayload = validateOAuthState(state);

    // Exchange code for tokens
    let tokens;
    try {
        const response = await oauth2Client.getToken(code);
        tokens = response.tokens;
        // Don't call setCredentials - it mutates the shared oauth2Client and creates race conditions
        // Tokens are stored in the database and used per-request when needed
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new AppError(500, `Failed to exchange authorization code: ${message}`, 'OAUTH_TOKEN_EXCHANGE_FAILED', { error: message });
    }

    // Validate access token exists
    if (!tokens || !tokens.access_token) {
        throw new AppError(500, 'No access token received from Google', 'OAUTH_NO_ACCESS_TOKEN');
    }

    // Get user profile
    const profile = await getGoogleProfile(tokens.access_token);

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
                password_hash: '', // OAuth users have no password
            })
            .onConflict((oc) =>
                oc.column('email').doUpdateSet({
                    // Update name if it changed, but only for non-deleted users
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

    // Store Google tokens in connection_credentials table
    await db
        .insertInto('connection_credentials')
        .values({
            user_id: userId,
            provider: 'google',
            access_token: tokens.access_token!,
            refresh_token: tokens.refresh_token || null,
            expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            scopes: JSON.stringify(tokens.scope?.split(' ') || []),
            metadata: JSON.stringify({
                id_token: tokens.id_token,
                token_type: tokens.token_type,
            }),
        })
        .onConflict((oc) =>
            oc.columns(['user_id', 'provider']).doUpdateSet({
                access_token: tokens.access_token!,
                // Preserve existing refresh_token if Google doesn't return a new one
                refresh_token: tokens.refresh_token ? tokens.refresh_token : sql`refresh_token`,
                expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                scopes: JSON.stringify(tokens.scope?.split(' ') || []),
                metadata: JSON.stringify({
                    id_token: tokens.id_token,
                    token_type: tokens.token_type,
                }),
                updated_at: new Date(),
            })
        )
        .execute();

    return {
        mode: statePayload.mode,
        user,
        profile,
        connected: true,
    };
}

/**
 * Fetch Google user profile
 */
async function getGoogleProfile(accessToken: string): Promise<{ email: string; name: string }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const statusText = response.statusText;
        const body = await response.text().catch(() => 'Unable to read response body');
        throw new AppError(
            500,
            'Failed to fetch Google profile',
            'OAUTH_PROFILE_FAILED',
            { status: response.status, statusText, body }
        );
    }

    const data = await response.json();

    // Validate email exists and is non-empty
    if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
        // Log only non-PII fields to avoid exposing sensitive profile data
        throw new AppError(400, 'Google profile missing email', 'OAUTH_PROFILE_MISSING_EMAIL', {
            provider: data.provider || 'google',
            id: data.id || data.sub,
            emailPresent: Boolean(data.email),
            domain: data.hd || null,
        });
    }

    return {
        email: data.email,
        name: data.name || data.email.split('@')[0],
    };
}

/**
 * Get stored Google tokens for a user
 */
export async function getUserGoogleTokens(userId: string) {
    const credential = await db
        .selectFrom('connection_credentials')
        .selectAll()
        .where('user_id', '=', userId)
        .where('provider', '=', 'google')
        .executeTakeFirst();

    if (!credential) {
        return null;
    }

    return {
        access_token: credential.access_token,
        refresh_token: credential.refresh_token || undefined,
        expiry_date: credential.expires_at ? credential.expires_at.getTime() : undefined,
    };
}
