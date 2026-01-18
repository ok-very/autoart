/**
 * Mail module React Query hooks
 * Connects to AutoHelper backend for email operations
 */

import { useQuery } from '@tanstack/react-query';

import { autohelperApi } from '../autohelperClient';
import type {
  TransientEmailList,
  TransientEmail,
  MailServiceStatus,
  InboxFilters,
  ProcessedEmail,
} from '../types/mail';
import { adaptTransientEmailList, adaptTransientEmail } from '../../lib/dataAdapter';

export const mailQueryKeys = {
  all: () => ['mail'] as const,
  emails: (filters?: InboxFilters) => ['mail', 'emails', filters] as const,
  email: (id: string) => ['mail', 'email', id] as const,
  status: () => ['mail', 'status'] as const,
};

/**
 * Fetch paginated inbox emails
 */
export function useInbox(filters?: InboxFilters) {
  return useQuery({
    queryKey: mailQueryKeys.emails(filters),
    queryFn: async (): Promise<{ emails: ProcessedEmail[]; total: number; limit: number; offset: number }> => {
      const params = new URLSearchParams();
      if (filters?.projectId) params.set('project_id', filters.projectId);
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.offset) params.set('offset', String(filters.offset));

      const queryString = params.toString();
      const endpoint = `/mail/emails${queryString ? `?${queryString}` : ''}`;

      const response = await autohelperApi.get<TransientEmailList>(endpoint);

      return {
        emails: adaptTransientEmailList(response.emails),
        total: response.total,
        limit: response.limit,
        offset: response.offset,
      };
    },
    staleTime: 30000,
  });
}

/**
 * Fetch a single email by ID
 */
export function useEmail(id: string | null) {
  return useQuery({
    queryKey: mailQueryKeys.email(id || ''),
    queryFn: async (): Promise<ProcessedEmail> => {
      const response = await autohelperApi.get<TransientEmail>(`/mail/emails/${id}`);
      return adaptTransientEmail(response);
    },
    enabled: !!id,
  });
}

/**
 * Poll mail service status
 */
export function useMailStatus() {
  return useQuery({
    queryKey: mailQueryKeys.status(),
    queryFn: () => autohelperApi.get<MailServiceStatus>('/mail/status'),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}
