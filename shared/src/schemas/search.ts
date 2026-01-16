import { z } from 'zod';

/**
 * Search Result Schema
 * Unified search result for both records and nodes
 */
export const SearchResultSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['record', 'node']),
  name: z.string(),
  path: z.string().optional(), // Full hierarchy path e.g. "Project.Stage.Subprocess"
  nodeType: z.string().optional(),
  definitionId: z.string().uuid().optional(),
  definitionName: z.string().optional(),
  fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
  })).optional(),
  matchedAlias: z.string().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Search Query Input Schema
 */
export const SearchQueryInputSchema = z.object({
  query: z.string().min(1),
  types: z.array(z.enum(['record', 'node'])).optional(),
  projectId: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export type SearchQueryInput = z.infer<typeof SearchQueryInputSchema>;

/**
 * API Response Schema
 */
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
});
