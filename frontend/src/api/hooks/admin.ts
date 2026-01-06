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
        mutationFn: async (userId: string) => {
            return api.delete<{ message: string; user: AdminUser }>(
                `/auth/admin/users/${userId}`
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
    });
}
