
export interface ProcessedEmail {
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
    attachments: Attachment[];
    bodyPreview: string;
    cc: string | null;
    developer: string;
    priorityFactors: string[];
    triage?: {
        bucket: string;
        confidence: number;
        reasoning: string[];
        preReplyActions: { description: string; type: string }[];
        postReplyActions: { description: string; type: string }[];
        suggestedReplyOpener?: string;
    };
    extractedKeywords: string[];
}

export type TriageBucket = string;

export interface ProjectGroup {
    id: string;
    name: string;
    projectId: string;
    highPriorityCount: number;
    emails: ProcessedEmail[];
}

export interface FieldViewModel {
    id: string;
    label: string;
    value: unknown;
    type: string;
    options?: string[];
    renderHint?: string;
    placeholder?: string;
    editable?: boolean;
}

export interface Attachment {
    id: string;
    name: string;
    filename: string; // Added
    contentType: string; // Added
    localPath?: string; // Added
    size: number;
    type: string;
    url: string;
}

export const filterEmails = (emails: ProcessedEmail[], filter: unknown) => { void filter; return emails; };
