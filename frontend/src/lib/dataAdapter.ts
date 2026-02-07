/**
 * Data Adapter Layer
 * Transforms backend schemas to frontend view models
 */

import type {
  TransientEmail,
  EnrichedTransientEmail,
  ProcessedEmail,
  TriageInfo,
  TriageStatus,
  Priority,
} from '../api/types/mail';

/**
 * Extract sender name from email address
 * "John Doe <john@example.com>" -> "John Doe"
 * "john@example.com" -> "john"
 */
function extractSenderName(sender: string | null): string {
  if (!sender) return 'Unknown';

  const match = sender.match(/^(.+?)\s*<[^>]+>$/);
  if (match) {
    return match[1].trim();
  }

  const emailMatch = sender.match(/^([^@]+)@/);
  if (emailMatch) {
    return emailMatch[1];
  }

  return sender;
}

/**
 * Infer priority from email metadata/subject
 */
function inferPriority(email: TransientEmail): Priority {
  const subject = (email.subject || '').toLowerCase();
  const metadata = email.metadata || {};

  if (metadata.importance === 'high' || subject.includes('urgent') || subject.includes('asap')) {
    return 'high';
  }

  if (metadata.importance === 'low' || subject.includes('fyi') || subject.includes('newsletter')) {
    return 'low';
  }

  return 'medium';
}

/** Known triage statuses from the backend. */
const KNOWN_TRIAGE_STATUSES = new Set<string>([
  'pending',
  'action_required',
  'informational',
  'archived',
]);

function isKnownTriageStatus(value: string): value is TriageStatus {
  return KNOWN_TRIAGE_STATUSES.has(value);
}

function createPlaceholderTriage(email?: TransientEmail): TriageInfo {
  // null triage_status means never triaged
  if (!email?.triage_status) {
    return {
      status: 'pending',
      confidence: 0,
      reasoning: null,
      suggestedAction: null,
    };
  }

  // Guard against unexpected values from the backend
  const status: TriageStatus = isKnownTriageStatus(email.triage_status)
    ? email.triage_status
    : 'pending';

  return {
    status,
    confidence: 1,
    reasoning: email.triage_notes ?? null,
    suggestedAction: null,
  };
}

/**
 * Adapt TransientEmail from backend to ProcessedEmail for frontend
 */
export function adaptTransientEmail(email: TransientEmail): ProcessedEmail {
  return {
    id: email.id,
    subject: email.subject || '(No Subject)',
    sender: email.sender || 'Unknown',
    senderName: extractSenderName(email.sender),
    receivedAt: email.received_at ? new Date(email.received_at) : null,
    projectId: email.project_id,
    bodyPreview: email.body_preview || '',
    triage: createPlaceholderTriage(email),
    priority: inferPriority(email),
    priorityFactors: [],
    extractedKeywords: [],
    hasAttachments: false,
    threadCount: 1,
    metadata: email.metadata,
  };
}

/**
 * Adapt EnrichedTransientEmail from backend to ProcessedEmail for frontend
 */
export function adaptEnrichedEmail(email: EnrichedTransientEmail): ProcessedEmail {
  const triage: TriageInfo = email.triage
    ? {
      status: email.triage.status,
      confidence: email.triage.confidence,
      reasoning: email.triage.reasoning,
      suggestedAction: email.triage.suggested_action,
    }
    : createPlaceholderTriage();

  return {
    id: email.id,
    subject: email.subject || '(No Subject)',
    sender: email.sender || 'Unknown',
    senderName: extractSenderName(email.sender),
    receivedAt: email.received_at ? new Date(email.received_at) : null,
    projectId: email.project_id,
    bodyPreview: email.body_preview || '',
    triage,
    priority: email.priority,
    priorityFactors: email.priority_factors,
    extractedKeywords: email.extracted_keywords,
    hasAttachments: email.has_attachments,
    threadCount: email.thread_count,
    metadata: email.metadata,
  };
}

/**
 * Adapt a list of TransientEmails
 */
export function adaptTransientEmailList(emails: TransientEmail[]): ProcessedEmail[] {
  return emails.map(adaptTransientEmail);
}

/**
 * Adapt a list of EnrichedTransientEmails
 */
export function adaptEnrichedEmailList(emails: EnrichedTransientEmail[]): ProcessedEmail[] {
  return emails.map(adaptEnrichedEmail);
}
