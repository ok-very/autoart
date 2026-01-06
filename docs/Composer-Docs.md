Composer Module Implementation
Date: 2026-01-03
Status: ✓ Core Implementation Complete

Composer Module - Complete Implementation
Date: 2026-01-03
Status: ✅ COMPLETE

Summary
Implemented the Composer module - a first-class backend module for creating "task-like" work items on top of the Action + Event architecture. This replaces legacy task creation while maintaining a clean, validated API.

Successfully implemented the Composer module - a first-class Task Builder on top of the Action + Event architecture. The Composer replaces legacy task creation while maintaining clean APIs for both backend and frontend.

What the Composer Does
ComposerInput
Composer Service
Create Action
Emit Events
Create References
ComposerResponse
ActionView
Creates an Action (intent declaration)
Emits Events (ACTION_DECLARED, FIELD_VALUE_RECORDED, etc.)
Creates ActionReferences (links to records)
Returns a View (computed by interpreter)
Architecture
Backend
Frontend
React Component
useCompose / useQuickTask
POST /api/composer
ComposerService.compose
Create Action
EventFactory
Emit Events
Create ActionReferences
Interpreter
Return ActionView
Files Created
Files Created/Modified
Shared Package
composer.ts
Zod schemas for the Composer API:

ComposerInputSchema - request payload
ComposerResponseSchema - response with action, events, view
ActionTypeConfigSchema - action type definitions
KNOWN_ACTION_TYPES - registry of TASK, BUG, STORY
/**
 * Composer Schemas
 *
 * The Composer is a first-class module that lets the codebase create
 * any "task-like" work item WITHOUT ever touching the legacy task table.
 *
 * It:
 * 1. Creates an Action (the intent of the work item)
 * 2. Emits the minimal set of Events (ACTION_DECLARED, FIELD_VALUE_RECORDED, etc.)
 * 3. Creates ActionReferences that bind the action to existing records
 * 4. Returns a view (computed by the interpreter) for immediate rendering
 */
import { z } from 'zod';
import {
  ActionSchema,
  CreateActionInputSchema,
  EventSchema,
  CreateEventInputSchema,
  ActionViewSchema,
} from './actions';
import {
  ActionReferenceSchema,
  CreateActionReferenceInputSchema,
} from './references';
// ============================================================================
// COMPOSER FIELD VALUE
// ============================================================================
/**
 * Minimal "field value" payload that the Composer can turn into a
 * FIELD_VALUE_RECORDED event.
 */
export const ComposerFieldValueSchema = z.object({
  /** Name of the field as defined in the Action's fieldBindings (e.g. "title", "dueDate") */
  fieldName: z.string(),
  /** Any JSON-serializable value - validation is delegated to the Action's schema at runtime */
  value: z.unknown(),
});
export type ComposerFieldValue = z.infer<typeof ComposerFieldValueSchema>;
// ============================================================================
// COMPOSER INPUT
// ============================================================================
/**
 * Public contract for a Composer request.
 *
 * 1. `action` - the Action you want to declare (type + optional fieldBindings)
 * 2. `fieldValues` - list of initial field values that become FIELD_VALUE_RECORDED events
 * 3. `references` - optional ActionReferences to existing Records (e.g. projectId, sprintId)
 * 4. `emitExtraEvents` - advanced escape-hatch for callers that need arbitrary events
 *    (e.g. WORK_STARTED right after creation)
 */
export const ComposerInputSchema = z.object({
  /** The action to declare */
  action: CreateActionInputSchema,
  /** Initial field values - each becomes a FIELD_VALUE_RECORDED event */
  fieldValues: z.array(ComposerFieldValueSchema).optional(),
  /** Links to existing records */
  references: z.array(
    z.object({
      sourceRecordId: z.string().uuid(),
      targetFieldKey: z.string().optional(),
      mode: z.enum(['static', 'dynamic']).optional().default('dynamic'),
    })
  ).optional(),
  /** Advanced: emit additional events after ACTION_DECLARED */
  emitExtraEvents: z.array(
    z.object({
      type: z.string().max(100),
      payload: z.record(z.unknown()).optional().default({}),
    })
  ).optional(),
});
export type ComposerInput = z.infer<typeof ComposerInputSchema>;
// ============================================================================
// COMPOSER RESPONSE
// ============================================================================
/**
 * What the Composer returns - the created Action, all Events that were written,
 * and the computed ActionView (optional, filled by the service).
 */
