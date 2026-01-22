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
