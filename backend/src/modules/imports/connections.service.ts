/**
 * Connections Service
 *
 * Manages OAuth credentials and API tokens for external providers.
 * Supports per-user credentials with fallback to environment variables.
 */

import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

import { db } from '../../db/client.js';
import type {
    ConnectionCredential,
    NewConnectionCredential,
} from '../../db/schema.js';

export type Provider = 'monday' | 'asana' | 'notion' | 'jira' | 'google' | 'microsoft' | 'autohelper';

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get credential for a user and provider.
 * Falls back to system-wide credential if user-specific not found.
 */
export async function getCredential(
    userId: string | null,
    provider: Provider
): Promise<ConnectionCredential | null> {
    // First try user-specific credential
    if (userId) {
        const userCred = await db
            .selectFrom('connection_credentials')
            .selectAll()
            .where('user_id', '=', userId)
            .where('provider', '=', provider)
            .executeTakeFirst();

        if (userCred) return userCred;
    }

    // Fall back to system-wide credential
    const systemCred = await db
        .selectFrom('connection_credentials')
        .selectAll()
        .where('user_id', 'is', null)
        .where('provider', '=', provider)
        .executeTakeFirst();

    return systemCred ?? null;
}

/**
 * Save or update a credential.
 * Uses delete-then-insert pattern because partial unique indexes don't work with ON CONFLICT.
 */
export async function saveCredential(
    params: NewConnectionCredential
): Promise<ConnectionCredential> {
    // First delete any existing credential for this user/provider
    let deleteQuery = db
        .deleteFrom('connection_credentials')
        .where('provider', '=', params.provider);

    if (params.user_id) {
        deleteQuery = deleteQuery.where('user_id', '=', params.user_id);
    } else {
        deleteQuery = deleteQuery.where('user_id', 'is', null);
    }

    await deleteQuery.execute();

    // Then insert the new credential
    const result = await db
        .insertInto('connection_credentials')
        .values(params)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Delete a credential.
 */
export async function deleteCredential(
    userId: string | null,
    provider: Provider
): Promise<void> {
    let query = db
        .deleteFrom('connection_credentials')
        .where('provider', '=', provider);

    if (userId) {
        query = query.where('user_id', '=', userId);
    } else {
        query = query.where('user_id', 'is', null);
    }

    await query.execute();
}

// ============================================================================
// TOKEN HELPERS
// ============================================================================

/**
 * Get Monday.com API token with fallback chain:
 * 1. User-specific credential from DB
 * 2. System-wide credential from DB
 * 3. Environment variable MONDAY_API_TOKEN or MONDAY_API_KEY
 */
export async function getMondayToken(userId?: string): Promise<string> {
    const credential = await getCredential(userId ?? null, 'monday');

    if (credential) {
        // Check if token is expired
        if (credential.expires_at && credential.expires_at < new Date()) {
            // TODO: Implement token refresh
            console.warn('Monday API token expired, falling back to env var');
        } else {
            return credential.access_token;
        }
    }

    // Fall back to environment variable (support both naming conventions)
    const envToken = process.env.MONDAY_API_TOKEN ?? process.env.MONDAY_API_KEY;
    if (!envToken) {
        throw new Error(
            'No Monday API token found. Set MONDAY_API_TOKEN or MONDAY_API_KEY env var, or connect your account.'
        );
    }

    return envToken;
}

/**
 * Get Google OAuth access token with fallback chain:
 * 1. User-specific credential from DB
 * 2. System-wide credential from DB
 * 3. Environment variable GOOGLE_ACCESS_TOKEN
 */
export async function getGoogleToken(userId?: string): Promise<string> {
    const credential = await getCredential(userId ?? null, 'google');

    if (credential) {
        // Token still valid — return it
        if (!credential.expires_at || credential.expires_at >= new Date()) {
            return credential.access_token;
        }

        // Token expired — try to refresh
        if (credential.refresh_token) {
            return refreshGoogleToken(credential);
        }

        // Expired with no refresh token — fall back to env token if available
        const envToken = process.env.GOOGLE_ACCESS_TOKEN;
        if (envToken) {
            return envToken;
        }

        // No refresh token and no env token — user must reconnect
        throw new Error(
            'Google OAuth token expired and no refresh token available. Please reconnect your Google account in Settings.'
        );
    }

    // Fall back to environment variable (for testing/development)
    const envToken = process.env.GOOGLE_ACCESS_TOKEN;
    if (!envToken) {
        throw new Error(
            'No Google OAuth token found. Please connect your Google account in Settings.'
        );
    }

    return envToken;
}

/**
 * Refresh an expired Google OAuth access token using the stored refresh token.
 * Updates the credential row in DB and returns the new access token.
 */
async function refreshGoogleToken(credential: ConnectionCredential): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            'Google OAuth credentials not configured. Cannot refresh token.'
        );
    }

    const oauth2Client = new OAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: credential.refresh_token! });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
        throw new Error(
            'Failed to refresh Google OAuth token. Please reconnect your Google account in Settings.'
        );
    }

    // Update the stored credential with the new access token and expiry
    await db
        .updateTable('connection_credentials')
        .set({
            access_token: credentials.access_token,
            expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            updated_at: new Date(),
        })
        .where('id', '=', credential.id)
        .execute();

    return credentials.access_token;
}