export const ComposerResponseSchema = z.object({
  /** The created action */
  action: ActionSchema,
  /** All events that were emitted */
  events: z.array(EventSchema),
  /** Any action references that were created */
  references: z.array(ActionReferenceSchema).optional(),
  /** The computed view (optional - filled by interpreter) */
  view: ActionViewSchema.optional(),
});
export type ComposerResponse = z.infer<typeof ComposerResponseSchema>;
// ============================================================================
// COMPOSER CONFIG (Optional - for action type definitions)
// ============================================================================
/**
 * Defines an action type with its expected field bindings.
 * Used for validation and documentation.
 */
export const ActionTypeConfigSchema = z.object({
  /** The action type name (e.g., 'TASK', 'BUG', 'STORY') */
  type: z.string(),
  /** Human-readable label */
  label: z.string(),
  /** Field bindings schema */
  fieldBindings: z.record(z.enum(['string', 'text', 'date', 'number', 'boolean', 'enum', 'uuid'])),
  /** Default values for fields */
  defaults: z.record(z.unknown()).optional(),
});
export type ActionTypeConfig = z.infer<typeof ActionTypeConfigSchema>;
/**
 * Registry of known action types - can be extended by the application.
 */
export const KNOWN_ACTION_TYPES: ActionTypeConfig[] = [
  {
    type: 'TASK',
    label: 'Task',
    fieldBindings: {
      title: 'string',
      description: 'text',
      dueDate: 'date',
    },
  },
  {
    type: 'BUG',
    label: 'Bug',
    fieldBindings: {
      title: 'string',
      description: 'text',
      severity: 'enum',
    },
  },
  {
    type: 'STORY',
    label: 'Story',
    fieldBindings: {
      title: 'string',
      description: 'text',
      points: 'number',
    },
  },
];
File	Purpose
composer.ts
Zod schemas for ComposerInput, ComposerResponse
Backend Module
event-factory.ts
Utility for building well-typed events:

EventFactory.actionDeclared(contextId, contextType, actionId, payload);
EventFactory.fieldValueRecorded(contextId, contextType, actionId, payload);
EventFactory.generic(contextId, contextType, actionId, type, payload);
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
File	Purpose
event-factory.ts
Utility for building typed events
composer.service.ts
Core service with 
compose()
, QuickCompose helpers
composer.routes.ts
HTTP routes at /api/composer
app.ts
Route registration
composer.service.ts
Core service with:

compose()
 - main entry point, runs in transaction
QuickCompose.task() - convenience helper
QuickCompose.bug() - convenience helper
Guardrail - rejects legacy_task types
/**
 * Composer Service
 *
 * The Composer is the single entry point for creating "task-like" work items
 * on top of the Action + Event architecture.
 *
 * It:
 * 1. Creates an Action (the intent of the work item)
 * 2. Emits the minimal set of Events (ACTION_DECLARED, FIELD_VALUE_RECORDED, etc.)
 * 3. Creates ActionReferences that bind the action to existing records
 * 4. Returns a view (computed by the interpreter) for immediate rendering
 *
 * GUARDRAIL: Never writes to the legacy task tables.
 */
