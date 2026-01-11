import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import {
  createReferenceSchema,
  updateReferenceModeSchema,
  batchResolveSchema,
  CreateReferenceInput,
  UpdateReferenceModeInput,
  BatchResolveInput,
} from './references.schemas.js';
import * as referencesService from './references.service.js';
import { AppError } from '../../utils/errors.js';

export async function referencesRoutes(fastify: FastifyInstance) {
  // Get references for a task
  fastify.get<{ Params: { taskId: string } }>(
    '/task/:taskId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const references = await referencesService.getReferencesForTask(request.params.taskId);
      return reply.send({ references });
    }
  );

  // Get single reference
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const reference = await referencesService.getReferenceById(request.params.id);
      if (!reference) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Reference not found' });
      }
      return reply.send({ reference });
    }
  );

  // Create reference
  fastify.post<{ Body: CreateReferenceInput }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = createReferenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
      }

      try {
        const reference = await referencesService.createReference(parsed.data);
        return reply.code(201).send({ reference });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Update reference mode (static <-> dynamic)
  fastify.patch<{ Params: { id: string }; Body: UpdateReferenceModeInput }>(
    '/:id/mode',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = updateReferenceModeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
      }

      try {
        const reference = await referencesService.updateReferenceMode(request.params.id, parsed.data);
        return reply.send({ reference });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Update snapshot value (for static references)
  fastify.patch<{ Params: { id: string }; Body: { value: unknown } }>(
    '/:id/snapshot',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const reference = await referencesService.updateSnapshotValue(
          request.params.id,
          request.body.value
        );
        return reply.send({ reference });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Delete reference
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        await referencesService.deleteReference(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Resolve single reference
  fastify.get<{ Params: { id: string } }>(
    '/:id/resolve',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const resolved = await referencesService.resolveReference(request.params.id);
        return reply.send({ resolved });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Batch resolve references
  fastify.post<{ Body: BatchResolveInput }>(
    '/resolve',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = batchResolveSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
      }

      const resolved = await referencesService.batchResolveReferences(parsed.data.referenceIds);
      return reply.send(resolved);
    }
  );

  // Check drift for a reference
  fastify.get<{ Params: { id: string } }>(
    '/:id/drift',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const result = await referencesService.checkDrift(request.params.id);
        return reply.send(result);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Get backlinks for a record
  fastify.get<{ Params: { recordId: string } }>(
    '/backlinks/:recordId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const references = await referencesService.getBacklinks(request.params.recordId);
      return reply.send({ references, count: references.length });
    }
  );
}
