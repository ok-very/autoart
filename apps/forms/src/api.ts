import type { IntakePageConfig } from '@autoart/shared';

// In production, VITE_API_URL should be set to the backend URL (e.g., https://api.autoart.work)
// In development, we use the Vite proxy at /public
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/public/intake`
  : '/public/intake';

export interface PublicForm {
  unique_id: string;
  title: string;
  sharepoint_request_url: string | null;
  pages: Array<{
    page_index: number;
    blocks_config: IntakePageConfig;
  }>;
}

export interface SubmissionResult {
  id: string;
  upload_code: string;
  created_at: string;
}

export async function fetchForm(uniqueId: string): Promise<PublicForm> {
  const res = await fetch(`${API_BASE}/forms/${uniqueId}`);
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Form not found' : 'Failed to load form');
  }
  const data = await res.json();
  return data.form;
}

export async function submitForm(
  uniqueId: string,
  uploadCode: string,
  metadata: Record<string, unknown>
): Promise<SubmissionResult> {
  const res = await fetch(`${API_BASE}/forms/${uniqueId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_code: uploadCode, metadata }),
  });
  if (!res.ok) {
    throw new Error('Failed to submit form');
  }
  const data = await res.json();
  return data.submission;
}
