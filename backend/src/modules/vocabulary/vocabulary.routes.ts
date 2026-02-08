/**
 * Vocabulary Routes
 *
 * API endpoints for action vocabulary autocomplete:
 * - GET /api/vocabulary/suggestions?prefix=rev&limit=10
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { getSuggestions } from './vocabulary.service.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const SuggestionsQuerySchema = z.object({
  prefix: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const SuggestionItemSchema = z.object({
  verb: z.string(),
  noun: z.string(),
  adjective: z.string().nullable(),
  frequency: z.number(),
});

const SuggestionsResponseSchema = z.object({
  suggestions: z.array(SuggestionItemSchema),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function vocabularyRoutes(app: FastifyInstance) {
  app.get(
    '/suggestions',
    {
      schema: {
        querystring: SuggestionsQuerySchema,
        response: {
          200: SuggestionsResponseSchema,
        },
      },
    },
    async (request) => {
      const { prefix, limit } = request.query as z.infer<typeof SuggestionsQuerySchema>;
      const suggestions = await getSuggestions(prefix, limit);
      return { suggestions };
    },
  );
}
