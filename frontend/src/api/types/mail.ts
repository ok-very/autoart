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

export interface ProcessedEmail {
  id: string;
  subject: string;
  sender: string;
  senderName: string;
  receivedAt: Date | null;
  projectId: string | null;
  bodyPreview: string;
  triage: TriageInfo | null;
  priority: 'high' | 'medium' | 'low';
  metadata: Record<string, unknown> | null;
}

export interface TriageInfo {
  status: 'pending' | 'actionRequired' | 'informational' | 'archived';
  confidence: number;
  reasoning: string | null;
}

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
