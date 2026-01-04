/**
 * Event Factory
 *
 * Small utility that builds well-typed Event objects.
 * All events must contain the actionId of the Action they belong to.
 */

import type { ContextType } from '@autoart/shared';

interface EventData {
    contextId: string;
    contextType: ContextType;
    actionId: string;
    type: string;
    payload: Record<string, unknown>;
    actorId: string | null;
}

/**
 * Factory for creating well-typed events
 */
export const EventFactory = {
    /**
     * ACTION_DECLARED - anchors the entire action chain
     */
    actionDeclared(
        contextId: string,
        contextType: ContextType,
        actionId: string,
        payload: { type: string; fieldBindings?: unknown },
        actorId: string | null = null
    ): EventData {
        return {
            contextId,
            contextType,
            actionId,
            type: 'ACTION_DECLARED',
            payload: {
                actionType: payload.type,
                fieldBindings: payload.fieldBindings,
                migrated: false,
            },
            actorId,
        };
    },

    /**
     * FIELD_VALUE_RECORDED - a field value was captured
     */
    fieldValueRecorded(
        contextId: string,
        contextType: ContextType,
        actionId: string,
        payload: { fieldName: string; value: unknown },
        actorId: string | null = null
    ): EventData {
        return {
            contextId,
            contextType,
            actionId,
            type: 'FIELD_VALUE_RECORDED',
            payload: {
                fieldKey: payload.fieldName,
                value: payload.value,
            },
            actorId,
        };
    },

    /**
     * ASSIGNMENT_OCCURRED - someone was assigned
     */
    assigneeSet(
        contextId: string,
        contextType: ContextType,
        actionId: string,
        payload: { assigneeId: string },
        actorId: string | null = null
    ): EventData {
        return {
            contextId,
            contextType,
            actionId,
            type: 'ASSIGNMENT_OCCURRED',
            payload: {
                assigneeId: payload.assigneeId,
            },
            actorId,
        };
    },

    /**
     * WORK_STARTED - work began on an action
     */
    workStarted(
        contextId: string,
        contextType: ContextType,
        actionId: string,
        actorId: string | null = null
    ): EventData {
        return {
            contextId,
            contextType,
            actionId,
            type: 'WORK_STARTED',
            payload: {},
            actorId,
        };
    },

    /**
     * WORK_FINISHED - work was completed
     */
    workFinished(
        contextId: string,
        contextType: ContextType,
        actionId: string,
        actorId: string | null = null
    ): EventData {
        return {
            contextId,
            contextType,
            actionId,
            type: 'WORK_FINISHED',
            payload: {},
            actorId,
        };
    },

    /**
     * Generic event factory for extra events
     */
    generic(
        contextId: string,
        contextType: ContextType,
        actionId: string,
        type: string,
        payload: Record<string, unknown> = {},
        actorId: string | null = null
    ): EventData {
        return {
            contextId,
            contextType,
            actionId,
            type,
            payload,
            actorId,
        };
    },
};
