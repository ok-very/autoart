import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  CreateIntakeFormInputSchema,
  UpdateIntakeFormInputSchema,
  UpsertIntakeFormPageInputSchema,
} from '@autoart/shared';

import * as intakeService from './intake.service.js';
import { AppError } from '../../utils/errors.js';

export async function intakeRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<ZodTypeProvider>();

  // ==================== ADMIN ROUTES (Authenticated) ====================

  // List all forms
  fastify.get(
    '/forms',
    { preHandler: [fastify.authenticate] },
    async (_request, reply) => {
      const forms = await intakeService.listForms();
      return reply.send({ forms });
    }
  );

  // Get form by ID
  fastify.get(
    '/forms/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const form = await intakeService.getFormWithPages(request.params.id);
      if (!form) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Form not found' });
      }
      return reply.send({ form });
    }
  );

  // Create form
  fastify.post(
    '/forms',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: CreateIntakeFormInputSchema,
      },
    },
    async (request, reply) => {
      try {
        const form = await intakeService.createForm(
          request.body.title,
          request.body.sharepoint_request_url
        );
        return reply.code(201).send({ form });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Update form
  fastify.patch(
    '/forms/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: UpdateIntakeFormInputSchema,
      },
    },
    async (request, reply) => {
      try {
        const form = await intakeService.updateForm(request.params.id, request.body);
        return reply.send({ form });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Upsert page
  fastify.put(
    '/forms/:id/pages',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: UpsertIntakeFormPageInputSchema,
      },
    },
    async (request, reply) => {
      const form = await intakeService.getFormById(request.params.id);
      if (!form) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Form not found' });
      }

      const page = await intakeService.upsertPage(
        request.params.id,
        request.body.page_index,
        request.body.blocks_config
      );
      return reply.send({ page });
    }
  );

  // Delete page
  fastify.delete(
    '/forms/:id/pages/:pageIndex',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
          pageIndex: z.coerce.number().int().min(0),
        }),
      },
    },
    async (request, reply) => {
      await intakeService.deletePage(request.params.id, request.params.pageIndex);
      return reply.code(204).send();
    }
  );

  // List submissions for a form
  fastify.get(
    '/forms/:id/submissions',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        }),
      },
    },
    async (request, reply) => {
      const submissions = await intakeService.listSubmissions(
        request.params.id,
        request.query.limit,
        request.query.offset
      );
      return reply.send({ submissions });
    }
  );
}

export async function intakePublicRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<ZodTypeProvider>();

  // ==================== PUBLIC ROUTES (No Auth, CORS restricted) ====================

  // Get form by unique_id (public)
  fastify.get(
    '/forms/:uniqueId',
    {
      schema: {
        params: z.object({ uniqueId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const form = await intakeService.getFormWithPagesByUniqueId(request.params.uniqueId);
      if (!form || form.status !== 'active') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Form not found' });
      }

      // Return sanitized form data (exclude internal fields if needed)
      return reply.send({
        form: {
          unique_id: form.unique_id,
          title: form.title,
          sharepoint_request_url: form.sharepoint_request_url,
          pages: form.pages.map((p) => ({
            page_index: p.page_index,
            blocks_config: p.blocks_config,
          })),
        },
      });
    }
  );

  // Submit to form (public)
  fastify.post(
    '/forms/:uniqueId/submissions',
    {
      schema: {
        params: z.object({ uniqueId: z.string().min(1) }),
        body: z.object({
          upload_code: z.string().min(1),
          metadata: z.record(z.string(), z.unknown()),
        }),
      },
    },
    async (request, reply) => {
      const form = await intakeService.getFormByUniqueId(request.params.uniqueId);
      if (!form || form.status !== 'active') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Form not found' });
      }

      const submission = await intakeService.createSubmission(
        form.id,
        request.body.upload_code,
        request.body.metadata
      );

      // Note: CSV export of submissions handled by AutoHelper on-demand

      return reply.code(201).send({
        submission: {
          id: submission.id,
          upload_code: submission.upload_code,
          created_at: submission.created_at,
        },
      });
    }
  );
}
