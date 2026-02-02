/**
 * Mail Routes
 *
 * Endpoints for promoted email messages and their links
 * to actions, records, and hierarchy nodes.
 * All routes require authentication.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as mailService from './mail.service.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const PromoteBodySchema = z.object({
  externalId: z.string().min(1),
});

const ListQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const CreateLinkBodySchema = z.object({
  targetType: z.enum(['action', 'record', 'hierarchy_node']),
  targetId: z.string().uuid(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function mailRoutes(app: FastifyInstance) {
  /**
   * Promote a transient email from AutoHelper into PostgreSQL.
   * Idempotent — re-promoting returns the existing row.
   */
  app.post('/promote', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const { externalId } = PromoteBodySchema.parse(request.body);
    const userId = request.user.userId;

    try {
      const result = await mailService.promoteEmail(externalId, userId);
      return reply.status(result.created ? 201 : 200).send(result.message);
    } catch (err) {
      if (err instanceof Error && err.message.includes('AutoHelper returned')) {
        return reply.status(502).send({
          error: 'Failed to fetch email from AutoHelper',
          details: err.message,
        });
      }
      throw err;
    }
  });

  /**
   * List promoted mail messages with optional project filter.
   */
  app.get('/messages', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const filters = ListQuerySchema.parse(request.query);
    const result = await mailService.listMailMessages(filters);
    return reply.send(result);
  });

  /**
   * Get a single promoted mail message by UUID.
   */
  app.get('/messages/:id', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const message = await mailService.getMailMessage(id);

    if (!message) {
      return reply.status(404).send({ error: 'Mail message not found' });
    }

    return reply.send(message);
  });

  /**
   * Return promoted external IDs for inbox badge overlay.
   */
  app.get('/promoted-ids', {
    preHandler: app.authenticate,
  }, async (_request, reply) => {
    const ids = await mailService.getPromotedExternalIds();
    return reply.send(ids);
  });

  /**
   * Create a link between a promoted mail message and a target entity.
   */
  app.post('/messages/:id/links', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const { id: messageId } = request.params as { id: string };
    const { targetType, targetId } = CreateLinkBodySchema.parse(request.body);
    const userId = request.user.userId;

    // Verify message exists
    const message = await mailService.getMailMessage(messageId);
    if (!message) {
      return reply.status(404).send({ error: 'Mail message not found' });
    }

    try {
      const link = await mailService.linkEmail(messageId, targetType, targetId, userId);
      return reply.status(201).send(link);
    } catch (err) {
      // Handle unique constraint violation
      if (err instanceof Error && err.message.includes('unique')) {
        return reply.status(409).send({ error: 'Link already exists' });
      }
      throw err;
    }
  });

  /**
   * Remove a link by ID.
   */
  app.delete('/messages/:id/links/:linkId', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const { linkId } = request.params as { id: string; linkId: string };
    const deleted = await mailService.unlinkEmail(linkId);

    if (!deleted) {
      return reply.status(404).send({ error: 'Link not found' });
    }

    return reply.status(204).send();
  });

  /**
   * Get all mail links for a given target entity.
   */
  app.get('/links/:targetType/:targetId', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const { targetType, targetId } = request.params as {
      targetType: string;
      targetId: string;
    };
    const links = await mailService.getLinksForTarget(targetType, targetId);
    return reply.send(links);
  });
}
