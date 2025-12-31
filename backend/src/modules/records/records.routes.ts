import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createDefinitionSchema,
  updateDefinitionSchema,
  cloneDefinitionSchema,
  saveToLibrarySchema,
  createRecordSchema,
  updateRecordSchema,
  listRecordsQuerySchema,
} from './records.schemas.js';
import * as recordsService from './records.service.js';
import { AppError } from '../../utils/errors.js';

export async function recordsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<ZodTypeProvider>();

  // ==================== DEFINITIONS ====================

  // List all definitions
  fastify.get('/definitions', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    const definitions = await recordsService.listDefinitions();
    return reply.send({ definitions });
  });

  // Get single definition
  fastify.get(
    '/definitions/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const definition = await recordsService.getDefinitionById(request.params.id);
      if (!definition) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Definition not found' });
      }
      return reply.send({ definition });
    }
  );

  // Create definition
  fastify.post(
    '/definitions',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: createDefinitionSchema,
      },
    },
    async (request, reply) => {
      try {
        const definition = await recordsService.createDefinition(request.body);
        return reply.code(201).send({ definition });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Update definition
  fastify.patch(
    '/definitions/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateDefinitionSchema,
      },
    },
    async (request, reply) => {
      try {
        const definition = await recordsService.updateDefinition(request.params.id, request.body);
        return reply.send({ definition });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Clone definition
  fastify.post(
    '/definitions/:id/clone',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: cloneDefinitionSchema,
      },
    },
    async (request, reply) => {
      try {
        const definition = await recordsService.cloneDefinition(request.params.id, request.body);
        return reply.code(201).send({ definition });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Delete definition
  fastify.delete(
    '/definitions/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      try {
        await recordsService.deleteDefinition(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // ==================== TEMPLATE LIBRARY ====================

  // Get project's template library
  fastify.get(
    '/definitions/library/:projectId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const definitions = await recordsService.listProjectTemplates(request.params.projectId);
      return reply.send({ definitions });
    }
  );

  // Save definition to project library
  fastify.post(
    '/definitions/:id/save-to-library',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: saveToLibrarySchema,
      },
    },
    async (request, reply) => {
      try {
        const definition = await recordsService.saveToProjectLibrary(request.params.id, request.body);
        return reply.send({ definition });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Remove definition from project library
  fastify.post(
    '/definitions/:id/remove-from-library',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      try {
        const definition = await recordsService.removeFromProjectLibrary(request.params.id);
        return reply.send({ definition });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Toggle clone exclusion on a definition
  fastify.post(
    '/definitions/:id/toggle-clone-excluded',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ excluded: z.boolean() }),
      },
    },
    async (request, reply) => {
      try {
        const definition = await recordsService.toggleCloneExcluded(
          request.params.id,
          request.body.excluded
        );
        return reply.send({ definition });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Get cloneable definitions count for a project
  fastify.get(
    '/definitions/clone-stats/:projectId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const stats = await recordsService.getCloneableDefinitionsCount(request.params.projectId);
      return reply.send({ stats });
    }
  );

  // ==================== RECORDS ====================

  // Get record stats (count per definition type)
  fastify.get('/stats', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    const stats = await recordsService.getRecordStats();
    return reply.send({ stats });
  });

  // Bulk classify records
  fastify.post(
    '/bulk/classify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: z.object({
          recordIds: z.array(z.string().uuid()),
          classificationNodeId: z.string().uuid().nullable(),
        }),
      },
    },
    async (request, reply) => {
      const updated = await recordsService.bulkClassifyRecords(
        request.body.recordIds,
        request.body.classificationNodeId
      );
      return reply.send({ updated });
    }
  );

  // Bulk delete records
  fastify.post(
    '/bulk/delete',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: z.object({
          recordIds: z.array(z.string().uuid()),
        }),
      },
    },
    async (request, reply) => {
      const deleted = await recordsService.bulkDeleteRecords(request.body.recordIds);
      return reply.send({ deleted });
    }
  );

  // List records
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: listRecordsQuerySchema,
      },
    },
    async (request, reply) => {
      const records = await recordsService.listRecords(request.query);
      return reply.send({ records });
    }
  );

  // Get single record
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const record = await recordsService.getRecordById(request.params.id);
      if (!record) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Record not found' });
      }
      return reply.send({ record });
    }
  );

  // Get record with definition
  fastify.get(
    '/:id/full',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const result = await recordsService.getRecordWithDefinition(request.params.id);
      if (!result) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Record not found' });
      }
      return reply.send({ record: result });
    }
  );

  // Create record
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: createRecordSchema,
      },
    },
    async (request, reply) => {
      try {
        const record = await recordsService.createRecord(request.body, request.user.userId);
        return reply.code(201).send({ record });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Update record
  fastify.patch(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateRecordSchema,
      },
    },
    async (request, reply) => {
      try {
        const record = await recordsService.updateRecord(request.params.id, request.body);
        return reply.send({ record });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Delete record
  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      try {
        await recordsService.deleteRecord(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );
}