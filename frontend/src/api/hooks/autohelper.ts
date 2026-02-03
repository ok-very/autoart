/**
 * AutoHelper API Hooks
 * React Query hooks for AutoHelper endpoints
 *
 * This file contains two sets of hooks:
 * 1. Direct localhost hooks (legacy, for when AutoHelper is local)
 * 2. Backend bridge hooks (new, for remote AutoHelper control via backend)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';
import { autohelperApi } from '../autohelperClient';

// ==================== TYPES ====================

export interface FiletreeNode {
    name: string;
    path: string;
    is_dir: boolean;
    children: FiletreeNode[] | null;
    size: number | null;
    ext: string | null;
}

/** Artifact metadata from AutoHelper lookup */
export interface ArtifactLookupResult {
    artifact_id: string;
    original_filename: string;
    current_filename: string;
    content_hash: string;
    source_url?: string;
    source_path?: string;
    collected_at: string;
    mime_type: string;
    size: number;
    metadata: Record<string, unknown>;
}

export interface FiletreeResponse {
    roots: FiletreeNode[];
}

export interface IntakeSubmissionData {
    id: string;
    form_id: string;
    upload_code: string;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface IntakeCSVExportRequest {
    form_id: string;
    form_title: string;
    submissions: IntakeSubmissionData[];
    output_dir?: string;
}

export interface IntakeCSVExportResponse {
    file_path: string;
    row_count: number;
    columns: string[];
}

// ==================== FILETREE HOOKS ====================

interface FiletreeOptions {
    rootId?: string;
    maxDepth?: number;
    extensions?: string[];
    enabled?: boolean;
}

export function useFiletree(options: FiletreeOptions = {}) {
    const { rootId, maxDepth = 10, extensions, enabled = true } = options;

    return useQuery({
        queryKey: ['autohelper-filetree', rootId, maxDepth, extensions],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (rootId) params.set('root_id', rootId);
            if (maxDepth) params.set('max_depth', String(maxDepth));
            if (extensions?.length) params.set('extensions', extensions.join(','));

            const query = params.toString();
            const endpoint = query ? `/filetree?${query}` : '/filetree';

            return autohelperApi.get<FiletreeResponse>(endpoint);
        },
        enabled,
        staleTime: 30_000, // Cache for 30 seconds
    });
}

// ==================== EXPORT HOOKS ====================

export function useExportIntakeCSV() {
    return useMutation({
        mutationFn: (request: IntakeCSVExportRequest) =>
            autohelperApi.post<IntakeCSVExportResponse>('/export/intake-csv', request),
    });
}

// ==================== ARTIFACT LOOKUP HOOKS ====================

/**
 * Look up artifact by persistent ID from AutoHelper.
 * Used to get current file location when files may have been moved/renamed.
 *
 * @param artifactId - The persistent artifact UUID (survives file moves)
 * @returns Query result with current artifact data including updated path
 */
export function useArtifactLookup(artifactId: string | undefined) {
    return useQuery({
        queryKey: ['autohelper-artifact', artifactId],
        queryFn: () =>
            autohelperApi.get<ArtifactLookupResult>(`/runner/artifacts/${artifactId}`),
        enabled: !!artifactId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}

// ==================== STATUS / HEALTH HOOKS ====================

export interface AutoHelperStatusResponse {
    status: string;
    database: { connected: boolean; path: string; migration_status: string };
    roots: Array<{ path: string; accessible: boolean; file_count?: number }>;
    last_index_run?: { started_at: string; completed_at: string; files_indexed: number };
}

export function useAutoHelperHealth() {
    return useQuery({
        queryKey: ['autohelper-health'],
        queryFn: () => autohelperApi.get<{ status: string }>('/health'),
        retry: false,
        staleTime: 10_000,
    });
}

export function useAutoHelperStatus() {
    return useQuery({
        queryKey: ['autohelper-status'],
        queryFn: () => autohelperApi.get<AutoHelperStatusResponse>('/status'),
        staleTime: 15_000,
    });
}

// ==================== CONFIG HOOKS ====================

export type AutoHelperConfig = Record<string, unknown>;

export function useAutoHelperConfig() {
    return useQuery({
        queryKey: ['autohelper-config'],
        queryFn: () => autohelperApi.get<AutoHelperConfig>('/config'),
        staleTime: 30_000,
    });
}

export function useUpdateAutoHelperConfig() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (config: Partial<AutoHelperConfig>) =>
            autohelperApi.put<AutoHelperConfig>('/config', config),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-config'] });
            qc.invalidateQueries({ queryKey: ['autohelper-status'] });
        },
    });
}

