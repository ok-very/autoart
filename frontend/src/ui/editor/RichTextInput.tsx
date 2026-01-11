import Placeholder from '@tiptap/extension-placeholder';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { clsx } from 'clsx';
import { useRef, useMemo, useState, useCallback, useEffect } from 'react';

import { createMentionExtension, MentionAttributes } from './MentionExtension';
import { useCreateReference } from '../../api/hooks';
import type { SearchResult } from '../../types';
import { RecordSearchCombobox } from '../common/RecordSearchCombobox';


interface RichTextInputProps {
  value: unknown; // string or JSON
  onChange: (value: unknown) => void;
  multiline?: boolean;
  taskId?: string; // Optional: if provided, creates DB references
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  currentRecordId?: string; // To exclude self from search
}

interface ComboboxState {
  isOpen: boolean;
  triggerChar: '#';
  query: string;
  position: { top: number; left: number };
  command: ((attrs: MentionAttributes) => void) | null;
}

export function RichTextInput({
  value,
  onChange,
  multiline = false,
  taskId,
  placeholder,
  readOnly = false,
  className,
  currentRecordId
}: RichTextInputProps) {
  const createReference = useCreateReference();
  const [combobox, setCombobox] = useState<ComboboxState>({
    isOpen: false,
    triggerChar: '#',
    query: '',
    position: { top: 0, left: 0 },
    command: null,
  });

  // Use refs to store latest values for callbacks
  const taskIdRef = useRef(taskId);
  const createReferenceRef = useRef(createReference);
  taskIdRef.current = taskId;
  createReferenceRef.current = createReference;

  // Handle selecting an item from the combobox
  const handleSelect = useCallback(
    async (item: SearchResult, fieldKey?: string) => {
      const command = combobox.command;
      if (!command) return;

      let attrs: MentionAttributes;

      // If we have a taskId, we can create a robust database reference
      if (taskIdRef.current && item.type === 'record' && fieldKey) {
        try {
          const result = await createReferenceRef.current.mutateAsync({
            taskId: taskIdRef.current,
            sourceRecordId: item.id,
            targetFieldKey: fieldKey,
            mode: 'dynamic',
          });

          attrs = {
            referenceId: result.reference.id,
            label: `${combobox.triggerChar}${item.name}:${fieldKey}`,
            mode: 'dynamic',
            recordId: item.id,
            fieldKey,
            triggerChar: combobox.triggerChar,
          };
        } catch (err) {
          console.error('Failed to create reference:', err);
          setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
          return;
        }
      } else {
        // Direct reference (embedded in document, no DB reference record)
        // Used for fields in records that reference other records directly
        attrs = {
          referenceId: null,
          label: `${combobox.triggerChar}${item.name}${fieldKey ? `:${fieldKey}` : ''}`,
          mode: 'dynamic', // Default to dynamic fetch
          recordId: item.id,
          fieldKey: fieldKey || null,
          triggerChar: combobox.triggerChar,
        };
      }

      command(attrs);
      setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
    },
    [combobox]
  );

  const handleClose = useCallback(() => {
    setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
  }, []);

  // Create suggestion render function
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
          if (combobox.isOpen) return true;
          return false;
        },
        onExit: () => {
          setCombobox((prev) => ({ ...prev, isOpen: false, command: null }));
        },
      };
    };
  }, [combobox.isOpen]);

  const extensions = useMemo(() => {
    return [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        hardBreak: multiline ? undefined : false, // Disable line breaks if not multiline
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Type...',
      }),
      createMentionExtension('#', {
        render: createSuggestionRender('#'),
      }),
    ];
  }, [multiline, placeholder, createSuggestionRender]);

  // Normalize value to valid TipTap content
  const normalizedContent = useMemo(() => {
    // Handle null/undefined
    if (value == null || value === '') {
      return { type: 'doc', content: [] };
    }

    // Handle string
    if (typeof value === 'string') {
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] };
    }

    // Handle array (e.g., ['Engineering'] from tags field) - join as text
    if (Array.isArray(value)) {
      const text = value.map(v => String(v)).join(', ');
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
    }

    // Handle object - assume it's TipTap JSON, but validate structure
    if (typeof value === 'object' && 'type' in value && value.type === 'doc') {
      return value as object;
    }

    // Fallback: stringify whatever it is
    const text = JSON.stringify(value);
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
  }, [value]);

  const editor = useEditor({
    extensions,
    content: normalizedContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: clsx(
          'prose prose-sm max-w-none focus:outline-none min-h-[1.5em]',
          !multiline && 'truncate'
        ),
      },
      handleKeyDown: (_view, event) => {
        // Prevent newlines in single-line mode
        if (!multiline && event.key === 'Enter') {
          return true; // block
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      // Return JSON content
      onChange(editor.getJSON());
    },
  });

  // Update content if value changes externally (and isn't just our own update loop)
  // This is tricky with TipTap. Simple approach: only update if editor is empty or radically different?
  // For now, rely on initial render. React updates to 'value' won't re-render editor unless we force it.
  // Ideally, use useEffect to setContent if value changes and is different.

  useEffect(() => {
    if (editor && value) {
      // Simple check: if value changed and it's not what we currently have
      // But 'value' passed in might be the JSON we just emitted.
      // Comparing JSON objects is expensive.
      // For this prototype, we assume controlled component behavior is "loose" or rely on key-remounting if needed.
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={clsx(
      "relative rounded-md border border-slate-300 shadow-sm transition-all bg-white",
      "focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500",
      readOnly && "bg-slate-50 opacity-70 pointer-events-none",
      className
    )}>
      <EditorContent
        editor={editor}
        className={clsx(
          "px-3 py-2",
          !multiline && "overflow-hidden whitespace-nowrap"
        )}
      />

      {combobox.isOpen && (
        <RecordSearchCombobox
          query={combobox.query}
          triggerChar={combobox.triggerChar}
          position={combobox.position}
          onSelect={handleSelect}
          onClose={handleClose}
          showFieldSelection={true}
          excludeRecordId={currentRecordId}
        />
      )}
    </div>
  );
}
