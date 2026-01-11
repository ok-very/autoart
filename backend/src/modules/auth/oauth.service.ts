/**
 * OAuth Service
 *
 * Handles Google OAuth 2.0 authentication flow.
 */

import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

import { db } from '../../db/client.js';
import { AppError } from '../../utils/errors.js';
import * as authService from './auth.service.js';

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

// In-memory state store (replace with Redis in production)
const stateStore = new Map<string, { timestamp: number }>();

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
 * Generate OAuth authorization URL
 */
export function getGoogleAuthUrl(): { url: string; state: string } {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new AppError(500, 'Google OAuth is not configured', 'OAUTH_NOT_CONFIGURED');
    }

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    stateStore.set(state, { timestamp: Date.now() });

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

/**
 * Validate state parameter (CSRF protection)
 */
function validateState(state: string): boolean {
    if (!stateStore.has(state)) {
        return false;
    }
    stateStore.delete(state);
    return true;
}

/**
 * Exchange authorization code for tokens
 */
export async function handleGoogleCallback(code: string, state: string) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new AppError(500, 'Google OAuth is not configured', 'OAUTH_NOT_CONFIGURED');
    }

    // Validate state (CSRF protection)
    if (!validateState(state)) {
        throw new AppError(400, 'Invalid or expired state parameter', 'INVALID_STATE');
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile
    const profile = await getGoogleProfile(tokens.access_token!);

    // Find or create user
    let user = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', profile.email)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (!user) {
        // Create new user (OAuth users don't need password)
        user = await db
            .insertInto('users')
            .values({
                email: profile.email,
                name: profile.name,
                password_hash: '', // OAuth users have no password
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    // Store Google tokens in connection_credentials table
    await db
        .insertInto('connection_credentials')
        .values({
            user_id: user.id,
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
                refresh_token: tokens.refresh_token || null,
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

    return { user, tokens };
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
        throw new AppError(500, 'Failed to fetch Google profile', 'OAUTH_PROFILE_FAILED');
    }

    const data = await response.json();
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
