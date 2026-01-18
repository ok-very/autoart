/**
 * Data Adapter Layer
 * Transforms backend schemas to frontend view models
 */

import type { TransientEmail, ProcessedEmail, TriageInfo } from '../api/types/mail';

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
function inferPriority(email: TransientEmail): 'high' | 'medium' | 'low' {
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

/**
 * Create placeholder triage info for emails without enrichment
 */
function createPlaceholderTriage(): TriageInfo {
  return {
    status: 'pending',
    confidence: 0,
    reasoning: null,
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
    triage: createPlaceholderTriage(),
    priority: inferPriority(email),
    metadata: email.metadata,
  };
}

/**
 * Adapt a list of TransientEmails
 */
export function adaptTransientEmailList(emails: TransientEmail[]): ProcessedEmail[] {
  return emails.map(adaptTransientEmail);
}
