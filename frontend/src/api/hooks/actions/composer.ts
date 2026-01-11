/**
 * Composer API Hooks
 *
 * Hooks for the Composer module - the Task Builder on top of Actions + Events.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import { queryKeys } from '../queryKeys';
import type {
    ComposerInput,
    ComposerResponse,
    ContextType,
} from '@autoart/shared';

// ============================================================================
// FULL COMPOSER
// ============================================================================

export function useCompose() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ComposerInput) =>
            api.post<ComposerResponse>('/composer', data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionViews.byContext(result.action.contextId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.byContext(result.action.contextId, result.action.contextType),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.byType(result.action.type),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.all(),
                exact: false,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.events.byContext(result.action.contextId, result.action.contextType),
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

export function useQuickTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: QuickTaskInput) =>
            api.post<ComposerResponse>('/composer/quick/task', data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionViews.byContext(result.action.contextId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.byContext(result.action.contextId, result.action.contextType),
            });
        },
    });
}

export function useQuickBug() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: QuickBugInput) =>
            api.post<ComposerResponse>('/composer/quick/bug', data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionViews.byContext(result.action.contextId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.byContext(result.action.contextId, result.action.contextType),
            });
        },
    });
}

// ============================================================================
// FACTORY HELPERS
// ============================================================================

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
