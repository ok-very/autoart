import { db } from '../../db/client.js';
import type {
  Poll,
  PollResponse,
  NewPoll,
  NewPollResponse,
  PollUpdate,
  PollResponseUpdate,
} from '../../db/schema.js';
import { generateUniqueId } from '@autoart/shared';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

const MAX_UNIQUE_ID_RETRIES = 5;

export interface PollWithResponses extends Poll {
  responses: PollResponse[];
}

export interface PollResults {
  poll: Poll;
  slotCounts: Record<string, number>;
  bestSlots: string[];
  totalResponses: number;
}

export async function createPoll(
  title: string,
  timeConfig: unknown,
  projectId?: string,
  userId?: string
): Promise<Poll> {
  let uniqueId = generateUniqueId(title);
  let retries = 0;

  while (retries < MAX_UNIQUE_ID_RETRIES) {
    try {
      const poll = await db
        .insertInto('polls')
        .values({
          unique_id: uniqueId,
          title,
          time_config: timeConfig,
          project_id: projectId ?? null,
          created_by: userId ?? null,
        } satisfies NewPoll)
        .returningAll()
        .executeTakeFirstOrThrow();

      return poll;
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === '23505';

      if (isUniqueViolation && retries < MAX_UNIQUE_ID_RETRIES - 1) {
        uniqueId = generateUniqueId(title);
        retries++;
      } else {
        throw err;
      }
    }
  }

  throw new ConflictError('Failed to generate unique ID after multiple attempts');
}

export async function getPollById(id: string): Promise<Poll | undefined> {
  return db
    .selectFrom('polls')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function getPollByUniqueId(uniqueId: string): Promise<Poll | undefined> {
  return db
    .selectFrom('polls')
    .selectAll()
    .where('unique_id', '=', uniqueId)
    .executeTakeFirst();
}

export async function getPollWithResponses(id: string): Promise<PollWithResponses | undefined> {
  const poll = await getPollById(id);
  if (!poll) return undefined;

  const responses = await db
    .selectFrom('poll_responses')
    .selectAll()
    .where('poll_id', '=', id)
    .orderBy('created_at', 'asc')
    .execute();

  return { ...poll, responses };
}

export async function listPolls(userId?: string): Promise<Poll[]> {
  let query = db
    .selectFrom('polls')
    .selectAll()
    .orderBy('created_at', 'desc');

  if (userId) {
    query = query.where('created_by', '=', userId);
  }

  return query.execute();
}

export async function submitResponse(
  pollId: string,
  name: string,
  email?: string,
  slots?: string[],
  userId?: string
): Promise<PollResponse> {
  return db
    .insertInto('poll_responses')
    .values({
      poll_id: pollId,
      participant_name: name,
      participant_email: email ?? null,
      available_slots: slots ?? [],
      user_id: userId ?? null,
    } satisfies NewPollResponse)
    .onConflict((oc) =>
      oc
        .columns(['poll_id', 'participant_name'])
        .doUpdateSet({
          participant_email: email ?? null,
          available_slots: slots ?? [],
          user_id: userId ?? null,
          updated_at: new Date(),
        } satisfies PollResponseUpdate)
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateResponse(
  pollId: string,
  name: string,
  slots: string[]
): Promise<PollResponse> {
  const response = await db
    .updateTable('poll_responses')
    .set({
      available_slots: slots,
      updated_at: new Date(),
    } satisfies PollResponseUpdate)
    .where('poll_id', '=', pollId)
    .where('participant_name', '=', name)
    .returningAll()
    .executeTakeFirst();

  if (!response) {
    throw new NotFoundError('PollResponse', `${pollId}/${name}`);
  }

  return response;
}

export async function getResults(pollId: string): Promise<PollResults> {
  const poll = await getPollById(pollId);
  if (!poll) {
    throw new NotFoundError('Poll', pollId);
  }

  const responses = await db
    .selectFrom('poll_responses')
    .selectAll()
    .where('poll_id', '=', pollId)
    .execute();

  const slotCounts: Record<string, number> = {};

  for (const response of responses) {
    const slots = response.available_slots as string[];
    for (const slot of slots) {
      slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
    }
  }

  const maxCount = Math.max(0, ...Object.values(slotCounts));
  const bestSlots = Object.entries(slotCounts)
    .filter(([, count]) => count === maxCount)
    .map(([slot]) => slot)
    .sort();

  return {
    poll,
    slotCounts,
    bestSlots,
    totalResponses: responses.length,
  };
}

export async function closePoll(id: string): Promise<Poll> {
  const poll = await db
    .updateTable('polls')
    .set({
      status: 'closed',
      closed_at: new Date(),
    } satisfies PollUpdate)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!poll) {
    throw new NotFoundError('Poll', id);
  }

  return poll;
}