import { db } from '../../db/client.js';
import { ValidationError } from '../../utils/errors.js';
import { EventFactory } from './event-factory.js';
import * as interpreterService from '../interpreter/interpreter.service.js';
import type { ComposerInput, ComposerResponse, ContextType, Action, Event, ActionReference } from '@autoart/shared';
// Forbidden action types - these are legacy and should not be created
const LEGACY_ACTION_TYPES = ['legacy_task', 'LEGACY_TASK', 'task_node', 'TASK_NODE'];
export interface ComposeOptions {
    /** ID of the user/service performing the composition */
    actorId: string | null;
    /** Skip view computation (for performance) */
    skipView?: boolean;
}
/**
 * Main entry point - creates an Action, the associated Events, and any ActionReferences.
 *
 * All operations happen within a single database transaction for atomicity.
 */
export async function compose(
    input: ComposerInput,
    options: ComposeOptions
): Promise<ComposerResponse> {
    const { actorId, skipView = false } = options;
    // -----------------------------------------------------------------------
    // GUARDRAIL: Reject legacy task types
    // -----------------------------------------------------------------------
    if (LEGACY_ACTION_TYPES.includes(input.action.type)) {
        throw new ValidationError(
            `Legacy task creation is not allowed via Composer. ` +
            `Action type "${input.action.type}" is forbidden.`
        );
    }
    // Run everything in a transaction so we can roll back on any failure
    return await db.transaction().execute(async (trx) => {
        const contextId = input.action.contextId;
        const contextType = input.action.contextType;
        // -----------------------------------------------------------------------
        // 1. CREATE THE ACTION
        // -----------------------------------------------------------------------
        const action = await trx
            .insertInto('actions')
            .values({
                context_id: contextId,
                context_type: contextType,
                type: input.action.type,
                field_bindings: input.action.fieldBindings || [],
            })
            .returningAll()
            .executeTakeFirstOrThrow();
        // -----------------------------------------------------------------------
        // 2. BUILD AND EMIT EVENTS
        // -----------------------------------------------------------------------
        const eventsToCreate: Array<{
            context_id: string;
            context_type: ContextType;
            action_id: string;
            type: string;
            payload: Record<string, unknown>;
            actor_id: string | null;
        }> = [];
        // ACTION_DECLARED is always the first event - it anchors the entire chain
        const declaredEvent = EventFactory.actionDeclared(
            contextId,
            contextType,
            action.id,
            { type: input.action.type, fieldBindings: input.action.fieldBindings },
            actorId
        );
        eventsToCreate.push({
            context_id: declaredEvent.contextId,
            context_type: declaredEvent.contextType,
            action_id: declaredEvent.actionId,
            type: declaredEvent.type,
            payload: declaredEvent.payload,
            actor_id: declaredEvent.actorId,
        });
        // Emit FIELD_VALUE_RECORDED for each supplied field value
        if (input.fieldValues?.length) {
            for (const fv of input.fieldValues) {
                ensureFieldAllowed(input.action.fieldBindings || [], fv.fieldName);
                const fieldEvent = EventFactory.fieldValueRecorded(
                    contextId,
                    contextType,
                    action.id,
                    { fieldName: fv.fieldName, value: fv.value },
                    actorId
                );
                eventsToCreate.push({
                    context_id: fieldEvent.contextId,
                    context_type: fieldEvent.contextType,
                    action_id: fieldEvent.actionId,
                    type: fieldEvent.type,
                    payload: fieldEvent.payload,
                    actor_id: fieldEvent.actorId,
                });
            }
        }
        // Emit any extra events the caller requested
        if (input.emitExtraEvents?.length) {
            for (const extra of input.emitExtraEvents) {
                const genericEvent = EventFactory.generic(
                    contextId,
                    contextType,
                    action.id,
                    extra.type,
                    extra.payload || {},
                    actorId
                );
                eventsToCreate.push({
                    context_id: genericEvent.contextId,
                    context_type: genericEvent.contextType,
                    action_id: genericEvent.actionId,
                    type: genericEvent.type,
                    payload: genericEvent.payload,
                    actor_id: genericEvent.actorId,
                });
            }
        }
        // Bulk insert all events
        if (eventsToCreate.length > 0) {
            await trx
                .insertInto('events')
                .values(eventsToCreate)
                .execute();
        }
        // Fetch the created events for the response
        const createdEvents = await trx
            .selectFrom('events')
            .selectAll()
            .where('action_id', '=', action.id)
            .orderBy('occurred_at', 'asc')
            .execute();
        // -----------------------------------------------------------------------
        // 3. CREATE ACTION REFERENCES
        // -----------------------------------------------------------------------
        let createdReferences: ActionReference[] = [];
        if (input.references?.length) {
            const referencesToCreate = input.references.map((ref: { sourceRecordId: string; targetFieldKey?: string; mode?: 'static' | 'dynamic' }) => ({
                action_id: action.id,
                source_record_id: ref.sourceRecordId,
                target_field_key: ref.targetFieldKey || null,
                mode: ref.mode || 'dynamic',
            }));
            await trx
                .insertInto('action_references')
                .values(referencesToCreate)
                .execute();
            // Fetch the created references
            const dbRefs = await trx
                .selectFrom('action_references')
                .selectAll()
                .where('action_id', '=', action.id)
                .execute();
            createdReferences = dbRefs.map((ref) => ({
                id: ref.id,
                actionId: ref.action_id,
                sourceRecordId: ref.source_record_id,
                targetFieldKey: ref.target_field_key,
                mode: ref.mode,
                snapshotValue: ref.snapshot_value,
                createdAt: ref.created_at,
                legacyTaskReferenceId: ref.legacy_task_reference_id,
            }));
        }
        // -----------------------------------------------------------------------
        // 4. COMPUTE ACTION VIEW (optional)
        // -----------------------------------------------------------------------
        let view: ComposerResponse['view'] = undefined;
        if (!skipView) {
            try {
                // Note: This reads from the committed transaction, so the events must be visible
                view = await interpreterService.getActionViewById(action.id);
            } catch (error) {
                // Not fatal - the caller still gets the raw data
                console.warn('Composer: interpreter failed to compute view', error);
            }
        }
        // -----------------------------------------------------------------------
        // 5. RETURN THE COMPOSER RESPONSE
        // -----------------------------------------------------------------------
        const response: ComposerResponse = {
            action: {
                id: action.id,
                contextId: action.context_id,
                contextType: action.context_type,
                type: action.type,
                fieldBindings: action.field_bindings as any || [],
                createdAt: action.created_at,
            },
            events: createdEvents.map((e) => ({
                id: e.id,
                contextId: e.context_id,
                contextType: e.context_type,
                actionId: e.action_id,
                type: e.type,
                payload: e.payload as Record<string, unknown>,
                actorId: e.actor_id,
                occurredAt: e.occurred_at,
            })),
            references: createdReferences.length > 0 ? createdReferences : undefined,
            view,
        };
        return response;
    });
}
/**
 * Validate that a field name exists in the action's declared bindings.
 */
