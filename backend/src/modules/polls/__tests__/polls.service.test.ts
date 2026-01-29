/**
 * Polls Service Tests
 *
 * Integration tests for poll-related service operations:
 * - createPoll: Poll creation with description
 * - getEngagementSummary: Aggregated engagement counts
 * - listPolls: Scoped to user
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { db } from '../../../db/client.js';
import { generateTestPrefix } from '../../../test/setup.js';
import * as pollsService from '../polls.service.js';

describe('polls.service', () => {
  const testPrefix = generateTestPrefix();
  const createdPollIds: string[] = [];

  afterAll(async () => {
    // Clean up test data
    for (const id of createdPollIds) {
      try {
        await db.deleteFrom('engagements')
          .where('context_id', 'in',
            db.selectFrom('polls').select('unique_id').where('id', '=', id)
          )
          .execute();
        await db.deleteFrom('poll_responses').where('poll_id', '=', id).execute();
        await db.deleteFrom('polls').where('id', '=', id).execute();
      } catch {
        // ignore cleanup errors
      }
    }
  });

  describe('createPoll', () => {
    it('should create a poll with title and description', async () => {
      const poll = await pollsService.createPoll(
        `${testPrefix} Test Poll`,
        'A test poll description',
        {
          dates: ['2026-03-01'],
          start_hour: 9,
          end_hour: 17,
          granularity: '30min',
          timezone: 'America/Vancouver',
        },
      );

      createdPollIds.push(poll.id);

      expect(poll.title).toBe(`${testPrefix} Test Poll`);
      expect(poll.description).toBe('A test poll description');
      expect(poll.status).toBe('active');
      expect(poll.unique_id).toBeDefined();
    });

    it('should create a poll with null description when undefined', async () => {
      const poll = await pollsService.createPoll(
        `${testPrefix} No Desc Poll`,
        undefined,
        {
          dates: ['2026-03-01'],
          start_hour: 9,
          end_hour: 17,
          granularity: '30min',
          timezone: 'America/Vancouver',
        },
      );

      createdPollIds.push(poll.id);

      expect(poll.description).toBeNull();
    });

    it('should reject invalid time_config', async () => {
      await expect(
        pollsService.createPoll(
          `${testPrefix} Bad Config`,
          undefined,
          { invalid: true },
        ),
      ).rejects.toThrow('Invalid time_config');
    });
  });

  describe('getEngagementSummary', () => {
    it('should return zeros for non-existent context', async () => {
      const summary = await pollsService.getEngagementSummary('poll', 'non-existent-id');
      expect(summary).toEqual({
        total_opened: 0,
        total_interacted: 0,
        total_deferred: 0,
        unique_actors: 0,
      });
    });

    it('should count engagements by kind', async () => {
      // Create a poll to get a valid context_id
      const poll = await pollsService.createPoll(
        `${testPrefix} Engagement Poll`,
        undefined,
        {
          dates: ['2026-03-01'],
          start_hour: 9,
          end_hour: 17,
          granularity: '30min',
          timezone: 'America/Vancouver',
        },
      );
      createdPollIds.push(poll.id);

      // Log some engagements
      await pollsService.logEngagement('poll', poll.unique_id, 'OPENED', 'Alice');
      await pollsService.logEngagement('poll', poll.unique_id, 'OPENED', 'Bob');
      await pollsService.logEngagement('poll', poll.unique_id, 'INTERACTED', 'Alice');
      await pollsService.logEngagement('poll', poll.unique_id, 'DEFERRED', 'Charlie');

      const summary = await pollsService.getEngagementSummary('poll', poll.unique_id);

      expect(summary.total_opened).toBe(2);
      expect(summary.total_interacted).toBe(1);
      expect(summary.total_deferred).toBe(1);
      expect(summary.unique_actors).toBe(3);
    });
  });

  describe('listPolls', () => {
    it('should return only polls for the specified user', async () => {
      const userId = `${testPrefix}-user-id`;

      const poll = await pollsService.createPoll(
        `${testPrefix} User Poll`,
        undefined,
        {
          dates: ['2026-03-01'],
          start_hour: 9,
          end_hour: 17,
          granularity: '30min',
          timezone: 'America/Vancouver',
        },
        undefined,
        userId,
      );
      createdPollIds.push(poll.id);

      const polls = await pollsService.listPolls(userId);
      expect(polls.length).toBeGreaterThanOrEqual(1);
      expect(polls.every((p) => p.created_by === userId)).toBe(true);
    });

    it('should return empty for unknown user', async () => {
      const polls = await pollsService.listPolls('non-existent-user-id');
      expect(polls).toEqual([]);
    });
  });
});
