/**
 * Mail module types - aligned with AutoHelper TransientEmail schema
 */

export interface TransientEmail {
  id: string;
  subject: string | null;
  sender: string | null;
  received_at: string | null;
  project_id: string | null;
  body_preview: string | null;
  metadata: Record<string, unknown> | null;
  ingestion_id: number | null;
  created_at: string | null;
  triage_status: TriageStatus | string | null;
  triage_notes: string | null;
  triaged_at: string | null;
}

export interface TransientEmailList {
  emails: TransientEmail[];
  total: number;
  limit: number;
  offset: number;
}

export interface MailServiceStatus {
  enabled: boolean;
  running: boolean;
  poll_interval: number;
  output_path: string;
  ingest_path: string;
}

// =============================================================================
// TRIAGE / ENRICHMENT TYPES
// =============================================================================

export type TriageStatus = 'pending' | 'action_required' | 'informational' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface TriageInfo {
  status: TriageStatus;
  confidence: number;
  reasoning: string | null;
  suggestedAction: string | null;
}

// =============================================================================
// PROCESSED EMAIL (Frontend View Model)
// =============================================================================

// =============================================================================
// PROCESSED EMAIL (Frontend View Model)
// =============================================================================

export interface ProcessedEmail {
  id: string;
  subject: string;
  sender: string;
  senderName: string;
  receivedAt: Date | null;
  projectId: string | null;
  bodyPreview: string;
  triage: TriageInfo;
  priority: Priority;
  priorityFactors: string[];
  extractedKeywords: string[];
  hasAttachments: boolean;
  threadCount: number;
  metadata: Record<string, unknown> | null;
}

export interface EnrichedTransientEmail {
  id: string;
  subject: string | null;
  sender: string | null;
  received_at: string | null;
  project_id: string | null;
  body_preview: string | null;
  metadata: Record<string, unknown> | null;
  ingestion_id: number | null;
  created_at: string | null;
  triage: {
    status: TriageStatus;
    confidence: number;
    reasoning: string | null;
    suggested_action: string | null;
  } | null;
  priority: Priority;
  priority_factors: string[];
  extracted_keywords: string[];
  has_attachments: boolean;
  thread_count: number;
}

// =============================================================================
// FILTERS & ACTIONS
// =============================================================================

export interface InboxFilters {
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateTriageRequest {
  status: TriageStatus;
  notes?: string;
}

export interface TriageActionResponse {
  status: string;
  email_id: string;
  triage_status: TriageStatus;
  triaged_at: string;
}

// =============================================================================
// PROMOTED MAIL MESSAGES (PostgreSQL persistence)
// =============================================================================

export interface MailMessage {
  id: string;
  external_id: string;
  subject: string | null;
  sender: string | null;
  sender_name: string | null;
  received_at: string | null;
  body_preview: string | null;
  body_html: string | null;
  metadata: unknown;
  project_id: string | null;
  promoted_at: string;
  promoted_by: string;
  created_at: string;
}

export type MailLinkTargetType = 'action' | 'record' | 'hierarchy_node';

export interface MailLink {
  id: string;
  mail_message_id: string;
  target_type: MailLinkTargetType;
  target_id: string;
  created_at: string;
  created_by: string;
}

export interface MailLinkWithMessage extends MailLink {
  message: MailMessage;
}