function ensureFieldAllowed(fieldBindings: unknown[], fieldName: string): void {
    // If fieldBindings is empty or undefined, allow any field (permissive mode)
    if (!fieldBindings || fieldBindings.length === 0) {
        return;
    }
    // Check if the field is declared
    const binding = fieldBindings.find((b: any) => b.fieldKey === fieldName);
    if (!binding) {
        throw new ValidationError(
            `Field "${fieldName}" is not declared in the Action's fieldBindings. ` +
            `Only declared fields can have values recorded.`
        );
    }
}
/**
 * Quick composition helpers for common action types
 */
export const QuickCompose = {
    /**
     * Create a task-like action with minimal boilerplate
     */
    async task(
        contextId: string,
        title: string,
        options: {
            description?: string;
            dueDate?: string;
            actorId?: string | null;
            references?: Array<{ sourceRecordId: string }>;
        } = {}
    ): Promise<ComposerResponse> {
        const fieldValues: Array<{ fieldName: string; value: unknown }> = [
            { fieldName: 'title', value: title },
        ];
        if (options.description) {
            fieldValues.push({ fieldName: 'description', value: options.description });
        }
        if (options.dueDate) {
            fieldValues.push({ fieldName: 'dueDate', value: options.dueDate });
        }
        return compose(
            {
                action: {
                    contextId,
                    contextType: 'subprocess',
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
                })),
            },
            { actorId: options.actorId || null }
        );
    },
    /**
     * Create a bug action
     */
    async bug(
        contextId: string,
        title: string,
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        options: {
            description?: string;
            actorId?: string | null;
            references?: Array<{ sourceRecordId: string }>;
        } = {}
    ): Promise<ComposerResponse> {
        const fieldValues: Array<{ fieldName: string; value: unknown }> = [
            { fieldName: 'title', value: title },
            { fieldName: 'severity', value: severity },
        ];
        if (options.description) {
            fieldValues.push({ fieldName: 'description', value: options.description });
        }
        return compose(
            {
                action: {
                    contextId,
                    contextType: 'subprocess',
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
                })),
            },
            { actorId: options.actorId || null }
        );
    },
};
Frontend Hooks
File	Purpose
composer.ts
React Query hooks for Composer API
index.ts
Export barrel
composer.routes.ts
HTTP endpoints:

