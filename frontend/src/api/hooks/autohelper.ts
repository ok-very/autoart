/**
 * AutoHelper API Hooks
 * React Query hooks for AutoHelper endpoints
 */

import { useQuery, useMutation } from '@tanstack/react-query';

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
