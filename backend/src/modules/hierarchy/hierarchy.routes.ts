import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createNodeSchema,
  updateNodeSchema,
  moveNodeSchema,
  cloneNodeSchema,
  CreateNodeInput,
  UpdateNodeInput,
  MoveNodeInput,
  CloneNodeInput,
} from './hierarchy.schemas.js';
import * as hierarchyService from './hierarchy.service.js';
import * as interpreterService from '../interpreter/interpreter.service.js';
import { AppError } from '../../utils/errors.js';
import type { ActionViewType } from '../interpreter/interpreter.service.js';

export async function hierarchyRoutes(fastify: FastifyInstance) {
  // List all projects
  fastify.get('/projects', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const projects = await hierarchyService.listProjects(request.user.userId);
    return reply.send({ projects });
  });

  // Get project tree
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const tree = await hierarchyService.getProjectTree(request.params.projectId);
        return reply.send({ nodes: tree });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Get single node
  fastify.get<{ Params: { nodeId: string } }>(
    '/nodes/:nodeId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const node = await hierarchyService.getNodeById(request.params.nodeId);
      if (!node) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Node not found' });
      }
      return reply.send({ node });
    }
  );

  // Create node
  fastify.post<{ Body: CreateNodeInput }>(
    '/nodes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = createNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
      }

      try {
        const node = await hierarchyService.createNode(parsed.data, request.user.userId);
        return reply.code(201).send({ node });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Update node
  fastify.patch<{ Params: { nodeId: string }; Body: UpdateNodeInput }>(
    '/nodes/:nodeId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = updateNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
      }

      try {
        const node = await hierarchyService.updateNode(request.params.nodeId, parsed.data);
        return reply.send({ node });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Delete node
  fastify.delete<{ Params: { nodeId: string } }>(
    '/nodes/:nodeId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        await hierarchyService.deleteNode(request.params.nodeId);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Move node
  fastify.patch<{ Params: { nodeId: string }; Body: MoveNodeInput }>(
    '/nodes/:nodeId/move',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = moveNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
      }

      try {
        const node = await hierarchyService.moveNode(request.params.nodeId, parsed.data);
        return reply.send({ node });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Clone node (deep copy)
  fastify.post<{ Body: CloneNodeInput }>(
    '/clone',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = cloneNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
      }

      try {
        const node = await hierarchyService.deepCloneNode(parsed.data, request.user.userId);
        return reply.code(201).send({ node });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // ============================================================================
  // ACTION VIEWS (Foundational Model - Non-Reified Projections)
  // ============================================================================

  /**
   * GET /hierarchy/subprocess/:id/action-views
   *
   * Get interpreted ActionViews for a subprocess context.
   * Views are computed on-demand from Actions + Events.
   *
   * Query params:
   * - view: 'task-like' | 'kanban-card' | 'timeline-row' (default: 'task-like')
   * - status: filter by derived status (pending, active, blocked, finished)
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { view?: ActionViewType; status?: string };
  }>(
    '/subprocess/:id/action-views',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { view = 'task-like', status } = request.query;

      // Verify the subprocess exists
      const node = await hierarchyService.getNodeById(id);
      if (!node) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Subprocess not found' });
      }

      if (node.type !== 'subprocess') {
        return reply.code(400).send({
          error: 'INVALID_CONTEXT',
          message: `Expected subprocess, got ${node.type}`,
        });
      }

      try {
        let views;

        if (status) {
          // Filter by derived status
          const derivedStatus = status as interpreterService.DerivedStatus;
          views = await interpreterService.getActionViewsByStatus(id, 'subprocess', derivedStatus, view);
        } else {
          views = await interpreterService.getActionViews(id, 'subprocess', view);
        }

        return reply.send({ views });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /hierarchy/subprocess/:id/action-views/summary
   *
   * Get status summary (counts by derived status) for a subprocess.
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/subprocess/:id/action-views/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      // Verify the subprocess exists
      const node = await hierarchyService.getNodeById(id);
      if (!node) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Subprocess not found' });
      }

      if (node.type !== 'subprocess') {
        return reply.code(400).send({
          error: 'INVALID_CONTEXT',
          message: `Expected subprocess, got ${node.type}`,
        });
      }

      try {
        const summary = await interpreterService.getStatusSummary(id, 'subprocess');
        return reply.send({ summary });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /hierarchy/:contextType/:id/action-views
   *
   * Generic endpoint for stage/process action views.
   * Supported types: stage, process
   */
  fastify.get<{
    Params: { contextType: string; id: string };
    Querystring: { view?: ActionViewType; status?: string };
  }>(
    '/:contextType/:id/action-views',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { contextType, id } = request.params;
      const { view = 'task-like', status } = request.query;

      // Validate context type
      if (!['stage', 'process'].includes(contextType)) {
        // If it's subprocess, it should have been caught by the specific route above,
        // but if not (e.g. route order), we can handle it or let it fall through.
        // Since specific routes take precedence in Fastify if defined first,
        // and we are defining this AFTER, it should be fine.
        // However, to be safe and explicit:
        if (contextType === 'subprocess') {
          // Delegate to the specific handler logic or just allow it here too?
          // Let's allow it here too for consistency if the specific route is removed later.
        } else {
          return reply.code(400).send({ error: 'INVALID_CONTEXT_TYPE', message: 'Invalid context type' });
        }
      }

      // Verify the node exists
      const node = await hierarchyService.getNodeById(id);
      if (!node) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Node not found' });
      }

      if (node.type !== contextType) {
        return reply.code(400).send({
          error: 'INVALID_CONTEXT',
          message: `Expected ${contextType}, got ${node.type}`,
        });
      }

      try {
        let views;
        // Cast contextType to ContextType
        const type = contextType as 'stage' | 'process' | 'subprocess';

        if (status) {
          const derivedStatus = status as interpreterService.DerivedStatus;
          views = await interpreterService.getActionViewsByStatus(id, type, derivedStatus, view);
        } else {
          views = await interpreterService.getActionViews(id, type, view);
        }

        return reply.send({ views });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /hierarchy/:contextType/:id/action-views/summary
   *
   * Generic endpoint for stage/process action views summary.
   */
  fastify.get<{
    Params: { contextType: string; id: string };
  }>(
    '/:contextType/:id/action-views/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { contextType, id } = request.params;

      // Validate context type
      if (!['stage', 'process'].includes(contextType)) {
        if (contextType !== 'subprocess') {
          return reply.code(400).send({ error: 'INVALID_CONTEXT_TYPE', message: 'Invalid context type' });
        }
      }

      // Verify the node exists
      const node = await hierarchyService.getNodeById(id);
      if (!node) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Node not found' });
      }

      if (node.type !== contextType) {
        return reply.code(400).send({
          error: 'INVALID_CONTEXT',
          message: `Expected ${contextType}, got ${node.type}`,
        });
      }

      try {
        const type = contextType as 'stage' | 'process' | 'subprocess';
        const summary = await interpreterService.getStatusSummary(id, type);
        return reply.send({ summary });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );
}
