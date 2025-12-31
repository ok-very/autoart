import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as searchService from './search.service.js';

interface SearchQuery {
  q: string;
  projectId?: string;
  limit?: string;
  fulltext?: string;
}

export async function searchRoutes(fastify: FastifyInstance) {
  // Resolve search for # autocomplete
  fastify.get<{ Querystring: SearchQuery }>(
    '/resolve',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const { q = '', projectId, limit, fulltext } = request.query;

      const parsedLimit = limit ? parseInt(limit, 10) : 20;
      const useFulltext = fulltext === 'true';

      // For fulltext search, require at least 1 character
      // For regular search, allow empty query to show recent items
      if (useFulltext && (!q || q.length < 1)) {
        return reply.send({ results: [] });
      }

      const results = useFulltext
        ? await searchService.fullTextSearch(q, projectId, parsedLimit)
        : await searchService.resolveSearch(q, projectId, parsedLimit);

      return reply.send({ results });
    }
  );
}
