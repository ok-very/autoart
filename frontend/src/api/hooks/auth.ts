import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { AuthResponse, User } from '../../types';

// ==================== AUTH ====================
// These hooks are procedural (session management) and don't fit the CRUD pattern

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<AuthResponse>('/auth/login', data, { skipAuth: true }),
    onSuccess: (data) => {
      api.setToken(data.accessToken);
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
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      api.setToken(null);
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
