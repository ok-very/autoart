/**
 * Utility functions for shared use across frontend and backend.
 */

/**
 * Generate a UUID v4 string.
 * Uses native crypto API in browser, Node.js crypto in server environments.
 */
export function generateId(): string {
    // Works in both browser (Web Crypto API) and Node.js 16+
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    // Fallback for environments where crypto is not available
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
