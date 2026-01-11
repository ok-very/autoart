/**
 * Auth Utilities
 *
 * Shared authentication helpers for accessing provider tokens.
 * This allows modules to get tokens without cross-module imports.
 *
 * Re-exports from imports/connections.service.ts for convenience.
 */

export {
    getCredential,
    getMondayToken,
    getGoogleToken,
    isProviderConnected,
    type Provider,
} from '../modules/imports/connections.service.js';
