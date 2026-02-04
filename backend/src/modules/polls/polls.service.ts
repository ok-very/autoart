import {
  generateUniqueId,
  PollTimeConfigSchema,
  type EngagementKindType,
  type UpdatePollInput,
  type DuplicatePollInput,
} from '@autoart/shared';

import { db } from '../../db/client.js';
import type {
  Poll,
  PollResponse,
  NewPoll,
  NewPollResponse,
  PollUpdate,
  PollResponseUpdate,
  NewEngagement,
} from '../../db/schema.js';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../../utils/errors.js';

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
  // Validate timeConfig against schema
  const parseResult = PollTimeConfigSchema.safeParse(timeConfig);
  if (!parseResult.success) {
    throw new ValidationError('Invalid time_config: ' + parseResult.error.message);
  }
  const validatedTimeConfig = parseResult.data;

  let uniqueId = generateUniqueId(title);
  let retries = 0;

  while (retries < MAX_UNIQUE_ID_RETRIES) {
    try {
      const poll = await db
        .insertInto('polls')
        .values({
          unique_id: uniqueId,
          title,
          time_config: validatedTimeConfig,
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

      if (isUniqueViolation) {
        retries++;
        if (retries >= MAX_UNIQUE_ID_RETRIES) {
          throw new ConflictError('Failed to generate unique ID after multiple attempts');
        }
        uniqueId = generateUniqueId(title);
      } else {
        throw err;
      }
    }
  }

  // This should never be reached, but provides a safety net
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

/**
 * Submit or update a poll response.
 *
 * NOTE: Intentional when2meet-style behavior - responses are identified by
 * (poll_id, participant_name). This allows:
 * - Users to update their response by re-submitting with the same name
 * - Trust-based participation without authentication (like when2meet/Doodle)
 *
 * This means users sharing the same name on the same poll will overwrite
 * each other's responses. This is accepted behavior for this use case.
 */
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
    const rawSlots = response.available_slots;
    // Safely handle null, undefined, or non-array values
    const slots = Array.isArray(rawSlots) ? rawSlots : [];
    for (const slot of slots) {
      if (typeof slot === 'string') {
        slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
      }
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

export async function updatePoll(
  id: string,
  userId: string,
  updates: UpdatePollInput
): Promise<Poll> {
  const poll = await getPollById(id);
  if (!poll) {
    throw new NotFoundError('Poll', id);
  }
  if (poll.created_by !== userId) {
    throw new ForbiddenError('Not authorized to edit this poll');
  }
  if (poll.status === 'closed') {
    throw new ValidationError('Cannot edit a closed poll');
  }

  // Build update object, validating time_config if provided
  const updateData: PollUpdate = {};

  if (updates.title !== undefined) {
    updateData.title = updates.title;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }
  if (updates.confirmation_message !== undefined) {
    updateData.confirmation_message = updates.confirmation_message;
  }
  if (updates.status !== undefined) {
    updateData.status = updates.status;
  }
  if (updates.time_config !== undefined) {
    const parseResult = PollTimeConfigSchema.safeParse(updates.time_config);
    if (!parseResult.success) {
      throw new ValidationError('Invalid time_config: ' + parseResult.error.message);
    }
    updateData.time_config = parseResult.data;
  }

  const updated = await db
    .updateTable('polls')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return updated;
}

export async function deletePoll(id: string, userId: string): Promise<void> {
  const poll = await getPollById(id);
  if (!poll) {
    throw new NotFoundError('Poll', id);
  }
  if (poll.created_by !== userId) {
    throw new ForbiddenError('Not authorized to delete this poll');
  }

  // Responses cascade delete via FK constraint, but we do it in transaction for clarity
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('poll_responses').where('poll_id', '=', id).execute();
    await trx.deleteFrom('polls').where('id', '=', id).execute();
  });
}

export async function duplicatePoll(
  id: string,
  userId: string,
  input?: DuplicatePollInput
): Promise<Poll> {
  const original = await getPollById(id);
  if (!original) {
    throw new NotFoundError('Poll', id);
  }
  if (original.created_by !== userId) {
    throw new ForbiddenError('Not authorized to duplicate this poll');
  }

  const title = input?.title ?? `${original.title} (copy)`;

  // Use createPoll to get proper unique_id generation
  const newPoll = await createPoll(title, original.time_config, original.project_id ?? undefined, userId);

  // Update with additional fields from original
  if (original.description || original.confirmation_message) {
    return db
      .updateTable('polls')
      .set({
        description: original.description,
        confirmation_message: original.confirmation_message,
      })
      .where('id', '=', newPoll.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  return newPoll;
}

export async function logEngagement(
  contextType: string,
  contextId: string,
  kind: EngagementKindType,
  actorName?: string,
  payload?: Record<string, unknown>
): Promise<void> {
  await db
    .insertInto('engagements')
    .values({
      kind,
      context_type: contextType,
      context_id: contextId,
      actor_name: actorName ?? null,
      payload: payload ?? null,
      occurred_at: new Date(),
    } satisfies NewEngagement)
    .execute();
}
