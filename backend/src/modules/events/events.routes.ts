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
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as eventsService from './events.service.js';
import type { Event } from '../../db/schema.js';

// Zod schemas for validation
const ContextTypeSchema = z.enum(['subprocess', 'phase', 'process', 'project', 'record']);

const CreateEventBodySchema = z.object({
  contextId: z.string().uuid(),
  contextType: ContextTypeSchema,
  actionId: z.string().uuid().optional(),
  type: z.string().max(100),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const ContextParamsSchema = z.object({
  contextType: ContextTypeSchema,
  contextId: z.string().uuid(),
});

const ListEventsQuerySchema = z.object({
  contextId: z.string().uuid().optional(),
  contextType: ContextTypeSchema.optional(),
  actionId: z.string().uuid().optional(),
  type: z.string().optional(),
});

const ContextEventsQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  includeSystem: z.string().optional(),
  includeNarrative: z.string().optional(),
  types: z.union([z.string(), z.array(z.string())]).optional(),
  actorId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
});

const ActionIdParamSchema = z.object({
  actionId: z.string().uuid(),
});

export async function eventsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /events - Emit a new event (append to fact log)
   * This is the ONLY write operation for the entire event-sourced system.
   */
  app.post(
    '/',
    {
      schema: {
        body: CreateEventBodySchema,
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
  app.get(
    '/:id',
    {
      schema: {
        params: IdParamSchema,
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
  app.get(
    '/',
    {
      schema: {
        querystring: ListEventsQuerySchema,
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
  app.get(
    '/action/:actionId',
    {
      schema: {
        params: ActionIdParamSchema,
      },
    },
    async (request) => {
      const { actionId } = request.params;
      const events = await eventsService.getEventsByAction(actionId);

      return { events, count: events.length };
    }
  );

  /**
   * GET /events/project/:projectId - Get events scoped to a project
   *
   * Joins through hierarchy_nodes.root_project_id to find all events
   * under a project tree. Supports same pagination/filtering as context endpoint.
   */
  app.get(
    '/project/:projectId',
    {
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        querystring: ContextEventsQuerySchema,
      },
    },
    async (request) => {
      const { projectId } = request.params;
      const { limit, offset, includeSystem, includeNarrative, types, actorId, actionId } = request.query;

      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;
      const parsedIncludeSystem = includeSystem === 'true';
      const parsedIncludeNarrative = includeNarrative === 'true';
      const parsedTypes = types
        ? Array.isArray(types)
          ? types
          : [types]
        : undefined;

      const result = await eventsService.getEventsByProjectPaginated(projectId, {
        limit: parsedLimit,
        offset: parsedOffset,
        includeSystem: parsedIncludeSystem,
        types: parsedTypes,
        actorId,
        actionId,
      });

      if (parsedIncludeNarrative) {
        const { renderFinanceNarrative } = await import('./finance-narrative.js');
        result.events = result.events.map(event => {
          if (event.type === 'FACT_RECORDED' && event.payload) {
            const payload = typeof event.payload === 'string'
              ? JSON.parse(event.payload)
              : event.payload;
            const narrative = renderFinanceNarrative(payload);
            return narrative ? { ...event, _narrative: narrative } : event;
          }
          return event;
        });
      }

      return result;
    }
  );

  /**
   * GET /events/context/:contextType/:contextId - Get events for a context
   *
   * Supports pagination and filtering for the Project Log:
   * - limit: Number of events per page (default 50)
   * - offset: Pagination offset (default 0)
   * - includeSystem: Include system events (default false)
   * - types: Filter by event types (array)
   * - actorId: Filter by actor
   */
  app.get(
    '/context/:contextType/:contextId',
    {
      schema: {
        params: ContextParamsSchema,
        querystring: ContextEventsQuerySchema,
      },
    },
    async (request) => {
      const { contextType, contextId } = request.params;
      const { limit, offset, includeSystem, includeNarrative, types, actorId, actionId } = request.query;

      // Parse query parameters
      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;
      const parsedIncludeSystem = includeSystem === 'true';
      const parsedIncludeNarrative = includeNarrative === 'true';
      const parsedTypes = types
        ? Array.isArray(types)
          ? types
          : [types]
        : undefined;

      const result = await eventsService.getEventsByContextPaginated({
        contextId,
        contextType,
        limit: parsedLimit,
        offset: parsedOffset,
        includeSystem: parsedIncludeSystem,
        types: parsedTypes,
        actorId,
        actionId,
      });

      // Enrich FACT_RECORDED events with human-readable narrative
      if (parsedIncludeNarrative) {
        const { renderFinanceNarrative } = await import('./finance-narrative.js');
        result.events = result.events.map(event => {
          if (event.type === 'FACT_RECORDED' && event.payload) {
            const payload = typeof event.payload === 'string'
              ? JSON.parse(event.payload)
              : event.payload;
            const narrative = renderFinanceNarrative(payload);
            return narrative ? { ...event, _narrative: narrative } : event;
          }
          return event;
        });
      }

      return result;
    }
  );
}