/**
 * Get Microsoft OAuth access token with auto-refresh.
 */
export async function getMicrosoftToken(userId?: string): Promise<string> {
    const credential = await getCredential(userId ?? null, 'microsoft');

    if (credential) {
        // Token still valid
        if (!credential.expires_at || credential.expires_at >= new Date()) {
            return credential.access_token;
        }

        // Token expired — try to refresh
        if (credential.refresh_token) {
            return refreshMicrosoftToken(credential);
        }

        throw new Error(
            'Microsoft OAuth token expired and no refresh token available. Please reconnect your Microsoft account.'
        );
    }

    throw new Error(
        'No Microsoft OAuth token found. Please connect your Microsoft account.'
    );
}

/**
 * Refresh an expired Microsoft OAuth access token using the stored refresh token.
 */
async function refreshMicrosoftToken(credential: ConnectionCredential): Promise<string> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            'Microsoft OAuth credentials not configured. Cannot refresh token.'
        );
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: credential.refresh_token!,
            grant_type: 'refresh_token',
            scope: 'Files.ReadWrite.All offline_access User.Read',
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Microsoft token refresh failed:', errorText);
        throw new Error('Failed to refresh Microsoft OAuth token. Please reconnect your Microsoft account.');
    }

    const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
    };

    // Update the stored credential
    await db
        .updateTable('connection_credentials')
        .set({
            access_token: data.access_token,
            refresh_token: data.refresh_token || credential.refresh_token,
            expires_at: new Date(Date.now() + data.expires_in * 1000),
            updated_at: new Date(),
        })
        .where('id', '=', credential.id)
        .execute();

    return data.access_token;
}

/**
 * Check if a provider is connected for a user.
 */
export async function isProviderConnected(
    userId: string | null,
    provider: Provider
): Promise<boolean> {
    const credential = await getCredential(userId, provider);
    if (!credential) return false;

    // Check expiry
    if (credential.expires_at && credential.expires_at < new Date()) {
        // Attempt refresh if we have a refresh token
        if (credential.refresh_token) {
            try {
                if (provider === 'google') {
                    await refreshGoogleToken(credential);
                    return true;
                }
                if (provider === 'microsoft') {
                    await refreshMicrosoftToken(credential);
                    return true;
                }
            } catch (err) {
                console.warn(`${provider} token refresh failed:`, (err as Error).message);
                return false;
            }
        }
        return false;
    }

    return true;
}

// ============================================================================
// AUTOHELPER LINK KEY
// ============================================================================

/**
 * Generate a persistent link key for AutoHelper and store it in the DB.
 * Upserts: if a key already exists for this user, it's replaced.
 */
export async function generateLinkKey(userId: string): Promise<string> {
    const key = randomBytes(32).toString('hex');

    await saveCredential({
        user_id: userId,
        provider: 'autohelper',
        access_token: key,
        refresh_token: null,
        expires_at: null,
        scopes: [],
        metadata: {},
    });

    return key;
}

/**
 * Validate a link key and return the associated user ID.
 * Looks up the key in connection_credentials where provider = 'autohelper'.
 */
