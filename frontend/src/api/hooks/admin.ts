/**
 * Admin Hooks
 *
 * React Query hooks for admin operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';

// ============================================================================
// TYPES
// ============================================================================

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar_url: string | null;
    created_at: string;
    deleted_at: string | null;
    deleted_by: string | null;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * List all users (including deleted) for admin view.
 */
export function useAdminUsers() {
    return useQuery({
        queryKey: ['admin', 'users'],
        queryFn: async () => {
            const response = await api.get<{ users: AdminUser[] }>('/auth/admin/users');
            return response.users;
        },
    });
}

/**
 * Soft delete a user.
 */
export function useSoftDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, reassignTo }: { userId: string; reassignTo?: string }) => {
            const qs = reassignTo ? `?reassignTo=${reassignTo}` : '';
            return api.delete<{ message: string; user: AdminUser }>(
                `/auth/admin/users/${userId}${qs}`
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
    });
}

/**
 * Create a new user (admin).
 */
export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { email: string; name: string; role?: string; password: string }) => {
            return api.post<{ user: AdminUser }>('/auth/admin/users', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
    });
}

/**
 * Update a user's profile (admin).
 */
export function useUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, ...data }: { userId: string; name?: string; email?: string; role?: string }) => {
            return api.patch<{ user: AdminUser }>(`/auth/admin/users/${userId}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
    });
}

/**
 * Reset a user's password (admin).
 */
export function useResetUserPassword() {
    return useMutation({
        mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
            return api.post<{ message: string }>(`/auth/admin/users/${userId}/reset-password`, { password });
        },
    });
}
