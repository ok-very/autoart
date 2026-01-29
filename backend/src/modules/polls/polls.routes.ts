import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreatePollInputSchema,
  SubmitPollResponseInputSchema,
  LogEngagementInputSchema,
  EngagementContextType,
} from '@autoart/shared';
import * as pollsService from './polls.service.js';
import { AppError } from '../../utils/errors.js';

export async function pollRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<ZodTypeProvider>();

  // List user's polls
  fastify.get(
    '/polls',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!request.user?.userId) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      }
      const polls = await pollsService.listPolls(request.user.userId);
      return reply.send({ polls });
    }
  );

  // Get poll by ID with responses
  fastify.get(
    '/polls/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const poll = await pollsService.getPollWithResponses(request.params.id);
      if (!poll) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
      }
      if (poll.created_by !== request.user?.userId) {
        return reply
          .code(403)
          .send({ error: 'FORBIDDEN', message: 'You do not have access to this poll' });
      }
      return reply.send({ poll });
    }
  );

  // Create poll
  fastify.post(
    '/polls',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: CreatePollInputSchema,
      },
    },
    async (request, reply) => {
      try {
        const poll = await pollsService.createPoll(
          request.body.title,
          request.body.description,
          request.body.time_config,
          request.body.project_id,
          request.user?.userId
        );
        return reply.code(201).send({ poll });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/polls/:id/engagements
   *
   * Returns aggregated engagement metrics for a poll (owner-only).
   * Requires authentication. Returns 403 if the requesting user is not the poll creator.
   *
   * @returns {{ summary: { total_opened: number, total_interacted: number, total_deferred: number, unique_actors: number } }}
   */
  fastify.get(
    '/polls/:id/engagements',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const poll = await pollsService.getPollById(request.params.id);
      if (!poll) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
      }

      if (poll.created_by !== request.user?.userId) {
        return reply
          .code(403)
          .send({ error: 'FORBIDDEN', message: 'You do not have access to this poll' });
      }

      const summary = await pollsService.getEngagementSummary('poll', poll.unique_id);
      return reply.send({ summary });
    }
  );

  // Close poll
  fastify.post(
    '/polls/:id/close',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      try {
        const poll = await pollsService.getPollById(request.params.id);
        if (!poll) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
        }

        if (poll.created_by !== request.user?.userId) {
          return reply
            .code(403)
            .send({ error: 'FORBIDDEN', message: 'You do not have access to this poll' });
        }

        const closedPoll = await pollsService.closePoll(request.params.id);
        return reply.send({ poll: closedPoll });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );
}

export async function pollPublicRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<ZodTypeProvider>();

  // Get poll config + responses (public)
  fastify.get(
    '/:uniqueId',
    {
      schema: {
        params: z.object({ uniqueId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const poll = await pollsService.getPollByUniqueId(request.params.uniqueId);
      if (!poll || poll.status !== 'active') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
      }

      const pollWithResponses = await pollsService.getPollWithResponses(poll.id);

      // Strip PII from public responses — only expose participant_name and available_slots
      const safeResponses = (pollWithResponses?.responses ?? []).map((r) => ({
        id: r.id,
        participant_name: r.participant_name,
        available_slots: r.available_slots,
      }));

      return reply.send({
        poll: {
          unique_id: poll.unique_id,
          title: poll.title,
          description: poll.description,
          time_config: poll.time_config,
          responses: safeResponses,
        },
      });
    }
  );

  // Submit availability (public)
  fastify.post(
    '/:uniqueId/respond',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
      schema: {
        params: z.object({ uniqueId: z.string().min(1) }),
        body: SubmitPollResponseInputSchema,
      },
    },
    async (request, reply) => {
      const poll = await pollsService.getPollByUniqueId(request.params.uniqueId);
      if (!poll || poll.status !== 'active') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
      }

      try {
        const response = await pollsService.submitResponse(
          poll.id,
          request.body.participant_name,
          request.body.participant_email,
          request.body.available_slots
        );
        return reply.code(201).send({ response });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Update availability (public)
  fastify.put(
    '/:uniqueId/respond',
    {
      schema: {
        params: z.object({ uniqueId: z.string().min(1) }),
        body: SubmitPollResponseInputSchema,
      },
    },
    async (request, reply) => {
      const poll = await pollsService.getPollByUniqueId(request.params.uniqueId);
      if (!poll || poll.status !== 'active') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
      }

      try {
        const response = await pollsService.updateResponse(
          poll.id,
          request.body.participant_name,
          request.body.available_slots
        );
        return reply.send({ response });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // Get aggregated heatmap data (public)
  fastify.get(
    '/:uniqueId/results',
    {
      schema: {
        params: z.object({ uniqueId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const poll = await pollsService.getPollByUniqueId(request.params.uniqueId);
      if (!poll) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
      }

      const results = await pollsService.getResults(poll.id);
      return reply.send({ results });
    }
  );

  // Log engagement event (public)
  fastify.post(
    '/:uniqueId/engagement',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
      schema: {
        params: z.object({ uniqueId: z.string().min(1) }),
        body: LogEngagementInputSchema,
      },
    },
    async (request, reply) => {
      const poll = await pollsService.getPollByUniqueId(request.params.uniqueId);
      if (!poll || poll.status !== 'active') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Poll not found' });
      }

      await pollsService.logEngagement(
        EngagementContextType.POLL,
        request.params.uniqueId,
        request.body.kind,
        request.body.actorName,
        {
          interactionType: request.body.interactionType,
          progress: request.body.progress,
        }
      );
      return reply.send({ ok: true });
    }
  );
}