export async function validateLinkKey(key: string): Promise<string | null> {
    const credential = await db
        .selectFrom('connection_credentials')
        .select(['user_id'])
        .where('provider', '=', 'autohelper')
        .where('access_token', '=', key)
        .executeTakeFirst();

    return credential?.user_id ?? null;
}

/**
 * Revoke (delete) the AutoHelper link key for a user.
 */
export async function revokeLinkKey(userId: string): Promise<void> {
    await deleteCredential(userId, 'autohelper');
}

/**
 * Get Monday API token for a trusted AutoHelper link key.
 * Validates the key, then proxies the Monday token for the associated user.
 */
export async function getProxiedMondayToken(key: string): Promise<string | null> {
    const userId = await validateLinkKey(key);
    if (!userId) return null;

    try {
        return await getMondayToken(userId);
    } catch {
        return null;
    }
}

// ============================================================================
// CLAIM TOKEN PAIRING (Plex-style)
// ============================================================================

// Alphabet for claim codes: uppercase alphanumeric, excluding ambiguous chars
const CLAIM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, 1, I

/**
 * Generate a 6-character claim code for pairing.
 * Stored in connection_credentials with provider 'autohelper_claim'.
 * 5-minute TTL.
 */
export async function generateClaimToken(userId: string): Promise<{ code: string; expiresAt: Date }> {
    // Generate 6-char code from safe alphabet
    const bytes = randomBytes(6);
    const code = Array.from(bytes)
        .map(b => CLAIM_ALPHABET[b % CLAIM_ALPHABET.length])
        .join('');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete any existing claim token for this user
    await db
        .deleteFrom('connection_credentials')
        .where('user_id', '=', userId)
        .where('provider', '=', 'autohelper_claim')
        .execute();

    // Store the claim token
    await db
        .insertInto('connection_credentials')
        .values({
            user_id: userId,
            provider: 'autohelper_claim',
            access_token: code,
            refresh_token: null,
            expires_at: expiresAt,
            scopes: [],
            metadata: {},
        })
        .execute();

    return { code, expiresAt };
}

/**
 * Redeem a claim code: validate it, generate a link key, delete the claim token.
 * Called by AutoHelper (unauthenticated) after user enters the code.
 * Returns the link key on success, null if code is invalid/expired.
 */
export async function redeemClaimToken(code: string): Promise<{ key: string; userId: string } | null> {
    // Normalize: uppercase, trim
    const normalizedCode = code.toUpperCase().trim();

    // Find the claim token
    const claim = await db
        .selectFrom('connection_credentials')
        .selectAll()
        .where('provider', '=', 'autohelper_claim')
        .where('access_token', '=', normalizedCode)
        .executeTakeFirst();

    if (!claim || !claim.user_id) {
        return null;
    }

    // Check expiry
    if (claim.expires_at && claim.expires_at < new Date()) {
        // Expired — clean it up
        await db
            .deleteFrom('connection_credentials')
            .where('id', '=', claim.id)
            .execute();
        return null;
    }

    // Generate the actual link key
    const key = await generateLinkKey(claim.user_id);

    // Delete the claim token (one-time use)
    await db
        .deleteFrom('connection_credentials')
        .where('id', '=', claim.id)
        .execute();

    return { key, userId: claim.user_id };
}

/**
 * Check if a claim token has been redeemed (i.e., user is now paired).
 * Called by frontend polling.
 */
export async function getClaimStatus(userId: string): Promise<{ claimed: boolean }> {
    // Check if user has an active autohelper link key
    const linkKey = await db
        .selectFrom('connection_credentials')
        .select(['id'])
        .where('user_id', '=', userId)
        .where('provider', '=', 'autohelper')
        .executeTakeFirst();

    // Check if there's still a pending claim token
    const pendingClaim = await db
        .selectFrom('connection_credentials')
        .select(['id', 'expires_at'])
        .where('user_id', '=', userId)
        .where('provider', '=', 'autohelper_claim')
        .executeTakeFirst();

    // Claimed = link key exists AND no pending claim token (or claim expired)
    const claimed = !!linkKey && (!pendingClaim || (pendingClaim.expires_at && pendingClaim.expires_at < new Date()));

    return { claimed };
}
