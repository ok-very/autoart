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
import { AppError } from '../../utils/errors.js';

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
}
