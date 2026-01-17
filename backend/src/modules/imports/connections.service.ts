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
import { randomBytes, createHmac } from 'crypto';

export type Provider = 'monday' | 'asana' | 'notion' | 'jira' | 'google' | 'autohelper';

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
        // Check if token is expired
        if (credential.expires_at && credential.expires_at < new Date()) {
            // TODO: Implement OAuth refresh token flow
            console.warn('Google OAuth token expired, falling back to env var');
        } else {
            return credential.access_token;
        }
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

// ============================================================================
// AUTOHELPER PAIRING
// ============================================================================

// In-memory store for pairing codes (short-lived, 5 min expiry)
// In production, use Redis or DB with TTL
interface PairingCode {
    code: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
}

const pendingPairingCodes = new Map<string, PairingCode>();

// Active sessions (AutoHelper instances connected to this AutoArt)
interface AutoHelperSession {
    sessionId: string;
    userId: string;
    instanceName: string;
    connectedAt: Date;
    lastSeen: Date;
}

const autohelperSessions = new Map<string, AutoHelperSession>();

/**
 * Generate a 6-digit pairing code for AutoHelper connection.
 * Code expires in 5 minutes and is single-use.
 */
export function generatePairingCode(userId: string): { code: string; expiresAt: Date } {
    // Generate 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    // Clear any existing codes for this user
    for (const [existingCode, data] of pendingPairingCodes) {
        if (data.userId === userId) {
            pendingPairingCodes.delete(existingCode);
        }
    }

    pendingPairingCodes.set(code, {
        code,
        userId,
        createdAt: now,
        expiresAt,
    });

    return { code, expiresAt };
}

/**
 * Validate a pairing code and exchange it for a session.
 * Returns session ID on success, null on failure.
 */
export function validatePairingCode(
    code: string,
    instanceName: string = 'AutoHelper'
): { sessionId: string; userId: string } | null {
    const pairingData = pendingPairingCodes.get(code);

    if (!pairingData) {
        return null; // Code not found
    }

    if (new Date() > pairingData.expiresAt) {
        pendingPairingCodes.delete(code);
        return null; // Code expired
    }

    // Code is valid - consume it (single use)
    pendingPairingCodes.delete(code);

    // Generate session ID
    const sessionId = randomBytes(32).toString('hex');

    // Create session
    const session: AutoHelperSession = {
        sessionId,
        userId: pairingData.userId,
        instanceName,
        connectedAt: new Date(),
        lastSeen: new Date(),
    };

    autohelperSessions.set(sessionId, session);

    return { sessionId, userId: pairingData.userId };
}

/**
 * Validate a session and return the associated user ID.
 */
export function validateSession(sessionId: string): string | null {
    const session = autohelperSessions.get(sessionId);
    if (!session) return null;

    // Update last seen
    session.lastSeen = new Date();
    return session.userId;
}

/**
 * Get Monday API token for a trusted AutoHelper session.
 * This proxies credentials without exposing them to the client.
 */
export async function getProxiedMondayToken(sessionId: string): Promise<string | null> {
    const userId = validateSession(sessionId);
    if (!userId) return null;

    try {
        return await getMondayToken(userId);
    } catch {
        return null;
    }
}

/**
 * List connected AutoHelper instances for a user.
 */
export function getAutoHelperSessions(userId: string): AutoHelperSession[] {
    const sessions: AutoHelperSession[] = [];
    for (const session of autohelperSessions.values()) {
        if (session.userId === userId) {
            sessions.push(session);
        }
    }
    return sessions;
}

/**
 * Disconnect an AutoHelper session.
 */
export function disconnectAutoHelper(sessionId: string): boolean {
    return autohelperSessions.delete(sessionId);
}
