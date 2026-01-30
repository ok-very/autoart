/**
 * Action Types Service Tests
 *
 * Tests CRUD operations for action type definitions.
 */

import { describe, it, expect, afterAll } from 'vitest';

import { db } from '@db/client.js';

import * as actionTypesService from '../action-types.service.js';

describe('Action Types Service', () => {
    const testType = 'TEST_ACTION';

    afterAll(async () => {
        // Cleanup: remove test action types
        await db
            .deleteFrom('action_type_definitions')
            .where('type', '=', testType)
            .execute();
    });

    describe('getActionTypeDefinitions', () => {
        it('should return all action type definitions', async () => {
            const definitions = await actionTypesService.getActionTypeDefinitions();

            expect(Array.isArray(definitions)).toBe(true);
            // Should have at least the system types
            expect(definitions.length).toBeGreaterThanOrEqual(3);

            // Check for system types
            const types = definitions.map((d) => d.type);
            expect(types).toContain('TASK');
            expect(types).toContain('BUG');
            expect(types).toContain('STORY');
        });

        it('should return system types first', async () => {
            const definitions = await actionTypesService.getActionTypeDefinitions();
            const systemDefs = definitions.filter((d) => d.is_system);

            expect(systemDefs.length).toBe(3);
            expect(definitions[0].is_system).toBe(true);
        });
    });

    describe('getActionTypeDefinition', () => {
        it('should return a single action type by type', async () => {
            const definition = await actionTypesService.getActionTypeDefinition('TASK');

            expect(definition).toBeDefined();
            expect(definition?.type).toBe('TASK');
            expect(definition?.label).toBe('Task');
            expect(definition?.is_system).toBe(true);
        });

        it('should return undefined for non-existent type', async () => {
            const definition = await actionTypesService.getActionTypeDefinition('NONEXISTENT');

            expect(definition).toBeUndefined();
        });
    });

    describe('createActionTypeDefinition', () => {
        it('should create a new action type', async () => {
            const input = {
                type: testType,
                label: 'Test Action',
                description: 'A test action type',
                fieldBindings: [
                    { fieldKey: 'title', fieldType: 'string' as const, required: true },
                ],
            };

            const definition = await actionTypesService.createActionTypeDefinition(input);

            expect(definition).toBeDefined();
            expect(definition.type).toBe(testType);
            expect(definition.label).toBe('Test Action');
            expect(definition.is_system).toBe(false);
        });

        it('should reject duplicate types', async () => {
            const input = {
                type: 'TASK', // Already exists
                label: 'Duplicate Task',
            };

            await expect(
                actionTypesService.createActionTypeDefinition(input)
            ).rejects.toThrow('Action type already exists');
        });

        it('should reject invalid type format', async () => {
            const input = {
                type: 'invalid-format', // Not UPPER_SNAKE_CASE
                label: 'Invalid Format',
            };

            await expect(
                actionTypesService.createActionTypeDefinition(input)
            ).rejects.toThrow('UPPER_SNAKE_CASE');
        });
    });

    describe('updateActionTypeDefinition', () => {
        it('should update an action type', async () => {
            // First ensure the test type exists
            try {
                await actionTypesService.createActionTypeDefinition({
                    type: testType,
                    label: 'Test Action',
                });
            } catch {
                // Already exists, that's fine
            }

            const input = {
                label: 'Updated Test Action',
                description: 'Updated description',
            };

            const definition = await actionTypesService.updateActionTypeDefinition(testType, input);

            expect(definition.label).toBe('Updated Test Action');
            expect(definition.description).toBe('Updated description');
        });

        it('should throw for non-existent type', async () => {
            await expect(
                actionTypesService.updateActionTypeDefinition('NONEXISTENT', { label: 'New' })
            ).rejects.toThrow('not found');
        });
    });

    describe('deleteActionTypeDefinition', () => {
        it('should delete a custom action type', async () => {
            const uniqueType = `TEST_DELETE_${Date.now()}`;

            // Create a type to delete
            await actionTypesService.createActionTypeDefinition({
                type: uniqueType,
                label: 'To Delete',
            });

            // Delete it
            await actionTypesService.deleteActionTypeDefinition(uniqueType);

            // Verify it's gone
            const definition = await actionTypesService.getActionTypeDefinition(uniqueType);
            expect(definition).toBeUndefined();
        });

        it('should reject deletion of system types', async () => {
            await expect(
                actionTypesService.deleteActionTypeDefinition('TASK')
            ).rejects.toThrow('Cannot delete system action type');
        });

        it('should throw for non-existent type', async () => {
            await expect(
                actionTypesService.deleteActionTypeDefinition('NONEXISTENT')
            ).rejects.toThrow('not found');
        });
    });

    describe('getActionTypeStats', () => {
        it('should return stats for all action types', async () => {
            const stats = await actionTypesService.getActionTypeStats();

            expect(Array.isArray(stats)).toBe(true);
            stats.forEach((stat) => {
                expect(stat).toHaveProperty('type');
                expect(stat).toHaveProperty('count');
                expect(typeof stat.count).toBe('number');
            });
        });
    });
});
