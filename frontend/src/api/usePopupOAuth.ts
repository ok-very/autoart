/**
 * usePopupOAuth
 * 
 * Shared utility for OAuth popup flows with proper timeout cleanup.
 * Used by Google and Microsoft OAuth connection flows.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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

// =============================================================================
// HOOK
// =============================================================================

/**
 * Opens an OAuth popup and returns a promise that resolves when the popup closes.
 * Properly cleans up both interval and timeout to prevent memory leaks.
 */
export function usePopupOAuth() {
    const queryClient = useQueryClient();

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

        return new Promise((resolve, reject) => {
            let timeoutId: ReturnType<typeof setTimeout>;

            // Poll for popup close
            const checkInterval = setInterval(() => {
                if (!popup || popup.closed) {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutId);
                    // Refetch connections status after popup closes
                    queryClient.invalidateQueries({ queryKey: ['connections'] });
                    resolve();
                }
            }, 500);

            // Timeout after specified duration
            timeoutId = setTimeout(() => {
                clearInterval(checkInterval);
                if (popup && !popup.closed) {
                    popup.close();
                }
                reject(new Error('OAuth timeout'));
            }, timeoutMs);
        });
    }, [queryClient]);
}

export default usePopupOAuth;
