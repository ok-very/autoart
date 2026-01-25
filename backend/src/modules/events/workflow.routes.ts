/**
 * Workflow Routes
 *
 * API endpoints for work-related event emissions.
 * These are convenience endpoints that wrap POST /events with
 * domain-specific semantics.
 *
 * All endpoints emit events - they do NOT mutate state directly.
 * These endpoints are allowed because they emit events, not mutate views.
 *
 * Allowed:
 * - POST /workflow/actions/:id/start
 * - POST /workflow/actions/:id/stop
 * - POST /workflow/actions/:id/finish
 * - POST /workflow/actions/:id/block
 * - POST /workflow/actions/:id/unblock
 * - POST /workflow/actions/:id/assign
 * - POST /workflow/actions/:id/unassign
 * - POST /workflow/actions/:id/field
 *
 * Still forbidden (these imply state mutation):
 * - PATCH /tasks/:id
 * - PUT /actions/:id/status
 */

import { FastifyInstance } from 'fastify';

import * as workflowService from './workflow.service.js';

// Response schema for events
const eventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    context_id: { type: 'string', format: 'uuid' },
    context_type: { type: 'string' },
    action_id: { type: 'string', format: 'uuid', nullable: true },
    type: { type: 'string' },
    payload: { type: 'object' },
    actor_id: { type: 'string', format: 'uuid', nullable: true },
    occurred_at: { type: 'string', format: 'date-time' },
  },
};

export async function workflowRoutes(fastify: FastifyInstance) {
  /**
   * POST /workflow/actions/:actionId/start
   * Emit WORK_STARTED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/start',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { payload } = request.body || {};

      const event = await workflowService.startWork({
        actionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/stop
   * Emit WORK_STOPPED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/stop',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { payload } = request.body || {};

      const event = await workflowService.stopWork({
        actionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/finish
   * Emit WORK_FINISHED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/finish',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { payload } = request.body || {};

      const event = await workflowService.finishWork({
        actionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/block
   * Emit WORK_BLOCKED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { reason?: string; payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/block',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { reason, payload } = request.body || {};

      const event = await workflowService.blockWork({
        actionId,
        reason,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/unblock
   * Emit WORK_UNBLOCKED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/unblock',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { payload } = request.body || {};

      const event = await workflowService.unblockWork({
        actionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/assign
   * Emit ASSIGNMENT_OCCURRED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { assigneeId: string; assigneeName?: string; payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/assign',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['assigneeId'],
          properties: {
            assigneeId: { type: 'string', format: 'uuid' },
            assigneeName: { type: 'string' },
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { assigneeId, assigneeName, payload } = request.body;

      const event = await workflowService.assignWork({
        actionId,
        assigneeId,
        assigneeName,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/unassign
   * Emit ASSIGNMENT_REMOVED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/unassign',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { payload } = request.body || {};

      const event = await workflowService.unassignWork({
        actionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/field
   * Emit FIELD_VALUE_RECORDED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { fieldKey: string; value: unknown; payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/field',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['fieldKey', 'value'],
          properties: {
            fieldKey: { type: 'string' },
            value: {},
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { fieldKey, value, payload } = request.body;

      const event = await workflowService.recordFieldValue({
        actionId,
        fieldKey,
        value,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  // ============================================================================
  // DEPENDENCY ROUTES (Workflow Surface)
  // ============================================================================

  /**
   * POST /workflow/actions/:actionId/dependencies/add
   * Emit DEPENDENCY_ADDED event
   *
   * Semantics:
   * - "actionId is blocked by dependsOnActionId"
   * - "dependsOnActionId must complete before actionId"
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { dependsOnActionId: string; payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/dependencies/add',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['dependsOnActionId'],
          properties: {
            dependsOnActionId: { type: 'string', format: 'uuid' },
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { dependsOnActionId, payload } = request.body;

      const event = await workflowService.addDependency({
        actionId,
        dependsOnActionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/dependencies/remove
   * Emit DEPENDENCY_REMOVED event
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { dependsOnActionId: string; payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/dependencies/remove',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['dependsOnActionId'],
          properties: {
            dependsOnActionId: { type: 'string', format: 'uuid' },
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { dependsOnActionId, payload } = request.body;

      const event = await workflowService.removeDependency({
        actionId,
        dependsOnActionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /workflow/actions/:actionId/move
   * Emit WORKFLOW_ROW_MOVED event
   *
   * @param surfaceType - The surface type (e.g., 'workflow_table')
   * @param afterActionId - Position after this action, or null for first
   */
  fastify.post<{
    Params: { actionId: string };
    Body: { surfaceType?: string; afterActionId: string | null; payload?: Record<string, unknown> };
  }>(
    '/actions/:actionId/move',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['afterActionId'],
          properties: {
            surfaceType: { type: 'string', default: 'workflow_table' },
            afterActionId: { type: 'string', format: 'uuid', nullable: true },
            payload: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object', properties: { event: eventSchema } },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { surfaceType = 'workflow_table', afterActionId, payload } = request.body;

      const event = await workflowService.moveWorkflowRow({
        actionId,
        surfaceType,
        afterActionId,
        actorId: (request as any).user?.id,
        payload,
      });

      return reply.status(201).send({ event });
    }
  );

  // ============================================================================
  // SCHEDULING ROUTES (Calendar/Timeline)
  // ============================================================================

  /**
   * POST /workflow/actions/:actionId/reschedule
   * Emit FIELD_VALUE_RECORDED events for scheduling fields.
   * Used by CalendarView and GanttView for drag-and-drop operations.
   */
  fastify.post<{
    Params: { actionId: string };
    Body: {
      startDate?: string;
      dueDate?: string;
      durationDays?: number;
      scheduleMode?: 'explicit' | 'anchor_start' | 'anchor_due';
      payload?: Record<string, unknown>;
    };
  }>(
    '/actions/:actionId/reschedule',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            dueDate: { type: 'string' },
            durationDays: { type: 'number', minimum: 0 },
            scheduleMode: { type: 'string', enum: ['explicit', 'anchor_start', 'anchor_due'] },
            payload: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              events: { type: 'array', items: eventSchema },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const { startDate, dueDate, durationDays, scheduleMode, payload } = request.body || {};

      const events = await workflowService.rescheduleAction({
        actionId,
        actorId: request.user?.id,
        startDate,
        dueDate,
        durationDays,
        scheduleMode,
        payload,
      });

      return reply.status(201).send({ events });
    }
  );
}
