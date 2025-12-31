import { useRef, useMemo, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { createMentionExtension, MentionAttributes } from './MentionExtension';
import { RecordSearchCombobox } from '../common/RecordSearchCombobox';
import { useCreateReference } from '../../api/hooks';
import type { SearchResult } from '../../types';

interface RichTextEditorProps {
  content: unknown;
  taskId: string;
  editable?: boolean;
  onChange?: (content: unknown) => void;
}

interface ComboboxState {
  isOpen: boolean;
  triggerChar: '#';  // Only # trigger - @ is reserved for user tagging
  query: string;
  position: { top: number; left: number };
  command: ((attrs: MentionAttributes) => void) | null;
}

export function RichTextEditor({ content, taskId, editable = true, onChange }: RichTextEditorProps) {
  const createReference = useCreateReference();
  const [combobox, setCombobox] = useState<ComboboxState>({
    isOpen: false,
    triggerChar: '#',
    query: '',
    position: { top: 0, left: 0 },
    command: null,
  });

  // Use refs to store the latest values without causing extension recreation
  const taskIdRef = useRef(taskId);
  const createReferenceRef = useRef(createReference);
  taskIdRef.current = taskId;
  createReferenceRef.current = createReference;

  // Ref to track combobox state for keyboard handling
  const comboboxRef = useRef(combobox);
  comboboxRef.current = combobox;

  // Handle selecting an item from the combobox
  const handleSelect = useCallback(
    async (item: SearchResult, fieldKey?: string) => {
      const currentCombobox = comboboxRef.current;
      if (!currentCombobox.command) return;

      let attrs: MentionAttributes;

      if (item.type === 'record' && fieldKey) {
        try {
          const result = await createReferenceRef.current.mutateAsync({
            taskId: taskIdRef.current,
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

  // Create suggestion render function for the # trigger character
  const createSuggestionRender = useCallback((triggerChar: '#') => {
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

  // Memoize extensions to prevent TipTap plugin key conflicts
  // Note: Only # trigger is used for record references
  // @ is reserved for user tagging (future feature)
  const extensions = useMemo(() => {
    const hashMention = createMentionExtension('#', {
      render: createSuggestionRender('#'),
    });

    return [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start typing... Use # to reference records',
      }),
      hashMention,
    ];
  }, [createSuggestionRender]);

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