/**
 * Open native folder picker dialog on AutoHelper machine.
 * Returns selected path or null if cancelled.
 */
export function useSelectFolder() {
    return useMutation({
        mutationFn: async () => {
            const result = await autohelperApi.post<{ path: string | null }>(
                '/config/select-folder',
                {},
                { timeout: 130_000 } // 2+ minutes for user to select
            );
            return result.path;
        },
    });
}

// ==================== INDEX HOOKS ====================

export interface IndexStatusResponse {
    status: string;
    total_files?: number;
    last_run?: string;
}

export function useIndexStatus() {
    return useQuery({
        queryKey: ['autohelper-index-status'],
        queryFn: () => autohelperApi.get<IndexStatusResponse>('/index/status'),
        staleTime: 15_000,
    });
}

export function useRescanIndex() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => autohelperApi.post<{ status: string }>('/index/rescan', {}),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-index-status'] });
            qc.invalidateQueries({ queryKey: ['autohelper-status'] });
        },
    });
}

export function useRebuildIndex() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => autohelperApi.post<{ status: string }>('/index/rebuild', {}),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-index-status'] });
            qc.invalidateQueries({ queryKey: ['autohelper-status'] });
        },
    });
}

// ==================== RUNNER HOOKS ====================

export interface RunnerStatusResponse {
    status: string;
    runners: string[];
    active: boolean;
    current_runner?: string;
    progress?: Record<string, unknown>;
}

export interface RunnerResult {
    success: boolean;
    error?: string;
    artifacts?: Array<Record<string, unknown>>;
}

export interface InvokeRequest {
    url: string;
    output_path?: string;
    runner?: string;
}

export function useRunnerStatus() {
    return useQuery({
        queryKey: ['autohelper-runner-status'],
        queryFn: () => autohelperApi.get<RunnerStatusResponse>('/runner/status'),
        staleTime: 5_000,
    });
}

export function useInvokeRunner() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (request: InvokeRequest) =>
            autohelperApi.post<RunnerResult>('/runner/invoke', request, { timeout: 300_000 }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-runner-status'] });
            qc.invalidateQueries({ queryKey: ['autohelper-index-status'] });
        },
    });
}

// ==================== MAIL HOOKS ====================

export interface MailStatusResponse {
    enabled: boolean;
    running: boolean;
    poll_interval: number;
    output_path: string;
    ingest_path: string;
}

export function useMailStatus() {
    return useQuery({
        queryKey: ['autohelper-mail-status'],
        queryFn: () => autohelperApi.get<MailStatusResponse>('/mail/status'),
        staleTime: 10_000,
    });
}

export function useStartMail() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => autohelperApi.post<{ status: string }>('/mail/start'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-mail-status'] });
        },
    });
}

export function useStopMail() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => autohelperApi.post<{ status: string }>('/mail/stop'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-mail-status'] });
        },
    });
}

// ==================== GC HOOKS ====================

export interface GCStatusResponse {
    enabled: boolean;
    last_run?: string;
    next_run?: string;
    last_result?: {
        started_at: string;
        completed_at: string;
        status: string;
        rtf_files_deleted: number;
        rtf_bytes_freed: number;
        manifests_cleaned: number;
        mail_files_deleted: number;
        errors: string[];
    };
}

