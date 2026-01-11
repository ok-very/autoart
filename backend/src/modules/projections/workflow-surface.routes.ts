/**
 * Workflow Surface Routes
 *
 * API endpoints for reading workflow surface nodes.
 * These are read-only endpoints - all writes go through event emission.
 *
 * Endpoints:
 * - GET /workflow/surfaces/workflow_table - Get surface nodes for a context
 * - POST /workflow/surfaces/workflow_table/refresh - Force refresh (debug)
 */

import { FastifyInstance } from 'fastify';

import * as projector from './workflow-surface.projector.js';
import type { ContextType } from '../../db/schema.js';

// Response schema for surface nodes
const surfaceNodeSchema = {
  type: 'object',
  properties: {
    actionId: { type: 'string', format: 'uuid' },
    parentActionId: { type: 'string', format: 'uuid', nullable: true },
    depth: { type: 'integer' },
    position: { type: 'integer' },
    payload: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: {},
        status: { type: 'string', enum: ['pending', 'active', 'blocked', 'finished'] },
        assignee: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
          nullable: true,
        },
        dueDate: { type: 'string', nullable: true },
        percentComplete: { type: 'number', nullable: true },
      },
    },
    flags: {
      type: 'object',
      properties: {
        cycleDetected: { type: 'boolean' },
        hasChildren: { type: 'boolean' },
      },
      nullable: true,
    },
    renderedAt: { type: 'string', format: 'date-time' },
    lastEventOccurredAt: { type: 'string', format: 'date-time' },
  },
};

export async function workflowSurfaceRoutes(fastify: FastifyInstance) {
  /**
   * GET /workflow/surfaces/workflow_table
   * Get workflow surface nodes for a context
   *
   * Query params:
   * - contextId: UUID (required)
   * - contextType: 'subprocess' | 'stage' | 'process' | 'project' (required)
   */
  fastify.get<{
    Querystring: { contextId: string; contextType: ContextType };
  }>(
    '/surfaces/workflow_table',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['contextId', 'contextType'],
          properties: {
            contextId: { type: 'string', format: 'uuid' },
            contextType: {
              type: 'string',
              enum: ['subprocess', 'stage', 'process', 'project', 'record'],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              nodes: {
                type: 'array',
                items: surfaceNodeSchema,
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { contextId, contextType } = request.query;

      const nodes = await projector.getWorkflowSurfaceNodes(
        contextId,
        contextType,
        'workflow_table'
      );

      return reply.send({ nodes });
    }
  );

  /**
   * POST /workflow/surfaces/workflow_table/refresh
   * Force refresh the workflow surface for a context (debug/admin)
   */
  fastify.post<{
    Querystring: { contextId: string; contextType: ContextType };
  }>(
    '/surfaces/workflow_table/refresh',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['contextId', 'contextType'],
          properties: {
            contextId: { type: 'string', format: 'uuid' },
            contextType: {
              type: 'string',
              enum: ['subprocess', 'stage', 'process', 'project', 'record'],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { contextId, contextType } = request.query;

      await projector.forceRefreshAllSurfaces(contextId, contextType);

      return reply.send({
        success: true,
        message: `Refreshed workflow surface for ${contextType}/${contextId}`,
      });
    }
  );
}
