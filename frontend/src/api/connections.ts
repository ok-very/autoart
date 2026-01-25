/**
 * Connections Hooks
 *
 * React Query hooks for managing external service connections.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { usePopupOAuth } from './usePopupOAuth';

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
        // Poll every 5 seconds to detect new AutoHelper connections
        refetchInterval: 5000,
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
// MONDAY OAUTH
// ============================================================================

interface MondayOAuthStatusResult {
    available: boolean;
}

interface MondayAuthUrlResult {
    authUrl: string;
    state: string;
}

/**
 * Check if Monday OAuth is configured on the server
 */
export function useMondayOAuthStatus() {
    return useQuery({
        queryKey: ['monday', 'oauth', 'status'],
        queryFn: async (): Promise<MondayOAuthStatusResult> => {
            return api.get<MondayOAuthStatusResult>('/connections/monday/oauth/status');
        },
        staleTime: 60 * 60 * 1000, // 1 hour - configuration doesn't change often
    });
}

/**
 * Get Monday OAuth authorization URL
 */
export function useGetMondayAuthUrl() {
    return useMutation({
        mutationFn: async (): Promise<MondayAuthUrlResult> => {
            return api.get<MondayAuthUrlResult>('/connections/monday/oauth/authorize');
        },
    });
}

/**
 * Initiate Monday OAuth flow (opens popup)
 */
export function useConnectMondayOAuth() {
    const queryClient = useQueryClient();
    const getAuthUrl = useGetMondayAuthUrl();
    const openPopup = usePopupOAuth();

    return useMutation({
        mutationFn: async (): Promise<void> => {
            // Get OAuth URL from backend
            const { authUrl } = await getAuthUrl.mutateAsync();
            // Use shared popup handler with proper timeout cleanup
            await openPopup(authUrl, { name: 'monday-oauth' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
            queryClient.invalidateQueries({ queryKey: ['monday', 'boards'] });
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
    const openPopup = usePopupOAuth();

    return useMutation({
        mutationFn: async (): Promise<void> => {
            // Get OAuth URL from backend
            const { url } = await getAuthUrl.mutateAsync();
            // Use shared popup handler with proper timeout cleanup
            await openPopup(url, { name: 'google-oauth' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
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
    const openPopup = usePopupOAuth();

    return useMutation({
        mutationFn: async (): Promise<void> => {
            // Get OAuth URL from backend
            const { url } = await getAuthUrl.mutateAsync();
            // Use shared popup handler with proper timeout cleanup
            await openPopup(url, { name: 'microsoft-oauth' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connections'] });
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
