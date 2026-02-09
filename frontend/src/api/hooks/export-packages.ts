/**
 * Export Package Hooks
 *
 * React Query hooks for the export package queue API.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
    ExportPackage,
    ExportResult,
    SubmitPackageBody,
    UpdatePackageBody,
} from '@autoart/shared';
import { api } from '../client';

// ============================================================================
// QUERIES
// ============================================================================

export function useExportPackages(filter?: { status?: string }) {
    return useQuery({
        queryKey: ['export-packages', filter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filter?.status) params.set('status', filter.status);
            const query = params.toString();
            const result = await api.get<{ packages: ExportPackage[] }>(
                `/exports/packages${query ? `?${query}` : ''}`,
            );
            return result.packages;
        },
    });
}

export function useExportPackage(id: string | null) {
    return useQuery({
        queryKey: ['export-packages', id],
        queryFn: async () => {
            return api.get<ExportPackage>(`/exports/packages/${id}`);
        },
        enabled: !!id,
    });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useSubmitExportPackage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (body: SubmitPackageBody) => {
            return api.post<ExportPackage>('/exports/packages', body);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['export-packages'] });
        },
    });
}

export function useUpdateExportPackage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: UpdatePackageBody }) => {
            return api.patch<ExportPackage>(`/exports/packages/${id}`, updates);
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['export-packages'] });
            queryClient.invalidateQueries({ queryKey: ['export-packages', id] });
        },
    });
}

export function useDeleteExportPackage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/exports/packages/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['export-packages'] });
        },
    });
}

export function useGeneratePackageProjection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return api.post<{ projection: unknown }>(`/exports/packages/${id}/projection`, {});
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['export-packages', id] });
            queryClient.invalidateQueries({ queryKey: ['export-packages'] });
        },
    });
}

export function useExecutePackageExport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return api.post<ExportResult>(`/exports/packages/${id}/execute`, {});
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['export-packages', id] });
            queryClient.invalidateQueries({ queryKey: ['export-packages'] });
        },
    });
}

export function useReorderPackages() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderedIds: string[]) => {
            return api.post('/exports/packages/reorder', { orderedIds });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['export-packages'] });
        },
    });
}
