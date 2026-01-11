/**
 * Composer API Hooks
 *
 * Hooks for the Composer module - the Task Builder on top of Actions + Events.
 * These hooks replace legacy task creation while maintaining a clean React Query interface.
 *
 * The Composer:
 * 1. Creates an Action (intent declaration)
 * 2. Emits Events (ACTION_DECLARED, FIELD_VALUE_RECORDED, etc.)
 * 3. Creates ActionReferences (links to records)
 * 4. Returns a View (computed by interpreter)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
    ComposerInput,
    ComposerResponse,
    ContextType,
} from '@autoart/shared';

// ============================================================================
// FULL COMPOSER
// ============================================================================

/**
 * Create a new work item via the full Composer API.
 *
 * This is the main entry point for creating any "task-like" entity
 * via the Action + Event model.
 *
 * @example
 * ```tsx
 * const compose = useCompose();
 *
 * compose.mutate({
 *   action: {
 *     contextId: subprocessId,
 *     contextType: 'subprocess',
 *     type: 'TASK',
 *     fieldBindings: [
 *       { fieldKey: 'title' },
 *       { fieldKey: 'description' },
 *     ],
 *   },
 *   fieldValues: [
 *     { fieldName: 'title', value: 'My new task' },
 *     { fieldName: 'description', value: 'Task description' },
 *   ],
 *   references: [
 *     { sourceRecordId: projectRecordId },
 *   ],
 * });
 * ```
 */
export function useCompose() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ComposerInput) =>
            api.post<ComposerResponse>('/composer', data),
        onSuccess: (result) => {
            // Invalidate action views for the context
            queryClient.invalidateQueries({
                queryKey: ['actionViews', result.action.contextId],
            });
            // Invalidate actions list
            queryClient.invalidateQueries({
                queryKey: ['actions', result.action.contextId, result.action.contextType],
            });
            // Invalidate actions by type (for registry view)
            queryClient.invalidateQueries({
                queryKey: ['actions', 'byType', result.action.type],
            });
            // Invalidate all actions queries (broad invalidation)
            queryClient.invalidateQueries({
                queryKey: ['actions'],
                exact: false,
            });
            // Invalidate events for the context
            queryClient.invalidateQueries({
                queryKey: ['events', 'context', result.action.contextId],
            });
        },
    });
}

// ============================================================================
// QUICK COMPOSE HELPERS
// ============================================================================

interface QuickTaskInput {
    contextId: string;
    title: string;
    description?: string;
    dueDate?: string;
    references?: Array<{ sourceRecordId: string }>;
}

interface QuickBugInput {
    contextId: string;
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description?: string;
    references?: Array<{ sourceRecordId: string }>;
}

/**
 * Quick task creation - convenience hook for simple tasks.
 *
 * @example
 * ```tsx
 * const createTask = useQuickTask();
 *
 * createTask.mutate({
 *   contextId: subprocessId,
 *   title: 'My new task',
 *   description: 'Optional description',
 *   dueDate: '2026-02-01',
 * });
 * ```
 */
export function useQuickTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: QuickTaskInput) =>
            api.post<ComposerResponse>('/composer/quick/task', data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: ['actionViews', result.action.contextId],
            });
            queryClient.invalidateQueries({
                queryKey: ['actions', result.action.contextId, result.action.contextType],
            });
        },
    });
}

/**
 * Quick bug creation - convenience hook for bugs.
 *
 * @example
 * ```tsx
 * const createBug = useQuickBug();
 *
 * createBug.mutate({
 *   contextId: subprocessId,
 *   title: 'Crash on settings page',
 *   severity: 'HIGH',
 *   description: 'Steps to reproduce...',
 * });
 * ```
 */
export function useQuickBug() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: QuickBugInput) =>
            api.post<ComposerResponse>('/composer/quick/bug', data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: ['actionViews', result.action.contextId],
            });
            queryClient.invalidateQueries({
                queryKey: ['actions', result.action.contextId, result.action.contextType],
            });
        },
    });
}

// ============================================================================
// FACTORY HELPERS
// ============================================================================

/**
 * Build a ComposerInput for a standard task.
 * Useful for programmatic composition.
 */
export function buildTaskInput(
    contextId: string,
    contextType: ContextType,
    title: string,
    options: {
        description?: string;
        dueDate?: string;
        references?: Array<{ sourceRecordId: string }>;
    } = {}
): ComposerInput {
    const fieldValues: Array<{ fieldName: string; value: unknown }> = [
        { fieldName: 'title', value: title },
    ];

    if (options.description) {
        fieldValues.push({ fieldName: 'description', value: options.description });
    }
    if (options.dueDate) {
        fieldValues.push({ fieldName: 'dueDate', value: options.dueDate });
    }

    return {
        action: {
            contextId,
            contextType,
            type: 'TASK',
            fieldBindings: [
                { fieldKey: 'title' },
                { fieldKey: 'description' },
                { fieldKey: 'dueDate' },
            ],
        },
        fieldValues,
        references: options.references?.map((r) => ({
            sourceRecordId: r.sourceRecordId,
            mode: 'dynamic' as const,
        })),
    };
}

/**
 * Build a ComposerInput for a bug.
 * Useful for programmatic composition.
 */
export function buildBugInput(
    contextId: string,
    contextType: ContextType,
    title: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    options: {
        description?: string;
        references?: Array<{ sourceRecordId: string }>;
    } = {}
): ComposerInput {
    const fieldValues: Array<{ fieldName: string; value: unknown }> = [
        { fieldName: 'title', value: title },
        { fieldName: 'severity', value: severity },
    ];

    if (options.description) {
        fieldValues.push({ fieldName: 'description', value: options.description });
    }

    return {
        action: {
            contextId,
            contextType,
            type: 'BUG',
            fieldBindings: [
                { fieldKey: 'title' },
                { fieldKey: 'description' },
                { fieldKey: 'severity' },
            ],
        },
        fieldValues,
        references: options.references?.map((r) => ({
            sourceRecordId: r.sourceRecordId,
            mode: 'dynamic' as const,
        })),
    };
}
