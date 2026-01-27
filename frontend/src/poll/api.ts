import type { PollTimeConfig } from '@autoart/shared';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/public/poll`
  : '/public/poll';

export interface PollResponse {
  id: string;
  poll_id: string;
  participant_name: string;
  participant_email: string | null;
  available_slots: string[];
  created_at: string;
  updated_at: string;
}

export interface PublicPoll {
  unique_id: string;
  title: string;
  description: string | null;
  time_config: PollTimeConfig;
  responses: PollResponse[];
}

export interface PollResults {
  poll: {
    id: string;
    title: string;
  };
  slotCounts: Record<string, number>;
  bestSlots: string[];
  totalResponses: number;
}

export async function fetchPoll(uniqueId: string): Promise<PublicPoll> {
  const res = await fetch(`${API_BASE}/${uniqueId}`);
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Poll not found' : 'Failed to load poll');
  }
  const data = await res.json();
  return data.poll;
}

export async function submitResponse(
  uniqueId: string,
  participantName: string,
  availableSlots: string[],
  participantEmail?: string
): Promise<PollResponse> {
  const res = await fetch(`${API_BASE}/${uniqueId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_name: participantName,
      participant_email: participantEmail,
      available_slots: availableSlots,
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to submit response');
  }
  const data = await res.json();
  return data.response;
}

export async function updateResponse(
  uniqueId: string,
  participantName: string,
  availableSlots: string[]
): Promise<PollResponse> {
  const res = await fetch(`${API_BASE}/${uniqueId}/respond`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_name: participantName,
      available_slots: availableSlots,
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to update response');
  }
  const data = await res.json();
  return data.response;
}

export async function fetchResults(uniqueId: string): Promise<PollResults> {
  const res = await fetch(`${API_BASE}/${uniqueId}/results`);
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Poll not found' : 'Failed to load results');
  }
  const data = await res.json();
  return data.results;
}
