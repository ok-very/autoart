import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

/**
 * CRUD Hook Factory
 *
 * Generates standardized TanStack Query hooks for CRUD operations.
 * Reduces boilerplate for resources that follow the standard pattern:
 * - list: GET /resource
 * - get: GET /resource/:id
 * - create: POST /resource
 * - update: PATCH /resource/:id
 * - delete: DELETE /resource/:id
 */

export interface CrudHookConfig<T> {
  /** Resource name for query keys (e.g., 'records', 'definitions') */
  queryKey: string;
  /** Base API path (e.g., '/records', '/records/definitions') */
  basePath: string;
  /** Response wrapper key for list operations (e.g., 'records', 'definitions') */
  listResponseKey: string;
  /** Response wrapper key for single item operations (e.g., 'record', 'definition') */
  singleResponseKey: string;
  /** Additional query keys to invalidate on mutations */
  invalidateKeys?: string[];
  /** Stale time for queries in ms */
  staleTime?: number;
  /** Phantom type marker - do not use */
  _phantom?: T;
}

export interface CrudHooks<T, TCreateInput, TUpdateInput> {
  useList: (enabled?: boolean) => ReturnType<typeof useQuery<T[]>>;
  useGet: (id: string | null) => ReturnType<typeof useQuery<T>>;
  useCreate: () => ReturnType<typeof useMutation<{ [key: string]: T }, Error, TCreateInput>>;
  useUpdate: () => ReturnType<typeof useMutation<{ [key: string]: T }, Error, { id: string } & TUpdateInput>>;
  useDelete: () => ReturnType<typeof useMutation<unknown, Error, string>>;
}

/**
 * Creates a set of CRUD hooks for a resource.
 *
 * @example
 * const recordHooks = createCrudHooks<DataRecord>({
 *   queryKey: 'records',
 *   basePath: '/records',
 *   listResponseKey: 'records',
 *   singleResponseKey: 'record',
 * });
 *
 * // Usage:
 * const { data } = recordHooks.useList();
 * const { data } = recordHooks.useGet(id);
 * const createMutation = recordHooks.useCreate();
 */
export function createCrudHooks<
  T,
  TCreateInput = Partial<T>,
  TUpdateInput = Partial<T>
>(config: CrudHookConfig<T>): CrudHooks<T, TCreateInput, TUpdateInput> {
  const {
    queryKey,
    basePath,
    listResponseKey,
    singleResponseKey,
    invalidateKeys = [],
    staleTime,
  } = config;

  function useList(enabled = true) {
    return useQuery({
      queryKey: [queryKey],
      queryFn: () =>
        api.get<{ [key: string]: T[] }>(basePath).then((r) => r[listResponseKey]),
      enabled,
      staleTime,
    });
  }

  function useGet(id: string | null) {
    return useQuery({
      queryKey: [queryKey, id],
      queryFn: () =>
        api.get<{ [key: string]: T }>(`${basePath}/${id}`).then((r) => r[singleResponseKey]),
      enabled: !!id,
      staleTime,
    });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (data: TCreateInput) =>
        api.post<{ [key: string]: T }>(basePath, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      },
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, ...data }: { id: string } & TUpdateInput) =>
        api.patch<{ [key: string]: T }>(`${basePath}/${id}`, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      },
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => api.delete(`${basePath}/${id}`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      },
    });
  }

  return {
    useList,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
  };
}

/**
 * Creates a filtered list hook with query parameters.
 * Useful for resources that support filtering (e.g., records with definitionId filter).
 */
export function createFilteredListHook<T, TFilters extends Record<string, unknown>>(config: {
  queryKey: string;
  basePath: string;
  responseKey: string;
  buildParams: (filters: TFilters) => URLSearchParams;
}) {
  const { queryKey, basePath, responseKey, buildParams } = config;

  return function useFilteredList(filters?: TFilters) {
    return useQuery({
      queryKey: [queryKey, filters],
      queryFn: () => {
        const params = filters ? buildParams(filters) : new URLSearchParams();
        return api.get<{ [key: string]: T[] }>(`${basePath}?${params}`).then((r) => r[responseKey]);
      },
    });
  };
}
