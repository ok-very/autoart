/**
 * RichTextEditor Component
 *
 * Configuration-driven rich text editor with TipTap.
 * Supports record references (#record:field) and extensible styling.
 *
 * Architecture:
 * - Config-driven: Extensions built from EditorConfig
 * - Context-aware: Uses contextId + contextType for references (not taskId)
 * - Extensible: Add custom extensions via config.extensions
 */

import { useEditor, EditorContent } from '@tiptap/react';
import { useRef, useMemo, useState, useCallback } from 'react';

import type { ContextType } from '@autoart/shared';

import {
  type RichTextEditorConfig,
  mergeEditorConfig,
  DEFAULT_EDITOR_CONFIG
} from './EditorConfig';
import { createConfiguredExtensions, MentionAttributes } from './MentionExtension';
import { useCreateReference } from '../../api/hooks';
import type { SearchResult } from '../../types';
import { RecordSearchCombobox } from './RecordSearchCombobox';



// ============================================================================
// TYPES
// ============================================================================

export interface RichTextEditorProps {
  /** Document content (TipTap JSON format) */
  content: unknown;
  /** Context entity ID for reference creation */
  contextId: string;
  /** Context type for reference creation */
  contextType: ContextType;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Callback when content changes */
  onChange?: (content: unknown) => void;
  /** Editor configuration override */
  config?: Partial<RichTextEditorConfig>;
}

/** @deprecated Use RichTextEditorProps with contextId/contextType instead */
export interface LegacyRichTextEditorProps {
  content: unknown;
  /** @deprecated Use contextId instead */
  taskId: string;
  editable?: boolean;
  onChange?: (content: unknown) => void;
}

interface ComboboxState {
  isOpen: boolean;
  triggerChar: '#' | '@';
  query: string;
  position: { top: number; left: number };
  command: ((attrs: MentionAttributes) => void) | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RichTextEditor({
  content,
  contextId,
  contextType: _contextType, // Reserved for scoped reference creation
  editable = true,
  onChange,
  config: configOverride,
}: RichTextEditorProps) {
  // Merge config with defaults
  const config = useMemo(
    () => mergeEditorConfig(configOverride),
    [configOverride]
  );

  const createReference = useCreateReference();
  const [combobox, setCombobox] = useState<ComboboxState>({
    isOpen: false,
    triggerChar: '#',
    query: '',
    position: { top: 0, left: 0 },
    command: null,
  });

  // Use refs to store the latest values without causing extension recreation
  const contextIdRef = useRef(contextId);
  const createReferenceRef = useRef(createReference);
  const comboboxRef = useRef(combobox);

  // Sync refs in effect to avoid accessing during render
  useEffect(() => {
    contextIdRef.current = contextId;
    createReferenceRef.current = createReference;
    comboboxRef.current = combobox;
  }, [contextId, createReference, combobox]);

  // Handle selecting an item from the combobox
  const handleSelect = useCallback(
    async (item: SearchResult, fieldKey?: string) => {
      const currentCombobox = comboboxRef.current;
      if (!currentCombobox.command) return;

      let attrs: MentionAttributes;

      if (item.type === 'record' && fieldKey) {
        try {
          // Create reference using contextId (backward compat: still uses taskId param name)
          const result = await createReferenceRef.current.mutateAsync({
            taskId: contextIdRef.current,
            sourceRecordId: item.id,
            targetFieldKey: fieldKey,
            mode: 'dynamic',
          });

          attrs = {
            referenceId: result.reference.id,
            label: `${currentCombobox.triggerChar}${item.name}:${fieldKey}`,
            mode: 'dynamic',
            recordId: item.id,
            fieldKey,
            triggerChar: currentCombobox.triggerChar,
          };
        } catch (err) {
          console.error('Failed to create reference:', err);
          setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
          return;
        }
      } else {
        attrs = {
          referenceId: null,
          label: `${currentCombobox.triggerChar}${item.name}${fieldKey ? `:${fieldKey}` : ''}`,
          mode: 'dynamic',
          recordId: item.id,
          fieldKey: fieldKey || null,
          triggerChar: currentCombobox.triggerChar,
        };
      }

      currentCombobox.command(attrs);
      setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
    },
    []
  );

  const handleClose = useCallback(() => {
    setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
  }, []);

  // Create suggestion render function for trigger characters
  const createSuggestionRender = useCallback((triggerChar: '#' | '@') => {
    return () => {
      return {
        onStart: (props: {
          query: string;
          clientRect?: (() => DOMRect | null) | null;
          command: (attrs: MentionAttributes) => void;
        }) => {
          if (!props.clientRect) return;

          const rect = props.clientRect();
          if (!rect) return;

          setCombobox({
            isOpen: true,
            triggerChar,
            query: props.query,
            position: {
              top: rect.bottom + window.scrollY + 4,
              left: rect.left + window.scrollX,
            },
            command: props.command,
          });
        },

        onUpdate: (props: {
          query: string;
          clientRect?: (() => DOMRect | null) | null;
          command: (attrs: MentionAttributes) => void;
        }) => {
          if (!props.clientRect) return;

          const rect = props.clientRect();
          if (!rect) return;

          setCombobox((prev) => ({
            ...prev,
            query: props.query,
            position: {
              top: rect.bottom + window.scrollY + 4,
              left: rect.left + window.scrollX,
            },
            command: props.command,
          }));
        },

        onKeyDown: (_props: { event: KeyboardEvent }) => {
          // Let the combobox handle all keyboard events when open
          if (comboboxRef.current.isOpen) {
            return true;
          }
          return false;
        },

        onExit: () => {
          setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
        },
      };
    };
  }, []);

  // Build extensions from config
  const extensions = useMemo(() => {
    const suggestionHandlers: { '#'?: () => ReturnType<ReturnType<typeof createSuggestionRender>>; '@'?: () => ReturnType<ReturnType<typeof createSuggestionRender>> } = {};

    if (config.styles.recordReferences) {
      suggestionHandlers['#'] = createSuggestionRender('#');
    }
    if (config.styles.userMentions) {
      suggestionHandlers['@'] = createSuggestionRender('@');
    }

    return createConfiguredExtensions(config, suggestionHandlers);
  }, [config, createSuggestionRender]);

  const editor = useEditor({
    extensions,
    content: content && typeof content === 'object' ? (content as object) : undefined,
    editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getJSON());
      }
    },
  });

  if (!editor) return null;

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        className={editable ? 'prose prose-sm max-w-none' : ''}
      />

      {/* Inline Combobox Search */}
      {combobox.isOpen && (
        <RecordSearchCombobox
          query={combobox.query}
          triggerChar={combobox.triggerChar}
          position={combobox.position}
          onSelect={handleSelect}
          onClose={handleClose}
          showFieldSelection={combobox.triggerChar === '#'}
        />
      )}
    </div>
  );
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use RichTextEditor with contextId/contextType props
 */
export function LegacyRichTextEditor({
  content,
  taskId,
  editable,
  onChange
}: LegacyRichTextEditorProps) {
  return (
    <RichTextEditor
      content={content}
      contextId={taskId}
      contextType="subprocess"
      editable={editable}
      onChange={onChange}
      config={DEFAULT_EDITOR_CONFIG}
    />
  );
}
