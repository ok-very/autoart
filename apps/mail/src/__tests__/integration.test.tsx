/**
 * Automail Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useInbox } from '../hooks/useInbox';
import * as api from '../lib/api';

// Mock the API module
vi.mock('../lib/api', () => ({
    fetchEmails: vi.fn(),
}));

const mockEmails = {
    emails: [
        {
            id: 'email-001',
            subject: 'Test Email',
            from: 'test@example.com',
            fromName: 'Test User',
            receivedDateTime: new Date().toISOString(),
            projectId: 'proj-001',
            projectName: 'Test Project',
            stakeholderType: 'client',
            priority: 5,
            hasAttachments: false,
            attachments: [],
            bodyPreview: 'Test body preview',
            cc: null,
            developer: 'Test Dev',
            priorityFactors: [],
            extractedKeywords: [],
        },
    ],
    total: 1,
};

describe('Automail Integration', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        vi.resetAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    it('should fetch emails from backend', async () => {
        vi.mocked(api.fetchEmails).mockResolvedValue(mockEmails);

        const { result } = renderHook(() => useInbox(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.emails).toBeInstanceOf(Array);
        expect(result.current.data?.emails.length).toBe(1);
        expect(result.current.data?.total).toBe(1);
    });

    it('should handle API errors gracefully', async () => {
        vi.mocked(api.fetchEmails).mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useInbox(), { wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeDefined();
    });

    it('should return loading state initially', () => {
        vi.mocked(api.fetchEmails).mockImplementation(
            () => new Promise(() => { }) // Never resolves
        );

        const { result } = renderHook(() => useInbox(), { wrapper });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });
});
