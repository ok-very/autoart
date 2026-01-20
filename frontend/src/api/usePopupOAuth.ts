/**
 * usePopupOAuth
 * 
 * Shared utility for OAuth popup flows with proper timeout cleanup.
 * Used by Google and Microsoft OAuth connection flows.
 * 
 * DESIGN: This hook is generic and does NOT invalidate any queries.
 * Callers should handle cache invalidation in their onSuccess handlers.
 */

import { useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface PopupOAuthOptions {
    /** Window name for the popup */
    name: string;
    /** Timeout in milliseconds (default: 5 minutes) */
    timeoutMs?: number;
    /** Popup dimensions */
    width?: number;
    height?: number;
}

export class PopupBlockedError extends Error {
    constructor() {
        super('Popup was blocked by the browser. Please allow popups for this site.');
        this.name = 'PopupBlockedError';
    }
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Opens an OAuth popup and returns a promise that resolves when the popup closes.
 * Properly cleans up both interval and timeout to prevent memory leaks.
 * 
 * @param onPopupClose - Optional callback invoked when the popup closes (for cache invalidation)
 */
export function usePopupOAuth(onPopupClose?: () => void) {
    return useCallback((url: string, options: PopupOAuthOptions): Promise<void> => {
        const {
            name,
            timeoutMs = 5 * 60 * 1000, // 5 minutes default
            width = 500,
            height = 600,
        } = options;

        // Center the popup on screen
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        const popup = window.open(
            url,
            name,
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );

        // Handle popup blocked by browser
        if (!popup) {
            return Promise.reject(new PopupBlockedError());
        }

        return new Promise((resolve, reject) => {
            let timeoutId: ReturnType<typeof setTimeout>;

            // Poll for popup close
            const checkInterval = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutId);
                    // Let caller handle any cache invalidation
                    onPopupClose?.();
                    resolve();
                }
            }, 500);

            // Timeout after specified duration
            timeoutId = setTimeout(() => {
                clearInterval(checkInterval);
                if (!popup.closed) {
                    popup.close();
                }
                reject(new Error('OAuth timeout'));
            }, timeoutMs);
        });
    }, [onPopupClose]);
}

export default usePopupOAuth;
