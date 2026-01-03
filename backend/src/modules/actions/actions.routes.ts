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
import * as actionsService from './actions.service.js';
import type { ContextType } from '../../db/schema.js';

// Response schemas for Fastify
const actionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    context_id: { type: 'string', format: 'uuid' },
    context_type: { type: 'string', enum: ['subprocess', 'stage', 'process', 'project', 'record'] },
    type: { type: 'string' },
    field_bindings: { type: 'array' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export async function actionsRoutes(fastify: FastifyInstance) {
  /**
   * POST /actions - Create a new action (intent declaration)
   */
  fastify.post<{
    Body: {
      contextId: string;
      contextType: ContextType;
      type: string;
      fieldBindings?: unknown[];
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
            type: { type: 'string', maxLength: 100 },
            fieldBindings: { type: 'array' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              action: actionSchema,
            },
          },
        },
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
              action: actionSchema,
            },
          },
        },
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
   * GET /actions - List all actions (with optional context filter)
   * Query params: contextId, contextType, type
   */
  fastify.get<{
    Querystring: {
      contextId?: string;
      contextType?: ContextType;
      type?: string;
      limit?: number;
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
            type: { type: 'string' },
            limit: { type: 'number', default: 100 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              actions: { type: 'array', items: actionSchema },
            },
          },
        },
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
              actions: { type: 'array', items: actionSchema },
              count: { type: 'number' },
            },
          },
        },
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
