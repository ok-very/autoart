/**
 * Connections Hooks
 *
 * React Query hooks for managing external service connections.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionStatus {
    connected: boolean;
    accountName?: string;
    lastSync?: string;
}

export interface ConnectionsStatus {
    monday: ConnectionStatus;
    google: ConnectionStatus;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Get connection status for all providers
 */
export function useConnections() {
    return useQuery({
        queryKey: ['connections'],
        queryFn: async (): Promise<ConnectionsStatus> => {
            return api.get<ConnectionsStatus>('/connections');
        },
    });
}

/**
 * Connect Monday.com with API key
 */
export function useConnectMonday() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (apiKey: string): Promise<{ connected: boolean }> => {
            return api.post<{ connected: boolean }>('/connections/monday', { apiKey });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
        },
    });
}

/**
 * Disconnect Monday.com
 */
export function useDisconnectMonday() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (): Promise<{ connected: boolean }> => {
            return api.delete<{ connected: boolean }>('/connections/monday');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
        },
    });
}

interface ValidateMondayResult {
    valid: boolean;
    user?: { id: string; name: string; email: string };
    error?: string;
}

/**
 * Validate Monday API key without saving
 */
export function useValidateMondayKey() {
    return useMutation({
        mutationFn: async (apiKey: string): Promise<ValidateMondayResult> => {
            return api.post<ValidateMondayResult>('/connections/monday/validate', { apiKey });
        },
    });
}

// ============================================================================
// GOOGLE OAUTH
// ============================================================================

interface GoogleAuthUrlResult {
    url: string;
    state: string;
}

/**
 * Get Google OAuth authorization URL
 */
export function useGetGoogleAuthUrl() {
    return useMutation({
        mutationFn: async (): Promise<GoogleAuthUrlResult> => {
            return api.get<GoogleAuthUrlResult>('/auth/google');
        },
    });
}

/**
 * Initiate Google OAuth flow (opens popup or redirects)
 */
export function useConnectGoogle() {
    const queryClient = useQueryClient();
    const getAuthUrl = useGetGoogleAuthUrl();

    return useMutation({
        mutationFn: async (): Promise<void> => {
            // Get OAuth URL from backend
            const { url } = await getAuthUrl.mutateAsync();

            // Open popup for OAuth flow
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.innerWidth - width) / 2;
            const top = window.screenY + (window.innerHeight - height) / 2;

            const popup = window.open(
                url,
                'google-oauth',
                `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
            );

            // Listen for the popup to close or send message
            return new Promise((resolve, reject) => {
                const checkPopup = setInterval(() => {
                    if (!popup || popup.closed) {
                        clearInterval(checkPopup);
                        // Refetch connections status
                        queryClient.invalidateQueries({ queryKey: ['connections'] });
                        resolve();
                    }
                }, 500);

                // Timeout after 5 minutes
                setTimeout(() => {
                    clearInterval(checkPopup);
                    if (popup && !popup.closed) {
                        popup.close();
                    }
                    reject(new Error('OAuth timeout'));
                }, 5 * 60 * 1000);
            });
        },
    });
}

/**
 * Disconnect Google (revoke tokens)
 */
export function useDisconnectGoogle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (): Promise<{ disconnected: boolean }> => {
            return api.delete<{ disconnected: boolean }>('/connections/google');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
        },
    });
}

// ============================================================================
// MICROSOFT OAUTH
// ============================================================================

interface MicrosoftAuthUrlResult {
    url: string;
    state: string;
}

/**
 * Get Microsoft OAuth authorization URL
 */
export function useGetMicrosoftAuthUrl() {
    return useMutation({
        mutationFn: async (): Promise<MicrosoftAuthUrlResult> => {
            return api.get<MicrosoftAuthUrlResult>('/auth/microsoft');
        },
    });
}

/**
 * Initiate Microsoft OAuth flow (opens popup)
 */
export function useConnectMicrosoft() {
    const queryClient = useQueryClient();
    const getAuthUrl = useGetMicrosoftAuthUrl();

    return useMutation({
        mutationFn: async (): Promise<void> => {
            // Get OAuth URL from backend
            const { url } = await getAuthUrl.mutateAsync();

            // Open popup for OAuth flow
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.innerWidth - width) / 2;
            const top = window.screenY + (window.innerHeight - height) / 2;

            const popup = window.open(
                url,
                'microsoft-oauth',
                `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
            );

            // Listen for the popup to close
            return new Promise((resolve, reject) => {
                const checkPopup = setInterval(() => {
                    if (!popup || popup.closed) {
                        clearInterval(checkPopup);
                        queryClient.invalidateQueries({ queryKey: ['connections'] });
                        resolve();
                    }
                }, 500);

                // Timeout after 5 minutes
                setTimeout(() => {
                    clearInterval(checkPopup);
                    if (popup && !popup.closed) {
                        popup.close();
                    }
                    reject(new Error('OAuth timeout'));
                }, 5 * 60 * 1000);
            });
        },
    });
}

/**
 * Disconnect Microsoft (revoke tokens)
 */
export function useDisconnectMicrosoft() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (): Promise<{ disconnected: boolean }> => {
            return api.delete<{ disconnected: boolean }>('/connections/microsoft');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
        },
    });
}

// ============================================================================
// MONDAY BOARDS
// ============================================================================

export interface MondayBoard {
    id: string;
    name: string;
    workspace: string;
    itemCount: number;
    boardKind: string;
}

/**
 * Fetch list of accessible Monday.com boards
 */
export function useMondayBoards() {
    return useQuery({
        queryKey: ['monday', 'boards'],
        queryFn: async (): Promise<MondayBoard[]> => {
            const result = await api.get<{ boards: MondayBoard[] }>('/connectors/monday/boards');
            return result.boards;
        },
        retry: false, // Don't retry on auth errors
    });
}

// ============================================================================
// AUTOHELPER PAIRING
// ============================================================================

export interface AutoHelperStatus extends ConnectionStatus {
    instanceCount?: number;
}

export interface AutoHelperInstance {
    displayId: string;
    instanceName: string;
    connectedAt: string;
    lastSeen: string;
}

interface PairingCodeResult {
    code: string;
    expiresAt: string;
    expiresInSeconds: number;
}

interface AutoHelperListResult {
    connected: boolean;
    instances: AutoHelperInstance[];
}

/**
 * Generate a pairing code for AutoHelper connection
 */
export function useGeneratePairingCode() {
    return useMutation({
        mutationFn: async (): Promise<PairingCodeResult> => {
            return api.post<PairingCodeResult>('/connections/autohelper/pair', {});
        },
    });
}

/**
 * Get list of connected AutoHelper instances
 */
export function useAutoHelperInstances() {
    return useQuery({
        queryKey: ['connections', 'autohelper'],
        queryFn: async (): Promise<AutoHelperListResult> => {
            return api.get<AutoHelperListResult>('/connections/autohelper');
        },
        // Poll every 5 seconds to detect new connections from AutoHelper
        refetchInterval: 5000,
    });
}

/**
 * Disconnect an AutoHelper instance
 */
export function useDisconnectAutoHelper() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (displayId: string): Promise<{ disconnected: boolean }> => {
            return api.delete<{ disconnected: boolean }>(`/connections/autohelper/${displayId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            queryClient.invalidateQueries({ queryKey: ['connections', 'autohelper'] });
        },
    });
}
