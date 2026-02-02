import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../stores/authStore';
import type { AuthResponse, User } from '../../types';
import { api } from '../client';

// ==================== AUTH ====================
// These hooks are procedural (session management) and don't fit the CRUD pattern

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<AuthResponse>('/auth/login', data, { skipAuth: true }),
    onSuccess: (data) => {
      api.setToken(data.accessToken);
      api.setRefreshToken(data.refreshToken);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string }) =>
      api.post<AuthResponse>('/auth/register', data, { skipAuth: true }),
    onSuccess: (data) => {
      api.setToken(data.accessToken);
      api.setRefreshToken(data.refreshToken);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: () => api.post('/auth/logout', { refreshToken: api.getRefreshToken() }),
    onSuccess: () => {
      // Clear API tokens
      api.setToken(null);
      api.setRefreshToken(null);
      // Clear auth store state (triggers redirect via isAuthenticated)
      logout();
      // Clear all cached queries
      queryClient.clear();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => api.get<{ user: User }>('/auth/me').then(r => r.user),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchUsers(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => api.get<{ users: User[] }>(`/auth/users/search?q=${encodeURIComponent(query)}`).then(r => r.users),
    enabled: enabled && query.length >= 1,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string }) =>
      api.patch<{ user: User }>('/auth/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

interface Session {
  id: string;
  created_at: string;
  expires_at: string;
}

export function useSessions() {
  return useQuery({
    queryKey: ['user', 'sessions'],
    queryFn: () => api.get<{ sessions: Session[] }>('/auth/me/sessions').then(r => r.sessions),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useLogoutEverywhere() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: () => api.delete('/auth/me/sessions'),
    onSuccess: () => {
      // Clear API tokens
      api.setToken(null);
      api.setRefreshToken(null);
      // Clear auth store state (triggers redirect via isAuthenticated)
      logout();
      // Clear all cached queries
      queryClient.clear();
    },
  });
}

// ==================== PASSWORD & AVATAR ====================

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post<{ message: string }>('/auth/me/password', data),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post<{ avatarUrl: string; user: User }>('/auth/me/avatar', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ user: User }>('/auth/me/avatar'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

// ==================== USER SETTINGS ====================

export function useUserSettings() {
  return useQuery({
    queryKey: ['user-settings'],
    queryFn: () =>
      api.get<{ settings: Record<string, unknown> }>('/auth/me/settings').then((r) => r.settings),
  });
}

export function useUserSetting(key: string) {
  return useQuery({
    queryKey: ['user-settings', key],
    queryFn: () =>
      api.get<{ key: string; value: unknown }>(`/auth/me/settings/${key}`).then((r) => r.value),
    enabled: !!key,
  });
}

export function useSetUserSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.put<{ key: string; value: unknown }>(`/auth/me/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
  });
}
