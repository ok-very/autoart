/**
 * API client utilities for mail app
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

export interface Email {
    id: string;
    subject: string;
    from: string;
    fromName: string;
    receivedDateTime: string;
    projectId: string;
    projectName: string;
    constructionPhase?: string;
    stakeholderType: string;
    priority: number;
    hasAttachments: boolean;
    attachments: Array<{
        id: string;
        name: string;
        filename: string;
        contentType: string;
        localPath?: string;
        size: number;
        type: string;
        url: string;
    }>;
    bodyPreview: string;
    cc: string | null;
    developer: string;
    priorityFactors: unknown[];
    triage?: {
        bucket: string;
        confidence: number;
        reasoning: string[];
        preReplyActions: { description: string; type: string }[];
        postReplyActions: { description: string; type: string }[];
        suggestedReplyOpener?: string;
    };
    extractedKeywords: string[];
    metadata?: {
        triage_status?: string;
        notes?: string;
    };
}

export interface ListEmailsResponse {
    emails: Email[];
    total: number;
}

export async function fetchEmails(): Promise<ListEmailsResponse> {
    const response = await fetch(`${API_BASE}/mail/emails`);
    if (!response.ok) {
        throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }
    return response.json();
}

export async function updateEmailTriage(
    id: string,
    update: { status: string; notes?: string }
): Promise<Email> {
    const response = await fetch(`${API_BASE}/mail/emails/${id}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
    });
    if (!response.ok) {
        throw new Error(`Failed to update triage: ${response.statusText}`);
    }
    return response.json();
}
