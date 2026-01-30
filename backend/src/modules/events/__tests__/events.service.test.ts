/**
 * Events Service Tests
 *
 * Tests for the Events module - the immutable fact log.
 * Tests cover:
 * - Event emission (append-only)
 * - Event querying by context, action, type
 * - Paginated queries for Project Log
 * - System event filtering
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { db } from '@db/client.js';

import {
  cleanupTestData,
  generateTestPrefix,
  createTestProject,
} from '@/test/setup.js';

import * as eventsService from '../events.service.js';

describe('events.service', () => {
  let testPrefix: string;

  beforeAll(async () => {
    await db.selectFrom('events').select('id').limit(1).execute();
  });

  afterEach(async () => {
    if (testPrefix) {
      await cleanupTestData(db, testPrefix);
    }
  });

  describe('emitEvent', () => {
    it('should create an event with correct fields', async () => {
      testPrefix = generateTestPrefix();
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      const event = await eventsService.emitEvent({
        contextId: fixtures.subprocessId!,
        contextType: 'subprocess',
        type: 'WORK_STARTED',
        payload: { reason: 'test' },
      });

      expect(event.id).toBeDefined();
      expect(event.context_id).toBe(fixtures.subprocessId);
      expect(event.context_type).toBe('subprocess');
      expect(event.type).toBe('WORK_STARTED');
      expect(event.payload).toEqual({ reason: 'test' });
      expect(event.occurred_at).toBeDefined();
    });

    it('should reject stage context type', async () => {
      testPrefix = generateTestPrefix();
      const fixtures = await createTestProject(db, testPrefix);

      await expect(
        eventsService.emitEvent({
          contextId: fixtures.projectId,
          contextType: 'stage' as 'subprocess',
          type: 'TEST_EVENT',
        })
      ).rejects.toThrow('Stage context is deprecated');
    });
  });

  describe('getEventsByAction', () => {
    it('should return events in chronological order', async () => {
      testPrefix = generateTestPrefix();
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      const action = await db
        .insertInto('actions')
        .values({
          context_id: fixtures.subprocessId!,
          context_type: 'subprocess',
          type: 'TASK',
          field_bindings: '[]',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const event1 = await eventsService.emitEvent({
        contextId: fixtures.subprocessId!,
        contextType: 'subprocess',
        actionId: action.id,
        type: 'ACTION_DECLARED',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = await eventsService.emitEvent({
        contextId: fixtures.subprocessId!,
        contextType: 'subprocess',
        actionId: action.id,
        type: 'WORK_STARTED',
      });

      const events = await eventsService.getEventsByAction(action.id);

      expect(events.length).toBe(2);
      expect(events[0].id).toBe(event1.id);
      expect(events[1].id).toBe(event2.id);
    });
  });

  describe('getLatestWorkEvent', () => {
    it('should return the most recent work event', async () => {
      testPrefix = generateTestPrefix();
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      const action = await db
        .insertInto('actions')
        .values({
          context_id: fixtures.subprocessId!,
          context_type: 'subprocess',
          type: 'TASK',
          field_bindings: '[]',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await eventsService.emitEvent({
        contextId: fixtures.subprocessId!,
        contextType: 'subprocess',
        actionId: action.id,
        type: 'WORK_STARTED',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const finishedEvent = await eventsService.emitEvent({
        contextId: fixtures.subprocessId!,
        contextType: 'subprocess',
        actionId: action.id,
        type: 'WORK_FINISHED',
      });

      const latestWork = await eventsService.getLatestWorkEvent(action.id);

      expect(latestWork).toBeDefined();
      expect(latestWork!.id).toBe(finishedEvent.id);
      expect(latestWork!.type).toBe('WORK_FINISHED');
    });
  });

  describe('hasFinishedEvent', () => {
    it('should return true when WORK_FINISHED exists', async () => {
      testPrefix = generateTestPrefix();
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      const action = await db
        .insertInto('actions')
        .values({
          context_id: fixtures.subprocessId!,
          context_type: 'subprocess',
          type: 'TASK',
          field_bindings: '[]',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      expect(await eventsService.hasFinishedEvent(action.id)).toBe(false);

      await eventsService.emitEvent({
        contextId: fixtures.subprocessId!,
        contextType: 'subprocess',
        actionId: action.id,
        type: 'WORK_FINISHED',
      });

      expect(await eventsService.hasFinishedEvent(action.id)).toBe(true);
    });
  });

  describe('getEventsByContextPaginated', () => {
    it('should return paginated events in reverse chronological order', async () => {
      testPrefix = generateTestPrefix();
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      for (let i = 0; i < 5; i++) {
        await eventsService.emitEvent({
          contextId: fixtures.subprocessId!,
          contextType: 'subprocess',
          type: 'FIELD_VALUE_RECORDED',
          payload: { index: i },
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const page = await eventsService.getEventsByContextPaginated({
        contextId: fixtures.subprocessId!,
        contextType: 'subprocess',
        limit: 3,
        offset: 0,
      });

      expect(page.events.length).toBe(3);
      expect(page.total).toBe(5);
      expect(page.hasMore).toBe(true);
      expect((page.events[0].payload as { index: number }).index).toBe(4);
    });
  });

  describe('countEventsByContext', () => {
    it('should count events correctly', async () => {
      testPrefix = generateTestPrefix();
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      for (let i = 0; i < 3; i++) {
        await eventsService.emitEvent({
          contextId: fixtures.subprocessId!,
          contextType: 'subprocess',
          type: 'TEST_EVENT',
          payload: { index: i },
        });
      }

      const count = await eventsService.countEventsByContext(
        fixtures.subprocessId!,
        'subprocess'
      );

      expect(count).toBe(3);
    });
  });
});
