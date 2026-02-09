/**
 * ComposerPopoutContent
 *
 * The actual composer form content for the popout overlay.
 * Uses useComposerForm hook for state management.
 *
 * Sections:
 * 1. Context indicator - shows project/subprocess targeting
 * 2. Arrangement picker - grid of action arrangements
 * 3. Title input - required field
 * 4. Schema fields - dynamic fields from arrangement (expandable)
 * 5. Event preview - read-only preview of events that will be emitted
 * 6. Submit footer - button + shortcut hint
 */

import { useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button, TextInput, Text, Stack, Spinner } from '@autoart/ui';
import type { ComposerPopoutContext } from '../../stores/uiStore';
import { useComposerForm } from './useComposerForm';
import { ContextIndicator } from './ContextIndicator';
import { EventPreview, buildPendingEvents } from './EventPreview';

export interface ComposerPopoutContentProps {
  context: ComposerPopoutContext | null;
  onHasContentChange?: (hasContent: boolean) => void;
  onClose?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
}

export function ComposerPopoutContent({
  context,
  onHasContentChange,
  onClose,
  onDragStart,
}: ComposerPopoutContentProps) {
  const [schemaFieldsExpanded, setSchemaFieldsExpanded] = useState(false);

  const form = useComposerForm({
    projectId: context?.projectId,
    contextId: context?.contextId,
    contextType: context?.contextType,
    parentActionId: context?.parentActionId,
    defaultArrangement: context?.defaultArrangement,
    onSuccess: () => {
      onClose?.();
    },
  });

  // Notify parent of content state
  useEffect(() => {
    onHasContentChange?.(form.hasContent);
  }, [form.hasContent, onHasContentChange]);

  // Extract schema fields from selected arrangement (exclude title/description)
  const schemaFields = useMemo(() => {
    if (!form.selectedArrangement) return [];
    const raw = form.selectedArrangement.schema_config;
    if (!raw || typeof raw !== 'object') return [];
    const config = raw as { fields?: Array<{ key: string; label?: string; type?: string; required?: boolean }> };
    return (config.fields || []).filter(
      (f) => f.key !== 'title' && f.key !== 'description' && f.key !== 'status'
    );
  }, [form.selectedArrangement]);

  // Build pending events for preview
  const pendingEvents = useMemo(() => {
    if (!form.selectedArrangement) return [];
    return buildPendingEvents({
      actionType: form.selectedArrangement.name,
      title: form.title,
      description: form.description,
      fieldValues: Array.from(form.fieldValues.entries()).map(([key, value]) => ({
        key,
        value,
      })),
      references: form.references.map((ref) => ({
        recordName: ref.sourceRecordId.slice(0, 8), // Placeholder - would need to fetch record name
        targetFieldKey: ref.targetFieldKey,
      })),
    });
  }, [form.selectedArrangement, form.title, form.description, form.fieldValues, form.references]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 1. Context Indicator */}
        <div className="pb-2 border-b border-ws-panel-border">
          <ContextIndicator
            context={{
              projectId: context?.projectId ?? null,
              projectTitle: null, // Derived by hook
              contextId: context?.contextId ?? null,
              contextTitle: null, // Derived by hook
              contextType: context?.contextType ?? 'subprocess',
              parentActionId: context?.parentActionId ?? null,
              parentActionTitle: null, // Derived by hook
            }}
            size="sm"
          />
        </div>

        {/* 2. Arrangement Picker */}
        {form.arrangements.length > 0 && (
          <div>
            <Text size="xs" weight="medium" className="text-ws-text-secondary mb-2">
              Action Type
            </Text>
            <div className="grid grid-cols-3 gap-2">
              {form.arrangements.map((arrangement) => {
                const isSelected = form.selectedArrangement?.id === arrangement.id;
                const styling = arrangement.styling as { icon?: string; color?: string } | undefined;
                return (
                  <button
                    key={arrangement.id}
                    type="button"
                    onClick={() => form.setArrangementId(arrangement.id)}
                    className={clsx(
                      'flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition-all text-center',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-ws-panel-border hover:border-slate-300 hover:bg-ws-bg text-ws-text-secondary'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm',
                        isSelected ? 'bg-blue-600 text-white' : 'bg-ws-bg text-ws-muted'
                      )}
                    >
                      {styling?.icon || arrangement.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium truncate w-full">
                      {arrangement.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Title Input */}
        <div>
          <label className="block text-xs font-medium text-ws-text-secondary mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <TextInput
            value={form.title}
            onChange={(e) => form.setTitle(e.target.value)}
            placeholder={`Enter ${form.selectedArrangement?.name || 'action'} title...`}
            className="w-full"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-ws-text-secondary mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => form.setDescription(e.target.value)}
            placeholder="Optional description..."
            className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            rows={3}
          />
        </div>

        {/* 4. Schema Fields (Expandable) */}
        {schemaFields.length > 0 && (
          <div className="border border-ws-panel-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setSchemaFieldsExpanded(!schemaFieldsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 bg-ws-bg hover:bg-slate-100 transition-colors"
            >
              <Text size="xs" weight="medium" className="text-ws-text-secondary">
                Additional Fields ({schemaFields.length})
              </Text>
              {schemaFieldsExpanded ? (
                <ChevronUp size={14} className="text-ws-muted" />
              ) : (
                <ChevronDown size={14} className="text-ws-muted" />
              )}
            </button>
            {schemaFieldsExpanded && (
              <div className="px-3 py-3 space-y-3 border-t border-ws-panel-border">
                {schemaFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                      {field.label || field.key}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={(form.fieldValues.get(field.key) as string) || ''}
                        onChange={(e) => form.setFieldValue(field.key, e.target.value)}
                        placeholder={`Enter ${field.label || field.key}...`}
                        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                        rows={3}
                      />
                    ) : field.type === 'date' ? (
                      <input
                        type="date"
                        value={(form.fieldValues.get(field.key) as string) || ''}
                        onChange={(e) => form.setFieldValue(field.key, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        value={(form.fieldValues.get(field.key) as number) || ''}
                        onChange={(e) =>
                          form.setFieldValue(
                            field.key,
                            e.target.value === '' ? undefined : e.target.valueAsNumber
                          )
                        }
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    ) : (
                      <TextInput
                        value={(form.fieldValues.get(field.key) as string) || ''}
                        onChange={(e) => form.setFieldValue(field.key, e.target.value)}
                        placeholder={`Enter ${field.label || field.key}...`}
                        className="w-full"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Event Preview */}
        {pendingEvents.length > 0 && (
          <EventPreview
            events={pendingEvents}
            size="sm"
            collapsedLimit={3}
          />
        )}

        {/* Error display */}
        {form.submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {form.submitError.message || 'Failed to create action'}
          </div>
        )}
      </div>

      {/* 6. Submit Footer (sticky) */}
      <div className="px-4 py-3 border-t border-ws-panel-border bg-ws-bg shrink-0">
        <Stack gap="sm">
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex-1 min-w-0 cursor-move select-none"
              onMouseDown={onDragStart}
            >
              <Text size="xs" className="text-ws-muted">
                {form.selectedArrangement ? (
                  <>
                    Creating <strong>{form.selectedArrangement.name}</strong>
                    {' · '}
                    <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">Ctrl+Enter</kbd>
                  </>
                ) : (
                  'Select an action type'
                )}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              {onClose && (
                <Button onClick={onClose} variant="secondary" size="sm">
                  Close
                </Button>
              )}
              <Button
                onClick={form.handleSubmit}
                disabled={!form.canSubmit}
                variant={form.canSubmit ? 'primary' : 'secondary'}
                size="sm"
              >
                {form.isSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </Stack>
      </div>
    </div>
  );
}
