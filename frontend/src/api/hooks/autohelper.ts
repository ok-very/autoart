/**
 * AutoHelper API Hooks
 * React Query hooks for AutoHelper endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
