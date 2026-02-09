/**
 * useComposerForm Hook
 *
 * Extracts the form state management logic from ComposerView into a reusable hook.
 * This hook manages arrangement selection, field values, references, and submission.
 *
 * Used by both ComposerView and ComposerPopout.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';

import type { RecordDefinition } from '@autoart/shared';
import { useRecordDefinitions, useCompose, useSubprocesses } from '../../api/hooks';

export interface UseComposerFormOptions {
  projectId?: string;
  contextId?: string;
  contextType?: string;
  parentActionId?: string;
  defaultArrangement?: string;
  onSuccess?: (actionId: string) => void;
}

export interface ComposerFormState {
  // Arrangement
  arrangements: RecordDefinition[];
  selectedArrangement: RecordDefinition | null;
  setArrangementId: (id: string | null) => void;

  // Context
  resolvedContextId: string | null;
  resolvedContextType: string;

  // Form fields
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  fieldValues: Map<string, unknown>;
  setFieldValue: (key: string, value: unknown) => void;

  // References
  references: Array<{ sourceRecordId: string; targetFieldKey: string; mode: string }>;
  addReference: (ref: { sourceRecordId: string; targetFieldKey: string }) => void;
  removeReference: (index: number) => void;

  // Submit
  canSubmit: boolean;
  isSubmitting: boolean;
  submitError: Error | null;
  handleSubmit: () => Promise<void>;

  // Reset
  reset: () => void;
  hasContent: boolean;
}

export function useComposerForm(options: UseComposerFormOptions): ComposerFormState {
  const {
    projectId,
    contextId: initialContextId,
    contextType: initialContextType = 'subprocess',
    defaultArrangement,
    onSuccess,
  } = options;

  // State
  const [userArrangementId, setUserArrangementId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldValues, setFieldValuesInternal] = useState<Map<string, unknown>>(new Map());
  const [references, setReferences] = useState<Array<{ sourceRecordId: string; targetFieldKey: string; mode: string }>>([]);

  // API hooks
  const { data: allDefinitions } = useRecordDefinitions();
  const { data: containerSubprocesses } = useSubprocesses(projectId ?? null);
  const compose = useCompose();

  // Filter to action arrangements only
  const arrangements = useMemo(() => {
    if (!allDefinitions) return [];
    return allDefinitions.filter((d) => d.definition_kind === 'action_arrangement');
  }, [allDefinitions]);

  // Derive default arrangement ID
  const defaultArrangementId = useMemo(() => {
    if (!arrangements.length) return null;
    if (defaultArrangement) {
      const match = arrangements.find(
        (a) => a.id === defaultArrangement || a.name === defaultArrangement
      );
      if (match) return match.id;
    }
    return arrangements[0]?.id ?? null;
  }, [arrangements, defaultArrangement]);

  // Effective arrangement selection
  const selectedArrangementId = userArrangementId ?? defaultArrangementId;

  const selectedArrangement = useMemo(() => {
    if (!selectedArrangementId || !arrangements.length) return null;
    return arrangements.find((r) => r.id === selectedArrangementId) || null;
  }, [selectedArrangementId, arrangements]);

  // Get subprocesses
  const subprocesses = useMemo(() => containerSubprocesses || [], [containerSubprocesses]);

  // Derive default subprocess ID
  const defaultSubprocessId = useMemo(() => subprocesses[0]?.id ?? null, [subprocesses]);

  // Effective context ID (user-provided or first subprocess)
  const resolvedContextId = initialContextId ?? defaultSubprocessId ?? null;
  const resolvedContextType = initialContextType as 'subprocess' | 'phase' | 'process' | 'project' | 'record';

  // Field value setters
  const setFieldValue = useCallback((key: string, value: unknown) => {
    setFieldValuesInternal((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  }, []);

  // Reference management
  const addReference = useCallback((ref: { sourceRecordId: string; targetFieldKey: string }) => {
    setReferences((prev) => [
      ...prev,
      { ...ref, mode: 'dynamic' },
    ]);
  }, []);

  const removeReference = useCallback((index: number) => {
    setReferences((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !resolvedContextId || !selectedArrangement) return;

    try {
      // Build field bindings
      const fieldBindings = [
        { fieldKey: 'title' },
        ...(description ? [{ fieldKey: 'description' }] : []),
        ...Array.from(fieldValues.entries())
          .filter(([_, v]) => v !== undefined && v !== '')
          .map(([k, _]) => ({ fieldKey: k })),
      ];

      // Build field value events
      const fieldValueEvents = [
        { fieldName: 'title', value: title.trim() },
        ...(description ? [{ fieldName: 'description', value: description.trim() }] : []),
        ...Array.from(fieldValues.entries())
          .filter(([_, v]) => v !== undefined && v !== '')
          .map(([k, v]) => ({ fieldName: k, value: v })),
      ];

      // Build references
      const referencesPayload = references.length > 0
        ? references.map((ref) => ({
            sourceRecordId: ref.sourceRecordId,
            targetFieldKey: ref.targetFieldKey,
            mode: 'dynamic' as const,
          }))
        : undefined;

      // Compose action
      const result = await compose.mutateAsync({
        action: {
          contextId: resolvedContextId,
          contextType: resolvedContextType,
          type: selectedArrangement.name,
          fieldBindings: fieldBindings.length > 0 ? fieldBindings : [{ fieldKey: 'title' }],
        },
        fieldValues: fieldValueEvents,
        ...(referencesPayload ? { references: referencesPayload } : {}),
      });

      // Call success callback
      if (onSuccess && result.action?.id) {
        onSuccess(result.action.id);
      }

      // Reset form
      setTitle('');
      setDescription('');
      setFieldValuesInternal(new Map());
      setReferences([]);
    } catch (err) {
      console.error('Failed to compose action:', err);
    }
  }, [title, description, fieldValues, references, resolvedContextId, resolvedContextType, selectedArrangement, compose, onSuccess]);

  // Reset handler
  const reset = useCallback(() => {
    setTitle('');
    setDescription('');
    setFieldValuesInternal(new Map());
    setReferences([]);
    setUserArrangementId(null);
  }, []);

  // Compute canSubmit
  const canSubmit = Boolean(
    title.trim() && resolvedContextId && selectedArrangement && !compose.isPending
  );

  // Compute hasContent
  const hasContent = Boolean(
    title.trim() ||
    description.trim() ||
    fieldValues.size > 0 ||
    references.length > 0
  );

  // Keyboard shortcut (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (canSubmit) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSubmit, handleSubmit]);

  return {
    // Arrangement
    arrangements,
    selectedArrangement,
    setArrangementId: setUserArrangementId,

    // Context
    resolvedContextId,
    resolvedContextType,

    // Form fields
    title,
    setTitle,
    description,
    setDescription,
    fieldValues,
    setFieldValue,

    // References
    references,
    addReference,
    removeReference,

    // Submit
    canSubmit,
    isSubmitting: compose.isPending,
    submitError: compose.error as Error | null,
    handleSubmit,

    // Reset
    reset,
    hasContent,
  };
}
