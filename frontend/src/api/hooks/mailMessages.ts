/**
 * Mail Messages hooks
 *
 * Connects to the backend PostgreSQL-backed mail persistence layer.
 * Distinct from ./mail.ts which talks to AutoHelper for transient browsing.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';
import type {
  MailMessage,
  MailLink,
  MailLinkWithMessage,
  MailLinkTargetType,
} from '../types/mail';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const mailMessageQueryKeys = {
  all: () => ['mailMessages'] as const,
  messages: (filters?: { projectId?: string; limit?: number; offset?: number }) =>
    ['mailMessages', 'list', filters] as const,
  message: (id: string) => ['mailMessages', 'detail', id] as const,
  promotedIds: () => ['mailMessages', 'promotedIds'] as const,
  linksForTarget: (targetType: string, targetId: string) =>
    ['mailMessages', 'links', targetType, targetId] as const,
};

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Fetch promoted mail messages from the backend.
 */
export function useMailMessages(filters?: { projectId?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: mailMessageQueryKeys.messages(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.limit != null) params.set('limit', String(filters.limit));
      if (filters?.offset != null) params.set('offset', String(filters.offset));

      const qs = params.toString();
      return api.get<{ messages: MailMessage[]; total: number }>(
        `/mail/messages${qs ? `?${qs}` : ''}`
      );
    },
    staleTime: 30_000,
  });
}

/**
 * Fetch a single promoted mail message by UUID.
 */
export function useMailMessage(id: string | null) {
  return useQuery({
    queryKey: mailMessageQueryKeys.message(id || ''),
    queryFn: () => api.get<MailMessage>(`/mail/messages/${id}`),
    enabled: !!id,
  });
}

/**
 * Fetch the set of external IDs that have been promoted.
 * Used by the MailPanel to overlay a badge on promoted rows.
 */
export function usePromotedIds() {
  return useQuery({
    queryKey: mailMessageQueryKeys.promotedIds(),
    queryFn: () => api.get<string[]>('/mail/promoted-ids'),
    staleTime: 60_000,
  });
}

/**
 * Fetch mail links for a given target entity (action, record, hierarchy_node).
 */
export function useMailLinksForTarget(targetType: string, targetId: string) {
  return useQuery({
    queryKey: mailMessageQueryKeys.linksForTarget(targetType, targetId),
    queryFn: () =>
      api.get<MailLinkWithMessage[]>(`/mail/links/${targetType}/${targetId}`),
    enabled: !!targetType && !!targetId,
    staleTime: 30_000,
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Promote a transient email from AutoHelper into PostgreSQL.
 * Idempotent — re-promoting returns the existing row.
 */
export function usePromoteEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (externalId: string) =>
      api.post<MailMessage>('/mail/promote', { externalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mailMessageQueryKeys.promotedIds() });
      // Invalidate all message list queries regardless of filters
      queryClient.invalidateQueries({ queryKey: ['mailMessages', 'list'] });
    },
  });
}

/**
 * Create a link between a promoted mail message and a target entity.
 */
export function useLinkEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      messageId,
      targetType,
      targetId,
    }: {
      messageId: string;
      targetType: MailLinkTargetType;
      targetId: string;
    }) =>
      api.post<MailLink>(`/mail/messages/${messageId}/links`, {
        targetType,
        targetId,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: mailMessageQueryKeys.linksForTarget(
          variables.targetType,
          variables.targetId
        ),
      });
      queryClient.invalidateQueries({ queryKey: mailMessageQueryKeys.all() });
    },
  });
}

/**
 * Remove a link by ID.
 */
export function useUnlinkEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      messageId,
      linkId,
      targetType,
      targetId,
    }: {
      messageId: string;
      linkId: string;
      targetType: string;
      targetId: string;
    }) => api.delete(`/mail/messages/${messageId}/links/${linkId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mailMessageQueryKeys.all() });
      // Invalidate the specific target's links query
      queryClient.invalidateQueries({
        queryKey: mailMessageQueryKeys.linksForTarget(
          variables.targetType,
          variables.targetId
        ),
      });
    },
  });
}
