import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  IntakeForm,
  IntakeFormWithPages,
  IntakeSubmission,
  CreateIntakeFormInput,
  UpdateIntakeFormInput,
  UpsertIntakeFormPageInput,
} from '@autoart/shared';
import { api } from '../client';

// ==================== FORMS ====================

export function useIntakeForms() {
  return useQuery({
    queryKey: ['intake-forms'],
    queryFn: () =>
      api.get<{ forms: IntakeForm[] }>('/intake/forms').then((r) => r.forms),
  });
}

export function useIntakeForm(id: string | null) {
  return useQuery({
    queryKey: ['intake-form', id],
    queryFn: () =>
      api
        .get<{ form: IntakeFormWithPages }>(`/intake/forms/${id}`)
        .then((r) => r.form),
    enabled: !!id,
  });
}

export function useCreateIntakeForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIntakeFormInput) =>
      api.post<{ form: IntakeForm }>('/intake/forms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intake-forms'] });
    },
  });
}

export function useUpdateIntakeForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateIntakeFormInput) =>
      api.patch<{ form: IntakeForm }>(`/intake/forms/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intake-forms'] });
      queryClient.invalidateQueries({ queryKey: ['intake-form', variables.id] });
    },
  });
}

export function useUpsertIntakeFormPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      formId,
      ...data
    }: { formId: string } & UpsertIntakeFormPageInput) =>
      api.put(`/intake/forms/${formId}/pages`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['intake-form', variables.formId],
      });
    },
  });
}

export function useDeleteIntakeFormPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, pageIndex }: { formId: string; pageIndex: number }) =>
      api.delete(`/intake/forms/${formId}/pages/${pageIndex}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['intake-form', variables.formId],
      });
    },
  });
}

// ==================== SUBMISSIONS ====================

interface SubmissionFilters {
  limit?: number;
  offset?: number;
}

export function useIntakeSubmissions(formId: string | null, filters?: SubmissionFilters) {
  return useQuery({
    queryKey: ['intake-submissions', formId, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.offset) params.set('offset', String(filters.offset));
      return api
        .get<{ submissions: IntakeSubmission[] }>(
          `/intake/forms/${formId}/submissions?${params}`
        )
        .then((r) => r.submissions);
    },
    enabled: !!formId,
  });
}
