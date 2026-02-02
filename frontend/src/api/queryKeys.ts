/**
 * Centralized Query Keys for TanStack Query
 *
 * This file provides a single source of truth for all query keys used across the application.
 * Following TanStack Query best practices:
 * - Keys are structured as arrays with progressive specificity
 * - Factory functions provide type-safe key generation
 * - Comments explain the purpose and usage of each key
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

import type { ContextType, ActionViewType, DerivedStatus } from '@autoart/shared';

/**
 * Query Keys Registry
 * Organized by domain for maintainability
 */
export const queryKeys = {
  // ============================================================================
  // AUTH
  // ============================================================================
  auth: {
    currentUser: () => ['auth', 'currentUser'] as const,
  },

  // ============================================================================
  // ADMIN
  // ============================================================================
  admin: {
    users: () => ['admin', 'users'] as const,
  },

  // ============================================================================
  // HIERARCHY (Projects, Nodes)
  // ============================================================================
  hierarchy: {
    all: () => ['hierarchy'] as const,
    projects: () => ['hierarchy', 'projects'] as const,
    projectTree: (projectId: string) => ['hierarchy', 'projectTree', projectId] as const,
    node: (nodeId: string) => ['hierarchy', 'node', nodeId] as const,
    nodePath: (nodeId: string) => ['hierarchy', 'nodePath', nodeId] as const,
  },

  // ============================================================================
  // RECORD DEFINITIONS
  // ============================================================================
  definitions: {
    all: () => ['definitions'] as const,
    list: () => ['definitions', 'list'] as const,
    filtered: (filters: Record<string, unknown>) => ['definitions', 'filtered', filters] as const,
    detail: (definitionId: string) => ['definitions', 'detail', definitionId] as const,
    projectTemplates: (projectId: string) => ['definitions', 'projectTemplates', projectId] as const,
    cloneStats: (definitionId: string) => ['definitions', 'cloneStats', definitionId] as const,
  },

  // ============================================================================
  // RECORDS
  // ============================================================================
  records: {
    all: () => ['records'] as const,
    list: (filters?: Record<string, unknown>) => ['records', 'list', filters] as const,
    detail: (recordId: string) => ['records', 'detail', recordId] as const,
    stats: (contextId: string, contextType: ContextType) => 
      ['records', 'stats', contextId, contextType] as const,
  },

  // ============================================================================
  // LINKS
  // ============================================================================
  links: {
    all: () => ['links'] as const,
    recordLinks: (recordId: string, direction: 'outgoing' | 'incoming' | 'both') => 
      ['links', 'record', recordId, direction] as const,
    linkTypes: () => ['links', 'types'] as const,
  },

  // ============================================================================
  // ACTIONS
  // ============================================================================
  actions: {
    all: () => ['actions'] as const,
    list: (limit?: number) => ['actions', 'all', limit] as const,
    byContext: (contextId: string, contextType: ContextType) => 
      ['actions', contextId, contextType] as const,
    byType: (actionType: string) => ['actions', 'byType', actionType] as const,
    byDefinition: (definitionId: string) => ['actions', 'byDefinition', definitionId] as const,
    detail: (actionId: string) => ['action', actionId] as const,
    containerActions: (projectId: string) => ['containerActions', projectId] as const,
    subprocesses: (projectId: string) => ['subprocesses', projectId] as const,
    childActions: (parentActionId: string) => ['childActions', parentActionId] as const,
  },

  // ============================================================================
  // ACTION VIEWS (Materialized Projections)
  // ============================================================================
  actionViews: {
    all: () => ['actionViews'] as const,
    byContext: (
      contextId: string,
      contextType: ContextType,
      view?: ActionViewType,
      status?: DerivedStatus
    ) => ['actionViews', contextId, contextType, view, status] as const,
    detail: (actionId: string) => ['actionView', actionId] as const,
    summary: (contextId: string, contextType: ContextType) => 
      ['actionViewsSummary', contextId, contextType] as const,
  },

  // ============================================================================
  // ACTION REFERENCES
  // ============================================================================
  actionReferences: {
    all: () => ['actionReferences'] as const,
    byAction: (actionId: string) => ['actionReferences', actionId] as const,
  },

  // ============================================================================
  // EVENTS
  // ============================================================================
  events: {
    all: () => ['events'] as const,
    byAction: (actionId: string) => ['events', 'action', actionId] as const,
    byContext: (contextId: string, contextType: ContextType) => 
      ['events', 'context', contextId, contextType] as const,
  },

  // ============================================================================
  // WORKFLOW SURFACE (Materialized DAG)
  // ============================================================================
  workflowSurface: {
    all: () => ['workflowSurface'] as const,
    nodes: (contextId: string) => ['workflowSurface', 'nodes', contextId] as const,
  },

  // ============================================================================
  // PROJECT LOG (Event Stream)
  // ============================================================================
  projectLog: {
    events: (
      projectId: string,
      contextType: ContextType,
      options: {
        includeSystem?: boolean;
        types?: string[];
        actorId?: string;
        limit?: number;
        offset?: number;
      }
    ) => ['projectLog', 'events', projectId, contextType, options] as const,
    eventCount: (projectId: string, options?: { includeSystem?: boolean }) => 
      ['projectLog', 'eventCount', projectId, options] as const,
  },

  // ============================================================================
  // INGESTION
  // ============================================================================
  ingestion: {
    parsers: () => ['ingestion', 'parsers'] as const,
    preview: (parserId: string, data: unknown) => ['ingestion', 'preview', parserId, data] as const,
  },

  // ============================================================================
  // IMPORTS
  // ============================================================================
  imports: {
    all: () => ['imports'] as const,
    batches: (projectId: string) => ['imports', 'batches', projectId] as const,
    batch: (batchId: string) => ['imports', 'batch', batchId] as const,
    classifications: (batchId: string) => ['imports', 'classifications', batchId] as const,
  },

  // ============================================================================
  // EXPORTS
  // ============================================================================
  exports: {
    all: () => ['exports'] as const,
    jobs: (projectId: string) => ['exports', 'jobs', projectId] as const,
    job: (jobId: string) => ['exports', 'job', jobId] as const,
  },

  // ============================================================================
  // SEARCH
  // ============================================================================
  search: {
    results: (query: string, filters?: Record<string, unknown>) => 
      ['search', 'results', query, filters] as const,
  },

  // ============================================================================
  // INTERPRETATION (AI/ML)
  // ============================================================================
  interpretation: {
    available: (batchId: string) => ['interpretation', 'available', batchId] as const,
    plan: (batchId: string) => ['interpretation', 'plan', batchId] as const,
  },

  // ============================================================================
  // FACT KINDS (Definition Review)
  // ============================================================================
  factKinds: {
    all: () => ['factKinds'] as const,
    definitions: () => ['factKinds', 'definitions'] as const,
    needingReview: () => ['factKinds', 'needingReview'] as const,
    stats: () => ['factKinds', 'stats'] as const,
    detail: (factKindId: string) => ['factKinds', 'detail', factKindId] as const,
  },
} as const;

/**
 * Helper type to extract query key types
 */
export type QueryKey<T extends (...args: any[]) => readonly any[]> = ReturnType<T>;

/**
 * Type-safe invalidation helpers
 */
export const invalidationHelpers = {
  invalidateAction: (queryClient: any, actionId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.actions.detail(actionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.actionViews.detail(actionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.events.byAction(actionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.actionReferences.byAction(actionId) });
  },
  invalidateContext: (queryClient: any, contextId: string, contextType: ContextType) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.actions.byContext(contextId, contextType) });
    // Invalidate all action views for this context (partial match)
    queryClient.invalidateQueries({ queryKey: ['actionViews', contextId] });
    queryClient.invalidateQueries({ queryKey: queryKeys.events.byContext(contextId, contextType) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workflowSurface.nodes(contextId) });
  },
  invalidateHierarchy: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all() });
  },
};
