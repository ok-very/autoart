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
    /** Message type to listen for from postMessage (optional) */
    messageType?: string;
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
            messageType,
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
            // eslint-disable-next-line prefer-const -- mutual reference between timeoutId and other cleanup vars
            let checkInterval: ReturnType<typeof setInterval>;
            let messageListener: ((event: MessageEvent) => void) | null = null;
            let settled = false;

            const cleanup = () => {
                if (checkInterval) clearInterval(checkInterval);
                if (messageListener) {
                    window.removeEventListener('message', messageListener);
                }
                if (!popup.closed) {
                    popup.close();
                }
            };

            // Timeout after specified duration
            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error('OAuth timeout'));
            }, timeoutMs);

            // If messageType is provided, listen for postMessage from popup
            if (messageType) {
                messageListener = (event: MessageEvent) => {
                    // Derive expected backend origin from API URL config
                    const apiUrl = import.meta.env.VITE_API_URL;
                    const expectedOrigin = apiUrl
                        ? new URL(apiUrl).origin
                        : window.location.origin;

                    if (event.origin !== expectedOrigin) {
                        return;
                    }

                    // Check if it's the message type we're waiting for
                    if (event.data?.type === messageType) {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        clearTimeout(timeoutId);
                        onPopupClose?.();

                        if (event.data.success) {
                            resolve();
                        } else {
                            reject(new Error(event.data.message || 'OAuth failed'));
                        }
                    }
                };
                window.addEventListener('message', messageListener);
            }

            // Poll for popup close (fallback for when messageType not provided or postMessage fails)
            checkInterval = setInterval(() => {
                if (popup.closed) {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    clearTimeout(timeoutId);
                    onPopupClose?.();

                    // Only resolve if we weren't waiting for a postMessage
                    if (!messageType) {
                        resolve();
                    } else {
                        // If we were waiting for postMessage but popup closed without it, that's likely an error
                        reject(new Error('Popup closed without completing OAuth'));
                    }
                }
            }, 500);
        });
    }, [onPopupClose]);
}

export default usePopupOAuth;
