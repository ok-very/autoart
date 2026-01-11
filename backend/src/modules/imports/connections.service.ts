/**
 * Connections Service
 *
 * Manages OAuth credentials and API tokens for external providers.
 * Supports per-user credentials with fallback to environment variables.
 */

import { db } from '../../db/client.js';
import type {
    ConnectionCredential,
    NewConnectionCredential,
} from '../../db/schema.js';

export type Provider = 'monday' | 'asana' | 'notion' | 'jira' | 'google';

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
 * Retrieve the Monday.com API token for the given user or, if none is available or valid, from environment variables.
 *
 * Checks a user-specific credential first, then a system-wide credential, and finally the MONDAY_API_TOKEN or MONDAY_API_KEY environment variables.
 *
 * @param userId - Optional user ID to prefer a user-scoped credential; pass undefined to use only system-wide or env credentials.
 * @returns The Monday.com API access token.
 * @throws Error if no valid credential is found and no MONDAY_API_TOKEN or MONDAY_API_KEY environment variable is set.
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
 * Obtain a Google OAuth access token, preferring a user-specific credential with fallbacks to a system credential and an environment variable.
 *
 * @param userId - Optional user id to look up a user-specific credential; if omitted, only system-wide credentials are considered before falling back to the environment variable
 * @returns The Google OAuth access token
 * @throws Error if a found credential is expired (requires re-authentication) or if no token is available from credentials or the `GOOGLE_ACCESS_TOKEN` environment variable
 */
export async function getGoogleToken(userId?: string): Promise<string> {
    const credential = await getCredential(userId ?? null, 'google');

    if (credential) {
        // Check if token is expired
        if (credential.expires_at && credential.expires_at < new Date()) {
            // TODO: Implement OAuth refresh token flow
            console.warn('Google OAuth token expired');
            throw new Error('Google OAuth token expired. Please re-authenticate.');
        }
        return credential.access_token;
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
 * Determines whether a provider has a valid (unexpired) credential for the given user or the system.
 *
 * @param userId - User ID to check; pass `null` to check for a system-wide credential
 * @param provider - The provider to check connection status for
 * @returns `true` if a credential exists and is not expired, `false` otherwise
 */
export async function isProviderConnected(
    userId: string | null,
    provider: Provider
): Promise<boolean> {
    const credential = await getCredential(userId, provider);
    if (!credential) return false;

    // Check expiry
    if (credential.expires_at && credential.expires_at < new Date()) {
        return false;
    }

    return true;
}
