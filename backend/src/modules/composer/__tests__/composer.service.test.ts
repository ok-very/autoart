/**
 * Composer Service Tests
 *
 * Tests for the Composer module - the Task Builder on Actions + Events.
 * Tests cover:
 * - Action creation with transaction atomicity
 * - Event emission (ACTION_DECLARED, FIELD_VALUE_RECORDED)
 * - ActionReference creation
 * - Guardrails (rejecting legacy task types)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import type { Event } from '@autoart/shared';

import { db } from '../../../db/client.js';
import {
    cleanupTestData,
    generateTestPrefix,
    createTestProject,
    createTestRecord,
} from '../../../test/setup.js';
import * as composerService from '../composer.service.js';

describe('composer.service', () => {
    let testPrefix: string;

    beforeAll(async () => {
        // Verify database connection
        await db.selectFrom('actions').select('id').limit(1).execute();
    });

    beforeEach(() => {
        testPrefix = generateTestPrefix();
    });

    afterEach(async () => {
        if (testPrefix) {
            await cleanupTestData(db, testPrefix);
        }
    });

    afterAll(async () => {
        await cleanupTestData(db, '__test_');
    });

    describe('compose', () => {
        it('should create an action with events atomically', async () => {
            // Arrange: Create a subprocess context
            const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

            // Act: Compose a task
            const result = await composerService.compose(
                {
                    action: {
                        contextId: fixtures.subprocessId!,
                        contextType: 'subprocess',
                        type: 'TASK',
                        fieldBindings: [
                            { fieldKey: 'title' },
                            { fieldKey: 'description' },
                        ],
                    },
                    fieldValues: [
                        { fieldName: 'title', value: 'Test Task' },
                        { fieldName: 'description', value: 'Test Description' },
                    ],
                },
                { actorId: null, skipView: true }
            );

            // Assert: Action was created
            expect(result.action).toBeDefined();
            expect(result.action.type).toBe('TASK');
            expect(result.action.contextId).toBe(fixtures.subprocessId);

            // Assert: Events were created
            expect(result.events.length).toBe(3); // ACTION_DECLARED + 2 FIELD_VALUE_RECORDED
            const eventTypes = result.events.map((e: Event) => e.type);
            expect(eventTypes).toContain('ACTION_DECLARED');
            expect(eventTypes.filter((t: string) => t === 'FIELD_VALUE_RECORDED').length).toBe(2);

            // Verify events are in the database
            const dbEvents = await db
                .selectFrom('events')
                .selectAll()
                .where('action_id', '=', result.action.id)
                .execute();
            expect(dbEvents.length).toBe(3);
        });

        it('should create action references when provided', async () => {
            // Arrange
            const fixtures = await createTestProject(db, testPrefix, { withChildren: true });
            const { recordId } = await createTestRecord(db, testPrefix);

            // Act: Compose with a reference
            const result = await composerService.compose(
                {
                    action: {
                        contextId: fixtures.subprocessId!,
                        contextType: 'subprocess',
                        type: 'BUG',
                        fieldBindings: [{ fieldKey: 'title' }],
                    },
                    fieldValues: [
                        { fieldName: 'title', value: 'Test Bug' },
                    ],
                    references: [
                        { sourceRecordId: recordId, mode: 'dynamic' },
                    ],
                },
                { actorId: null, skipView: true }
            );

            // Assert: Reference was created
            expect(result.references).toBeDefined();
            expect(result.references!.length).toBe(1);
            expect(result.references![0].sourceRecordId).toBe(recordId);
            expect(result.references![0].actionId).toBe(result.action.id);

            // Verify in database
            const dbRefs = await db
                .selectFrom('action_references')
                .selectAll()
                .where('action_id', '=', result.action.id)
                .execute();
            expect(dbRefs.length).toBe(1);
        });

        it('should reject legacy task types', async () => {
            // Arrange
            const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

            // Act & Assert: Should throw for legacy_task
            await expect(
                composerService.compose(
                    {
                        action: {
                            contextId: fixtures.subprocessId!,
                            contextType: 'subprocess',
                            type: 'legacy_task',
                            fieldBindings: [],
                        },
                    },
                    { actorId: null }
                )
            ).rejects.toThrow('Legacy task creation is not allowed');

            // Act & Assert: Should throw for LEGACY_TASK
            await expect(
                composerService.compose(
                    {
                        action: {
                            contextId: fixtures.subprocessId!,
                            contextType: 'subprocess',
                            type: 'LEGACY_TASK',
                            fieldBindings: [],
                        },
                    },
                    { actorId: null }
                )
            ).rejects.toThrow('Legacy task creation is not allowed');
        });

        it('should emit extra events when provided', async () => {
            // Arrange
            const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

            // Act: Compose with extra events
            const result = await composerService.compose(
                {
                    action: {
                        contextId: fixtures.subprocessId!,
                        contextType: 'subprocess',
                        type: 'TASK',
                        fieldBindings: [{ fieldKey: 'title' }],
                    },
                    fieldValues: [
                        { fieldName: 'title', value: 'Task with extra events' },
                    ],
                    emitExtraEvents: [
                        { type: 'WORK_STARTED', payload: {} },
                    ],
                },
                { actorId: null, skipView: true }
            );

            // Assert: All events were created
            expect(result.events.length).toBe(3); // ACTION_DECLARED + FIELD_VALUE_RECORDED + WORK_STARTED
            const eventTypes = result.events.map((e: Event) => e.type);
            expect(eventTypes).toContain('ACTION_DECLARED');
            expect(eventTypes).toContain('FIELD_VALUE_RECORDED');
            expect(eventTypes).toContain('WORK_STARTED');
        });
    });

});
