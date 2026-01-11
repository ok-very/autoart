/**
 * Export Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
    ExportOptions,
    BfaProjectExportModel,
} from '../../../surfaces/export/types';
import { api } from '../../client';
import { queryKeys } from '../queryKeys';

export type ExportFormat = 'rtf' | 'plaintext' | 'markdown' | 'csv' | 'google-doc';

export type ExportSessionStatus =
    | 'configuring'
    | 'projecting'
    | 'ready'
    | 'executing'
    | 'completed'
    | 'failed';

export interface ExportSession {
    id: string;
    format: ExportFormat;
    projectIds: string[];
    options: ExportOptions;
    targetConfig?: Record<string, unknown>;
    status: ExportSessionStatus;
    projectionCache?: BfaProjectExportModel[];
    error?: string;
    createdBy?: string;
    createdAt: string;
    executedAt?: string;
}

export interface ExportResult {
    success: boolean;
    format: ExportFormat;
    downloadUrl?: string;
    content?: string;
    externalUrl?: string;
    error?: string;
}

export function useCreateExportSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            format: ExportFormat;
            projectIds: string[];
            options?: Partial<ExportOptions>;
            targetConfig?: Record<string, unknown>;
        }) => {
            return api.post<ExportSession>('/exports/sessions', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.exports.all() });
        },
    });
}

export function useExportSession(sessionId: string | null) {
    return useQuery({
        queryKey: queryKeys.exports.job(sessionId!),
        queryFn: async () => {
            return api.get<ExportSession>(`/exports/sessions/${sessionId}`);
        },
        enabled: !!sessionId,
    });
}

export function useExportSessions(params?: {
    status?: ExportSessionStatus;
    format?: ExportFormat;
    limit?: number;
}) {
    return useQuery({
        queryKey: ['export-sessions', params],
        queryFn: async () => {
            const searchParams = new URLSearchParams();
            if (params?.status) searchParams.set('status', params.status);
            if (params?.format) searchParams.set('format', params.format);
            if (params?.limit) searchParams.set('limit', params.limit.toString());

            const query = searchParams.toString();
            return api.get<{ sessions: ExportSession[] }>(
                `/exports/sessions${query ? `?${query}` : ''}`
            );
        },
    });
}

export function useGenerateExportProjection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sessionId: string) => {
            return api.post<{ projection: BfaProjectExportModel[] }>(
                `/exports/sessions/${sessionId}/projection`,
                {}
            );
        },
        onSuccess: (_, sessionId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.exports.job(sessionId) });
            queryClient.invalidateQueries({ queryKey: ['export-projection', sessionId] });
        },
    });
}

export function useExportProjection(sessionId: string | null) {
    return useQuery({
        queryKey: ['export-projection', sessionId],
        queryFn: async () => {
            const result = await api.get<{ projection: BfaProjectExportModel[] }>(
                `/exports/sessions/${sessionId}/projection`
            );
            return result.projection;
        },
        enabled: !!sessionId,
        staleTime: 60000,
    });
}

export function useExecuteExport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sessionId: string) => {
            return api.post<ExportResult>(
                `/exports/sessions/${sessionId}/execute`,
                {}
            );
        },
        onSuccess: (_, sessionId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.exports.job(sessionId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.exports.all() });
        },
    });
}

export function useUpdateExportSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            sessionId,
            updates,
        }: {
            sessionId: string;
            updates: {
                options?: Partial<ExportOptions>;
                projectIds?: string[];
                targetConfig?: Record<string, unknown>;
            };
        }) => {
            return api.patch<ExportSession>(
                `/exports/sessions/${sessionId}`,
                updates
            );
        },
        onSuccess: (_, { sessionId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.exports.job(sessionId) });
        },
    });
}

export function useDeleteExportSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sessionId: string) => {
            return api.delete(`/exports/sessions/${sessionId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.exports.all() });
        },
    });
}

export function useExportWorkflow() {
    const createSession = useCreateExportSession();
    const generateProjection = useGenerateExportProjection();
    const executeExport = useExecuteExport();

    const startExport = async (params: {
        format: ExportFormat;
        projectIds: string[];
        options?: Partial<ExportOptions>;
    }) => {
        const session = await createSession.mutateAsync(params);
        await generateProjection.mutateAsync(session.id);
        return session;
    };

    const finishExport = async (sessionId: string) => {
        return executeExport.mutateAsync(sessionId);
    };

    return {
        startExport,
        finishExport,
        isCreating: createSession.isPending,
        isProjecting: generateProjection.isPending,
        isExecuting: executeExport.isPending,
        isLoading: createSession.isPending || generateProjection.isPending || executeExport.isPending,
        error: createSession.error || generateProjection.error || executeExport.error,
    };
}
