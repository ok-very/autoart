/**
 * Mail Service
 *
 * Provides email listing and triage update functionality.
 * Uses in-memory mock data for now.
 */

import type { Email, UpdateTriageBody } from './mail.schema.js';

// In-memory email store (mock data for testing)
const mockEmails: Email[] = [
    {
        id: 'email-001',
        subject: 'Project Update: Foundation Complete',
        from: 'contractor@example.com',
        fromName: 'John Smith',
        receivedDateTime: new Date().toISOString(),
        projectId: 'proj-001',
        projectName: 'Downtown Tower',
        stakeholderType: 'contractor',
        priority: 8,
        hasAttachments: true,
        attachments: [
            {
                id: 'att-001',
                name: 'foundation_report.pdf',
                filename: 'foundation_report.pdf',
                contentType: 'application/pdf',
                size: 245000,
                type: 'document',
                url: '/attachments/att-001',
            },
        ],
        bodyPreview: 'The foundation work has been completed...',
        cc: null,
        developer: 'Main Development Corp',
        priorityFactors: [{ factor: 'deadline', weight: 0.8 }],
        triage: {
            bucket: 'ACTION_REQUIRED',
            confidence: 0.85,
            reasoning: ['Contains deliverable', 'High priority sender'],
            preReplyActions: [],
            postReplyActions: [],
        },
        extractedKeywords: ['foundation', 'complete', 'inspection'],
        metadata: {
            triage_status: 'pending',
        },
    },
    {
        id: 'email-002',
        subject: 'Invoice #2024-156',
        from: 'billing@supplier.com',
        fromName: 'Supplier Billing',
        receivedDateTime: new Date(Date.now() - 86400000).toISOString(),
        projectId: 'proj-001',
        projectName: 'Downtown Tower',
        stakeholderType: 'vendor',
        priority: 5,
        hasAttachments: true,
        attachments: [
            {
                id: 'att-002',
                name: 'invoice_2024-156.pdf',
                filename: 'invoice_2024-156.pdf',
                contentType: 'application/pdf',
                size: 45000,
                type: 'document',
                url: '/attachments/att-002',
            },
        ],
        bodyPreview: 'Please find attached invoice for materials...',
        cc: 'accounting@company.com',
        developer: 'Main Development Corp',
        priorityFactors: [],
        triage: {
            bucket: 'APPROVAL_NEEDED',
            confidence: 0.92,
            reasoning: ['Invoice requires approval'],
            preReplyActions: [{ description: 'Review invoice amount', type: 'review' }],
            postReplyActions: [],
        },
        extractedKeywords: ['invoice', 'payment', 'materials'],
        metadata: {
            triage_status: 'pending',
        },
    },
];

// Clone to allow mutations during tests
let emailStore: Email[] = JSON.parse(JSON.stringify(mockEmails));

/**
 * Reset the email store to initial mock data (for testing)
 */
export function resetEmailStore(): void {
    emailStore = JSON.parse(JSON.stringify(mockEmails));
}

/**
 * List all emails
 */
export async function listEmails(): Promise<{ emails: Email[]; total: number }> {
    return {
        emails: emailStore,
        total: emailStore.length,
    };
}

/**
 * Get a single email by ID
 */
export async function getEmailById(id: string): Promise<Email | undefined> {
    return emailStore.find((e) => e.id === id);
}

/**
 * Update triage status for an email
 */
export async function updateTriage(
    id: string,
    update: UpdateTriageBody
): Promise<Email | undefined> {
    const email = emailStore.find((e) => e.id === id);
    if (!email) {
        return undefined;
    }

    email.metadata = {
        ...email.metadata,
        triage_status: update.status,
        notes: update.notes,
    };

    return email;
}
