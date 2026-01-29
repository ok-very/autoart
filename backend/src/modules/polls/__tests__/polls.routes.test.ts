/**
 * Polls Routes Integration Tests
 *
 * Tests for poll API endpoints:
 * - GET /api/polls/:id/engagements — owner-only engagement summary
 * - Auth bypass prevention with null created_by
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { db } from '../../../db/client.js';
import { generateTestPrefix } from '../../../test/setup.js';
import { buildApp } from '../../../app.js';
import type { FastifyInstance } from 'fastify';

describe('polls.routes', () => {
  const testPrefix = generateTestPrefix();
  let app: FastifyInstance;
  const createdPollIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    // Clean up
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
    await app.close();
  });

  describe('GET /api/polls/:id/engagements', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/polls/00000000-0000-0000-0000-000000000000/engagements',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent poll', async () => {
      // Create a fake JWT to pass auth
      const token = app.jwt.sign({ userId: 'test-user', email: 'test@test.com' });
      const response = await app.inject({
        method: 'GET',
        url: '/api/polls/00000000-0000-0000-0000-000000000000/engagements',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      // Create poll owned by a specific user
      const ownerId = `${testPrefix}-owner`;
      const poll = await db
        .insertInto('polls')
        .values({
          unique_id: `${testPrefix}-eng-test`,
          title: `${testPrefix} Eng Test`,
          time_config: {
            dates: ['2026-03-01'],
            start_hour: 9,
            end_hour: 17,
            granularity: '30min',
            timezone: 'America/Vancouver',
          },
          created_by: ownerId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      createdPollIds.push(poll.id);

      // Request as different user
      const token = app.jwt.sign({ userId: 'different-user', email: 'other@test.com' });
      const response = await app.inject({
        method: 'GET',
        url: `/api/polls/${poll.id}/engagements`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should return 200 with summary for owner', async () => {
      const ownerId = `${testPrefix}-owner2`;
      const poll = await db
        .insertInto('polls')
        .values({
          unique_id: `${testPrefix}-eng-test2`,
          title: `${testPrefix} Eng Test 2`,
          time_config: {
            dates: ['2026-03-01'],
            start_hour: 9,
            end_hour: 17,
            granularity: '30min',
            timezone: 'America/Vancouver',
          },
          created_by: ownerId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      createdPollIds.push(poll.id);

      const token = app.jwt.sign({ userId: ownerId, email: 'owner@test.com' });
      const response = await app.inject({
        method: 'GET',
        url: `/api/polls/${poll.id}/engagements`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.summary).toEqual({
        total_opened: 0,
        total_interacted: 0,
        total_deferred: 0,
        unique_actors: 0,
      });
    });

    it('should deny access when created_by is null', async () => {
      // Poll with no owner
      const poll = await db
        .insertInto('polls')
        .values({
          unique_id: `${testPrefix}-null-owner`,
          title: `${testPrefix} Null Owner`,
          time_config: {
            dates: ['2026-03-01'],
            start_hour: 9,
            end_hour: 17,
            granularity: '30min',
            timezone: 'America/Vancouver',
          },
          created_by: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      createdPollIds.push(poll.id);

      const token = app.jwt.sign({ userId: 'any-user', email: 'any@test.com' });
      const response = await app.inject({
        method: 'GET',
        url: `/api/polls/${poll.id}/engagements`,
        headers: { authorization: `Bearer ${token}` },
      });
      // After fix 2b, null created_by !== any userId → 403
      expect(response.statusCode).toBe(403);
    });
  });
});
