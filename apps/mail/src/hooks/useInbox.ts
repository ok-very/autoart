/**
 * useInbox hook - React Query hook for fetching emails
 */

import { useQuery } from '@tanstack/react-query';
import { fetchEmails, type ListEmailsResponse } from '../lib/api';

export function useInbox() {
    return useQuery<ListEmailsResponse>({
        queryKey: ['inbox'],
        queryFn: fetchEmails,
    });
}
