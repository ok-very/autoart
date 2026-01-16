import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { MondayBoardConfig } from '../types/monday';

/**
 * Fetch configurations for multiple boards.
 */
export function useMondayBoardConfigs(boardIds: string[]) {
    return useQuery({
        queryKey: ['monday', 'boards', 'configs', { ids: boardIds.sort().join(',') }],
        queryFn: async () => {
            if (boardIds.length === 0) return [];
            return api.get<MondayBoardConfig[]>(`/monday/boards/configs?ids=${boardIds.join(',')}`);
        },
        enabled: boardIds.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Update a board configuration.
 */
export function useUpdateMondayBoardConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ workspaceId, boardConfigId, update }: {
            workspaceId: string;
            boardConfigId: string;
            update: Partial<MondayBoardConfig>;
        }) => {
            return api.patch<MondayBoardConfig>(
                `/monday/workspaces/${workspaceId}/boards/${boardConfigId}`,
                update
            );
        },
        onSuccess: (_data, variables) => {
            // Invalidate batch query
            queryClient.invalidateQueries({ queryKey: ['monday', 'boards', 'configs'] });

            // Also invalidate full workspace config if we had one
            queryClient.invalidateQueries({ queryKey: ['monday', 'workspaces', variables.workspaceId] });
        },
    });
}

/**
 * Update group configurations for a board.
 * Note: Replaces all groups for the board.
 */
export function useUpdateMondayGroupConfigs() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ workspaceId, boardConfigId, groups }: {
            workspaceId: string;
            boardConfigId: string;
            groups: any[]; // MondayGroupConfig[] but allowing partials if needed
        }) => {
            return api.put<{ groups: any[] }>(
                `/monday/workspaces/${workspaceId}/boards/${boardConfigId}/groups`,
                { groups }
            );
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['monday', 'boards', 'configs'] });
            queryClient.invalidateQueries({ queryKey: ['monday', 'workspaces', variables.workspaceId] });
        },
    });
}

/**
 * Update column configurations for a board.
 * Note: Replaces all columns for the board.
 */
export function useUpdateMondayColumnConfigs() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ workspaceId, boardConfigId, columns }: {
            workspaceId: string;
            boardConfigId: string;
            columns: any[];
        }) => {
            return api.put<{ columns: any[] }>(
                `/monday/workspaces/${workspaceId}/boards/${boardConfigId}/columns`,
                { columns }
            );
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['monday', 'boards', 'configs'] });
            queryClient.invalidateQueries({ queryKey: ['monday', 'workspaces', variables.workspaceId] });
        },
    });
}