POST /api/composer - full composer endpoint
POST /api/composer/quick/task - quick task creation
POST /api/composer/quick/bug - quick bug creation
/**
 * Composer Routes
 *
 * HTTP endpoints for the Composer module.
 * POST /composer - Create a new work item via the Action + Event model.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ComposerInputSchema, ComposerResponseSchema } from '@autoart/shared';
import * as composerService from './composer.service.js';
interface ComposerRequest {
  Body: unknown;
}
export async function composerRoutes(fastify: FastifyInstance) {
  /**
   * POST /composer
   *
   * Create a new work item (Action + Events + References).
   * This is the single entry point for creating any "task-like" entity
   * without touching the legacy task tables.
   *
   * Body: ComposerInputSchema
   * Response: ComposerResponseSchema
   */
  fastify.post<ComposerRequest>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<ComposerRequest>, reply: FastifyReply) => {
      // Parse and validate the request body
      const parseResult = ComposerInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid composer input',
          details: parseResult.error.errors,
        });
      }
      const input = parseResult.data;
      const actorId = (request.user as any)?.id || null;
      // Compose the action, events, and references
      const result = await composerService.compose(input, {
        actorId,
        skipView: false,
      });
      // Validate the response (helps catch schema drift)
      const validatedResponse = ComposerResponseSchema.parse(result);
      return reply.status(201).send(validatedResponse);
    }
  );
  /**
   * POST /composer/quick/task
   *
   * Quick endpoint for creating a simple task.
   * Convenience wrapper around the full composer.
   */
  fastify.post<{
    Body: {
      contextId: string;
      title: string;
      description?: string;
      dueDate?: string;
      references?: Array<{ sourceRecordId: string }>;
    };
  }>(
    '/quick/task',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { contextId, title, description, dueDate, references } = request.body;
      const actorId = (request.user as any)?.id || null;
      if (!contextId || !title) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'contextId and title are required',
        });
      }
      const result = await composerService.QuickCompose.task(
        contextId,
        title,
        { description, dueDate, actorId, references }
      );
      return reply.status(201).send(result);
    }
  );
  /**
   * POST /composer/quick/bug
   *
   * Quick endpoint for creating a bug.
   * Convenience wrapper around the full composer.
   */
  fastify.post<{
    Body: {
      contextId: string;
      title: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description?: string;
      references?: Array<{ sourceRecordId: string }>;
    };
  }>(
    '/quick/bug',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { contextId, title, severity, description, references } = request.body;
      const actorId = (request.user as any)?.id || null;
      if (!contextId || !title || !severity) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'contextId, title, and severity are required',
        });
      }
      const result = await composerService.QuickCompose.bug(
        contextId,
        title,
        severity,
        { description, actorId, references }
      );
      return reply.status(201).send(result);
    }
  );
  fastify.log.info('Composer routes registered');
}
API Endpoints
Method	Endpoint	Description
POST	/api/composer	Full composer with fieldBindings, references, extra events
POST	/api/composer/quick/task	Quick task creation
POST	/api/composer/quick/bug	Quick bug creation
API Usage
Full Composer Request
POST /api/composer
Content-Type: application/json
Authorization: Bearer <token>
{
  "action": {
    "contextId": "subprocess-uuid",
    "contextType": "subprocess",
    "type": "TASK",
    "fieldBindings": [
      { "fieldKey": "title" },
      { "fieldKey": "description" },
      { "fieldKey": "dueDate" }
    ]
  },
  "fieldValues": [
    { "fieldName": "title", "value": "Write Composer docs" },
    { "fieldName": "description", "value": "Add API reference" }
  ],
  "references": [
    { "sourceRecordId": "project-uuid" }
  ],
  "emitExtraEvents": [
    { "type": "ASSIGNEE_SET", "payload": { "assigneeId": "user-uuid" } }
  ]
}
Quick Task Request
POST /api/composer/quick/task
Content-Type: application/json
Authorization: Bearer <token>
{
  "contextId": "subprocess-uuid",
  "title": "Fix the bug",
  "description": "See issue #123",
  "dueDate": "2026-02-01"
}
Frontend Usage
Full Composer
import { useCompose } from '@/api/hooks';
function CreateWorkItem() {
  const compose = useCompose();
  const handleCreate = () => {
    compose.mutate({
      action: {
        contextId: subprocessId,
        contextType: 'subprocess',
        type: 'TASK',
        fieldBindings: [
          { fieldKey: 'title' },
          { fieldKey: 'description' },
        ],
      },
      fieldValues: [
        { fieldName: 'title', value: 'My new task' },
        { fieldName: 'description', value: 'Task description' },
      ],
      references: [
        { sourceRecordId: projectRecordId, mode: 'dynamic' },
      ],
    });
  };
  return <button onClick={handleCreate}>Create Task</button>;
}
Quick Task
import { useQuickTask } from '@/api/hooks';
function QuickTaskButton({ subprocessId }) {
  const createTask = useQuickTask();
  return (
    <button
      onClick={() =>
        createTask.mutate({
          contextId: subprocessId,
          title: 'Quick task',
          description: 'Optional description',
          dueDate: '2026-02-01',
        })
      }
    >
      Add Task
    </button>
  );
}
Factory Helpers
import { useCompose, buildTaskInput } from '@/api/hooks';
function ProgrammaticCreate() {
  const compose = useCompose();
  // Build input programmatically
  const input = buildTaskInput(
    subprocessId,
    'subprocess',
    'Programmatic task',
    { description: 'Created with helper', dueDate: '2026-03-01' }
  );
  compose.mutate(input);
}
Guardrails
Layer	Guard
Schema	No taskId or taskReferenceId in ComposerInputSchema
Service	Rejects legacy_task, LEGACY_TASK, task_node types
Database	Existing guardrails in hierarchy.service block task node mutations
Layer	Guard	Status
Schema	No legacy task fields in ComposerInputSchema	✅
Service	Rejects legacy_task, LEGACY_TASK, task_node types	✅
Hierarchy	Read-only guardrails block task node mutations	✅
Verification
Check	Status
Shared package builds	✓
Backend builds	✓
Routes registered at /api/composer	✓
Guardrails in place	✓
Check	Result
Shared package builds	✅
Backend builds	✅
Frontend builds	✅
Routes registered	✅ "Composer routes registered" in logs
Auth enforced	✅ Returns 401 on unauthenticated requests
What Happens When You Call the Composer
Validation - Request parsed against ComposerInputSchema
Guardrail Check - Rejects legacy action types
Transaction Start - All operations atomic
Create Action - Insert into 
actions
 table
Emit Events - ACTION_DECLARED, FIELD_VALUE_RECORDED for each field
Create References - Insert into action_references table
Compute View - Interpreter derives 
ActionView
Return Response - Action + Events + References + View