/**
 * Events Routes
 *
 * API endpoints for emitting and querying Events.
 *
 * Allowed endpoints:
 * - POST /events (emit event - the ONLY write operation)
 * - GET /events/:id (get event by ID)
 * - GET /events (list events with filters)
 *
 * Forbidden patterns (per foundational model):
 * - PUT /events/:id (events are immutable)
 * - PATCH /events/:id (events are immutable)
 * - DELETE /events/:id (events are append-only)
 */

import { FastifyInstance } from 'fastify';
import * as eventsService from './events.service.js';
import type { ContextType, Event } from '../../db/schema.js';

// Response schemas for Fastify
const eventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    context_id: { type: 'string', format: 'uuid' },
    context_type: { type: 'string', enum: ['subprocess', 'stage', 'process', 'project', 'record'] },
    action_id: { type: 'string', format: 'uuid', nullable: true },
    type: { type: 'string' },
    payload: { type: 'object' },
    actor_id: { type: 'string', format: 'uuid', nullable: true },
    occurred_at: { type: 'string', format: 'date-time' },
  },
};

export async function eventsRoutes(fastify: FastifyInstance) {
  /**
   * POST /events - Emit a new event (append to fact log)
   * This is the ONLY write operation for the entire event-sourced system.
   */
  fastify.post<{
    Body: {
      contextId: string;
      contextType: ContextType;
      actionId?: string;
      type: string;
      payload?: Record<string, unknown>;
    };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['contextId', 'contextType', 'type'],
          properties: {
            contextId: { type: 'string', format: 'uuid' },
            contextType: { type: 'string', enum: ['subprocess', 'stage', 'process', 'project', 'record'] },
            actionId: { type: 'string', format: 'uuid' },
            type: { type: 'string', maxLength: 100 },
            payload: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              event: eventSchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { contextId, contextType, actionId, type, payload } = request.body;

      const event = await eventsService.emitEvent({
        contextId,
        contextType,
        actionId,
        type,
        payload,
        actorId: (request as any).user?.id,
      });

      return reply.status(201).send({ event });
    }
  );

  /**
   * GET /events/:id - Get an event by ID
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              event: eventSchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const event = await eventsService.getEventById(id);

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      return { event };
    }
  );

  /**
   * GET /events - List events with optional filters
   * Query params: contextId, contextType, actionId, type
   */
  fastify.get<{
    Querystring: {
      contextId?: string;
      contextType?: ContextType;
      actionId?: string;
      type?: string;
    };
  }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            contextId: { type: 'string', format: 'uuid' },
            contextType: { type: 'string', enum: ['subprocess', 'stage', 'process', 'project', 'record'] },
            actionId: { type: 'string', format: 'uuid' },
            type: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              events: { type: 'array', items: eventSchema },
            },
          },
        },
      },
    },
    async (request) => {
      const { contextId, contextType, actionId, type } = request.query;

      let events: Event[] = [];

      if (actionId) {
        // Get events for a specific action
        events = await eventsService.getEventsByAction(actionId);
      } else if (contextId && contextType) {
        if (type) {
          events = await eventsService.getEventsByType(contextId, contextType, type);
        } else {
          events = await eventsService.getEventsByContext(contextId, contextType);
        }
      }
      // If no filter, events remains empty (don't allow unbounded queries)

      return { events };
    }
  );

  /**
   * GET /events/action/:actionId - Get all events for an action
   * This is the core query for interpreting action state.
   */
  fastify.get<{
    Params: { actionId: string };
  }>(
    '/action/:actionId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              events: { type: 'array', items: eventSchema },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      const { actionId } = request.params;
      const events = await eventsService.getEventsByAction(actionId);

      return { events, count: events.length };
    }
  );

  /**
   * GET /events/context/:contextType/:contextId - Get events for a context
   */
  fastify.get<{
    Params: { contextType: ContextType; contextId: string };
  }>(
    '/context/:contextType/:contextId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['contextType', 'contextId'],
          properties: {
            contextType: { type: 'string', enum: ['subprocess', 'stage', 'process', 'project', 'record'] },
            contextId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              events: { type: 'array', items: eventSchema },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      const { contextType, contextId } = request.params;

      const [events, count] = await Promise.all([
        eventsService.getEventsByContext(contextId, contextType),
        eventsService.countEventsByContext(contextId, contextType),
      ]);

      return { events, count };
    }
  );
}
