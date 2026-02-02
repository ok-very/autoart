/**
 * Project Members Hooks
 *
 * React Query hooks for project membership management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectMember {
    id: string;
    project_id: string;
    user_id: string;
    role: string;
    assigned_at: string;
    assigned_by: string | null;
    user_name: string;
    user_email: string;
    user_avatar_url: string | null;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useProjectMembers(projectId: string | undefined) {
    return useQuery({
        queryKey: ['project-members', projectId],
        queryFn: async () => {
            const response = await api.get<{ members: ProjectMember[] }>(
                `/projects/${projectId}/members`
            );
            return response.members;
        },
        enabled: !!projectId,
    });
}

export function useAddProjectMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            userId,
            role = 'member',
        }: {
            projectId: string;
            userId: string;
            role?: string;
        }) => {
            return api.post<{ member: ProjectMember }>(
                `/projects/${projectId}/members`,
                { userId, role }
            );
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['project-members', variables.projectId] });
        },
    });
}

export function useRemoveProjectMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ projectId, userId }: { projectId: string; userId: string }) => {
            return api.delete<{ message: string }>(
                `/projects/${projectId}/members/${userId}`
            );
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['project-members', variables.projectId] });
        },
    });
}

export function useUpdateProjectMemberRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            userId,
            role,
        }: {
            projectId: string;
            userId: string;
            role: string;
        }) => {
            return api.patch<{ member: ProjectMember }>(
                `/projects/${projectId}/members/${userId}`,
                { role }
            );
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['project-members', variables.projectId] });
        },
    });
}

export function useTransferOwnership() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ projectId, toUserId }: { projectId: string; toUserId: string }) => {
            return api.post<{ message: string }>(
                `/projects/${projectId}/transfer`,
                { toUserId }
            );
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['project-members', variables.projectId] });
        },
    });
}
