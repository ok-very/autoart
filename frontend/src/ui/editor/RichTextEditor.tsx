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
import { useRef, useMemo, useState, useCallback, useEffect } from 'react';

import type { ContextType } from '@autoart/shared';

import {
  type RichTextEditorConfig,
  mergeEditorConfig,
} from './EditorConfig';
import { createConfiguredExtensions, MentionAttributes } from './MentionExtension';
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
  contextId: _contextId,
  contextType: _contextType,
  editable = true,
  onChange,
  config: configOverride,
}: RichTextEditorProps) {
  // Merge config with defaults
  const config = useMemo(
    () => mergeEditorConfig(configOverride),
    [configOverride]
  );

  const [combobox, setCombobox] = useState<ComboboxState>({
    isOpen: false,
    triggerChar: '#',
    query: '',
    position: { top: 0, left: 0 },
    command: null,
  });

  // Use refs to store the latest values without causing extension recreation
  const comboboxRef = useRef(combobox);

  // Sync refs in effect to avoid accessing during render
  useEffect(() => {
    comboboxRef.current = combobox;
  }, [combobox]);

  // Handle selecting an item from the combobox
  const handleSelect = useCallback(
    (item: SearchResult, fieldKey?: string) => {
      const currentCombobox = comboboxRef.current;
      if (!currentCombobox.command) return;

      const label = fieldKey
        ? `${currentCombobox.triggerChar}${item.name}:${fieldKey}`
        : `${currentCombobox.triggerChar}${item.name}`;

      const attrs: MentionAttributes = {
        referenceId: null,
        label,
        mode: 'dynamic',
        recordId: item.id,
        fieldKey: fieldKey || null,
        triggerChar: currentCombobox.triggerChar,
      };

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

