/**
 * Record Links Routes
 *
 * API endpoints for managing many-to-many record relationships.
 */

import { FastifyInstance } from 'fastify';
import * as linksService from './links.service.js';

// Request/Response schemas
const linkSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    source_record_id: { type: 'string', format: 'uuid' },
    target_record_id: { type: 'string', format: 'uuid' },
    link_type: { type: 'string' },
    metadata: { type: 'object' },
    created_by: { type: 'string', format: 'uuid', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
  },
};

const linkWithRecordsSchema = {
  type: 'object',
  properties: {
    ...linkSchema.properties,
    source_record: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        unique_name: { type: 'string' },
        definition_name: { type: 'string' },
      },
    },
    target_record: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        unique_name: { type: 'string' },
        definition_name: { type: 'string' },
      },
    },
  },
};

export async function linksRoutes(fastify: FastifyInstance) {
  // Create a new link
  fastify.post<{
    Body: {
      sourceRecordId: string;
      targetRecordId: string;
      linkType: string;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sourceRecordId', 'targetRecordId', 'linkType'],
          properties: {
            sourceRecordId: { type: 'string', format: 'uuid' },
            targetRecordId: { type: 'string', format: 'uuid' },
            linkType: { type: 'string', minLength: 1 },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              link: linkSchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { sourceRecordId, targetRecordId, linkType, metadata } = request.body;

      try {
        const link = await linksService.createLink({
          sourceRecordId,
          targetRecordId,
          linkType,
          metadata,
          createdBy: (request as any).user?.id,
        });

        return reply.status(201).send({ link });
      } catch (error: any) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          return reply.status(409).send({
            error: 'Link already exists',
            message: 'A link with this source, target, and type already exists',
          });
        }
        throw error;
      }
    }
  );

  // Get links for a record (both directions)
  fastify.get<{
    Params: { recordId: string };
    Querystring: { linkType?: string; direction?: 'outgoing' | 'incoming' | 'both' };
  }>(
    '/record/:recordId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['recordId'],
          properties: {
            recordId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            linkType: { type: 'string' },
            direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              outgoing: { type: 'array', items: linkWithRecordsSchema },
              incoming: { type: 'array', items: linkWithRecordsSchema },
            },
          },
        },
      },
    },
    async (request) => {
      const { recordId } = request.params;
      const { linkType, direction = 'both' } = request.query;

      if (direction === 'outgoing') {
        const outgoing = await linksService.getLinksFromRecord(recordId, linkType);
        return { outgoing, incoming: [] };
      }

      if (direction === 'incoming') {
        const incoming = await linksService.getLinksToRecord(recordId, linkType);
        return { outgoing: [], incoming };
      }

      return linksService.getAllLinksForRecord(recordId, linkType);
    }
  );

  // Get a specific link by ID
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
              link: linkSchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const link = await linksService.getLinkById(id);

      if (!link) {
        return reply.status(404).send({ error: 'Link not found' });
      }

      return { link };
    }
  );

  // Update link metadata
  fastify.patch<{
    Params: { id: string };
    Body: { metadata: Record<string, unknown> };
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
        body: {
          type: 'object',
          required: ['metadata'],
          properties: {
            metadata: { type: 'object' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              link: linkSchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { metadata } = request.body;

      const link = await linksService.updateLinkMetadata(id, metadata);

      if (!link) {
        return reply.status(404).send({ error: 'Link not found' });
      }

      return { link };
    }
  );

  // Delete a link by ID
  fastify.delete<{
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
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const deleted = await linksService.deleteLink(id);

      if (!deleted) {
        return reply.status(404).send({ error: 'Link not found' });
      }

      return reply.status(204).send();
    }
  );

  // Get all unique link types
  fastify.get(
    '/types',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              types: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async () => {
      const types = await linksService.getLinkTypes();
      return { types };
    }
  );
}
