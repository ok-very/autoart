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

export type Provider = 'monday' | 'asana' | 'notion' | 'jira';

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
        return false;
    }

    return true;
}
