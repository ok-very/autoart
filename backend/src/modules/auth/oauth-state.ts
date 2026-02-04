/**
 * OAuth State Utility
 *
 * Stateless HMAC-signed state parameter for OAuth flows.
 * Replaces in-memory state stores with cryptographically signed tokens.
 *
 * State payload: mode:userId:timestamp:entropy
 * Format: base64url(payload).base64url(hmac-signature)
 *
 * Supports two modes:
 * - login: User authenticating to create/find an account (no userId required)
 * - link: Existing user linking an external account (userId required)
 */

import crypto from 'crypto';

import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

export type OAuthMode = 'login' | 'link';

export interface StatePayload {
    mode: OAuthMode;
    userId?: string;
    timestamp: number;
    entropy: string;
}

// State expires after 10 minutes
const STATE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Generate a signed state parameter for OAuth CSRF protection.
 *
 * @param mode - 'login' for new authentication, 'link' for connecting account to existing user
 * @param userId - Required for 'link' mode, ignored for 'login' mode
 * @returns Signed state string
 */
export function generateOAuthState(mode: OAuthMode, userId?: string): string {
    if (mode === 'link' && !userId) {
        throw new AppError(400, 'userId required for link mode', 'INVALID_STATE_CONFIG');
    }

    const timestamp = Date.now();
    const entropy = crypto.randomBytes(8).toString('hex');
    const payload = `${mode}:${userId || ''}:${timestamp}:${entropy}`;

    const signature = crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(payload)
        .digest('base64url');

    return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

/**
 * Validate a signed state parameter and return the decoded payload.
 * Throws AppError if state is invalid, tampered, or expired.
 *
 * @param state - The state string from OAuth callback
 * @returns Decoded payload with mode, optional userId, timestamp, and entropy
 */
export function validateOAuthState(state: string): StatePayload {
    const parts = state.split('.');

    if (parts.length !== 2) {
        throw new AppError(400, 'Invalid state format', 'INVALID_STATE');
    }

    const [payloadBase64, providedSignature] = parts;

    if (!payloadBase64 || !providedSignature) {
        throw new AppError(400, 'Invalid state format', 'INVALID_STATE');
    }

    // Decode payload
    let payload: string;
    try {
        payload = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    } catch {
        throw new AppError(400, 'Invalid state encoding', 'INVALID_STATE');
    }

    // Verify signature using timing-safe comparison
    const expectedSignature = crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(payload)
        .digest('base64url');

    if (!timingSafeEqual(providedSignature, expectedSignature)) {
        throw new AppError(400, 'Invalid state signature', 'INVALID_STATE');
    }

    // Parse payload: mode:userId:timestamp:entropy
    const payloadParts = payload.split(':');

    if (payloadParts.length !== 4) {
        throw new AppError(400, 'Invalid state payload', 'INVALID_STATE');
    }

    const [mode, userId, timestampStr, entropy] = payloadParts;

    if (mode !== 'login' && mode !== 'link') {
        throw new AppError(400, 'Invalid state mode', 'INVALID_STATE');
    }

    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
        throw new AppError(400, 'Invalid state timestamp', 'INVALID_STATE');
    }

    // Check expiration
    if (Date.now() - timestamp > STATE_EXPIRY_MS) {
        throw new AppError(400, 'State expired', 'STATE_EXPIRED');
    }

    return {
        mode: mode as OAuthMode,
        userId: userId || undefined,
        timestamp,
        entropy,
    };
}

/**
 * Timing-safe string comparison to prevent timing attacks on signature validation.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Still perform comparison to maintain constant time
        const dummy = Buffer.from(a);
        crypto.timingSafeEqual(dummy, dummy);
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