export function useGCStatus() {
    return useQuery({
        queryKey: ['autohelper-gc-status'],
        queryFn: () => autohelperApi.get<GCStatusResponse>('/gc/status'),
        staleTime: 30_000,
    });
}

export function useRunGC() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => autohelperApi.post<{ status: string; message: string }>('/gc/run'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-gc-status'] });
        },
    });
}

// ====================================================================================
// BACKEND BRIDGE HOOKS (New)
// These route through the AutoArt backend to control AutoHelper remotely
// ====================================================================================

export interface BridgeSettings {
    allowed_roots?: string[];
    excludes?: string[];
    mail_enabled?: boolean;
    mail_poll_interval?: number;
    crawl_depth?: number;
    min_width?: number;
    max_width?: number;
    min_height?: number;
    max_height?: number;
    min_filesize_kb?: number;
    max_filesize_kb?: number;
}

export interface BridgeSettingsResponse {
    settings: BridgeSettings;
    version: number;
}

export interface AdapterInfo {
    name: string;
    available: boolean;
    handler: 'autohelper' | 'backend';
}

export interface BridgeStatusResponse {
    status: {
        database?: { connected: boolean; path: string; migration_status: string };
        roots?: Array<{ path: string; accessible: boolean; file_count?: number }>;
        runner?: { active: boolean; current_runner?: string };
        mail?: { enabled: boolean; running: boolean };
        index?: { status: string; total_files?: number; last_run?: string };
        gc?: { enabled: boolean; last_run?: string };
        adapters?: AdapterInfo[];
    };
    lastSeen: string | null;
    pendingCommands: Array<{ id: string; type: string; status: string }>;
}

export type CommandType =
    | 'rescan_index'
    | 'rebuild_index'
    | 'run_collector'
    | 'start_mail'
    | 'stop_mail'
    | 'run_gc';

export interface QueueCommandRequest {
    commandType: CommandType;
    payload?: {
        url?: string;
        output_path?: string;
    };
}

export interface CommandResponse {
    id: string;
    type: string;
    status: string;
    payload?: unknown;
    result?: unknown;
    createdAt?: string;
    acknowledgedAt?: string | null;
}

/**
 * Get settings from backend bridge.
 * Works even when AutoHelper is offline.
 */
export function useBridgeSettings() {
    return useQuery({
        queryKey: ['autohelper-bridge-settings'],
        queryFn: () => api.get<BridgeSettingsResponse>('/autohelper/settings'),
        staleTime: 30_000,
    });
}

/**
 * Update settings via backend bridge.
 * Settings sync to AutoHelper when it polls.
 */
export function useUpdateBridgeSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (settings: Partial<BridgeSettings>) =>
            api.put<BridgeSettingsResponse>('/autohelper/settings', settings),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-bridge-settings'] });
        },
    });
}

/**
 * Get cached status from backend bridge.
 * Returns last known status even when AutoHelper is offline.
 */
export function useBridgeStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
    return useQuery({
        queryKey: ['autohelper-bridge-status'],
        queryFn: () => api.get<BridgeStatusResponse>('/autohelper/status'),
        staleTime: 5_000,
        enabled: options?.enabled ?? true,
        refetchInterval: options?.refetchInterval,
    });
}

/**
 * Queue a command for AutoHelper execution.
 * Command executes when AutoHelper polls.
 */
export function useQueueCommand() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (request: QueueCommandRequest) =>
            api.post<CommandResponse>('/autohelper/commands', request),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['autohelper-bridge-status'] });
        },
    });
}

/**
 * Get command status and result.
 */
export function useCommandStatus(commandId: string | null) {
    return useQuery({
        queryKey: ['autohelper-command', commandId],
        queryFn: () => api.get<CommandResponse>(`/autohelper/commands/${commandId}`),
        enabled: !!commandId,
        refetchInterval: (query) => {
            // Stop polling once completed/failed
            const status = query.state.data?.status;
            if (status === 'completed' || status === 'failed') {
                return false;
            }
            return 2000; // Poll every 2 seconds while pending/running
        },
    });
}
