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
import { z } from 'zod';

import * as projector from './workflow-surface.projector.js';
import type { ContextType } from '../../db/schema.js';

// Querystring schema using Zod (required for fastify-type-provider-zod)
const querystringSchema = z.object({
  contextId: z.string().uuid(),
  contextType: z.enum(['subprocess', 'stage', 'process', 'project', 'record']),
});

export async function workflowSurfaceRoutes(fastify: FastifyInstance) {
  /**
   * GET /workflow/surfaces/workflow_table
   * Get workflow surface nodes for a context
   *
   * Query params:
   * - contextId: UUID (required)
   * - contextType: 'subprocess' | 'stage' | 'process' | 'project' (required)
   */
  fastify.get(
    '/surfaces/workflow_table',
    {
      schema: {
        querystring: querystringSchema,
      },
    },
    async (request, reply) => {
      const { contextId, contextType } = request.query as { contextId: string; contextType: ContextType };

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
  fastify.post(
    '/surfaces/workflow_table/refresh',
    {
      schema: {
        querystring: querystringSchema,
      },
    },
    async (request, reply) => {
      const { contextId, contextType } = request.query as { contextId: string; contextType: ContextType };

      await projector.forceRefreshAllSurfaces(contextId, contextType);

      return reply.send({
        success: true,
        message: `Refreshed workflow surface for ${contextType}/${contextId}`,
      });
    }
  );
}
