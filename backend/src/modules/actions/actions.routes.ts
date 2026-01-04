/**
 * Actions Routes
 *
 * API endpoints for creating and querying Actions.
 *
 * Allowed endpoints:
 * - POST /actions (create action)
 * - GET /actions/:id (get action by ID)
 * - GET /subprocess/:id/actions (get actions for subprocess)
 *
 * Forbidden patterns (per foundational model):
 * - PATCH /actions/:id (actions are immutable)
 * - POST /actions/:id/complete (state comes from events)
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as actionsService from './actions.service.js';
import * as interpreterService from '../interpreter/interpreter.service.js';

// Zod schemas for validation
const ContextTypeSchema = z.enum(['subprocess', 'stage', 'process', 'project', 'record']);

const CreateActionBodySchema = z.object({
  contextId: z.string().uuid(),
  contextType: ContextTypeSchema,
  type: z.string().max(100),
  fieldBindings: z.array(z.unknown()).optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const ContextParamsSchema = z.object({
  contextType: ContextTypeSchema,
  contextId: z.string().uuid(),
});

const ListActionsQuerySchema = z.object({
  contextId: z.string().uuid().optional(),
  contextType: ContextTypeSchema.optional(),
  type: z.string().optional(),
  limit: z.coerce.number().optional().default(100),
});

export async function actionsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /actions - Create a new action (intent declaration)
   */
  app.post(
    '/',
    {
      schema: {
        body: CreateActionBodySchema,
      },
    },
    async (request, reply) => {
      const { contextId, contextType, type, fieldBindings } = request.body;

      const action = await actionsService.createAction({
        contextId,
        contextType,
        type,
        fieldBindings,
      });

      return reply.status(201).send({ action });
    }
  );

  /**
   * GET /actions/:id - Get an action by ID
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
      const action = await actionsService.getActionById(id);

      if (!action) {
        return reply.status(404).send({ error: 'Action not found' });
      }

      return { action };
    }
  );

  /**
   * GET /actions/:id/view - Get an interpreted ActionView by ID
   */
  app.get(
    '/:id/view',
    {
      schema: {
        params: IdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const view = await interpreterService.getActionViewById(id);

      if (!view) {
        return reply.status(404).send({ error: 'Action not found' });
      }

      return { view };
    }
  );

  /**
   * GET /actions - List all actions (with optional context filter)
   * Query params: contextId, contextType, type
   */
  app.get(
    '/',
    {
      schema: {
        querystring: ListActionsQuerySchema,
      },
    },
    async (request) => {
      const { contextId, contextType, type, limit } = request.query;

      let actions;

      if (contextId && contextType) {
        if (type) {
          actions = await actionsService.getActionsByType(contextId, contextType, type);
        } else {
          actions = await actionsService.getActionsByContext(contextId, contextType);
        }
      } else {
        actions = await actionsService.getAllActions(limit || 100);
      }

      return { actions };
    }
  );

  /**
   * GET /actions/context/:contextType/:contextId - Get actions for a specific context
   * Example: GET /actions/context/subprocess/uuid-here
   */
  app.get(
    '/context/:contextType/:contextId',
    {
      schema: {
        params: ContextParamsSchema,
      },
    },
    async (request) => {
      const { contextType, contextId } = request.params;

      const [actions, count] = await Promise.all([
        actionsService.getActionsByContext(contextId, contextType),
        actionsService.countActionsByContext(contextId, contextType),
      ]);

      return { actions, count };
    }
  );
}
