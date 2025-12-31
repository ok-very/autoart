import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { MentionChip } from './MentionChip';

export interface MentionAttributes {
  referenceId: string | null;
  label: string;
  mode: 'static' | 'dynamic';
  recordId: string | null;
  fieldKey: string | null;
  triggerChar: '@' | '#';
  snapshot?: unknown; // For static mode without a database reference
}

export interface MentionOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      insertMention: (attrs: MentionAttributes) => ReturnType;
    };
  }
}

export const MentionExtension = Node.create<MentionOptions>({
  name: 'mention',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: '#',
        allowSpaces: false,
        allowedPrefixes: null, // Allow trigger at start of line
        startOfLine: false,
        command: ({ editor, range, props }) => {
          // Delete the trigger character and query
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: this.name,
              attrs: props,
            })
            .run();
        },
      },
    };
  },

  addAttributes() {
    return {
      referenceId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-reference-id'),
        renderHTML: (attributes) => ({
          'data-reference-id': attributes.referenceId,
        }),
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-label') || element.textContent,
        renderHTML: (attributes) => ({
          'data-label': attributes.label,
        }),
      },
      mode: {
        default: 'dynamic',
        parseHTML: (element) => element.getAttribute('data-mode') || 'dynamic',
        renderHTML: (attributes) => ({
          'data-mode': attributes.mode,
        }),
      },
      recordId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-record-id'),
        renderHTML: (attributes) => ({
          'data-record-id': attributes.recordId,
        }),
      },
      fieldKey: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field-key'),
        renderHTML: (attributes) => ({
          'data-field-key': attributes.fieldKey,
        }),
      },
      triggerChar: {
        default: '#',
        parseHTML: (element) => element.getAttribute('data-trigger') || '#',
        renderHTML: (attributes) => ({
          'data-trigger': attributes.triggerChar,
        }),
      },
      snapshot: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute('data-snapshot');
          try {
            return val ? JSON.parse(val) : null;
          } catch {
            return val;
          }
        },
        renderHTML: (attributes) => ({
          'data-snapshot': attributes.snapshot ? JSON.stringify(attributes.snapshot) : null,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="mention"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const triggerChar = node.attrs.triggerChar || '#';
    const chipClass = triggerChar === '@' ? 'mention-at' : 'mention-hash';
    const modeClass = node.attrs.mode === 'static' ? 'token-static' : 'token-dynamic';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mention',
        class: `mention ${chipClass} ${modeClass}`,
      }),
      node.attrs.label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionChip);
  },

  addCommands() {
    return {
      insertMention:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

// Create stable plugin keys outside of component render cycle
const atMentionPluginKey = new PluginKey('atMentionSuggestion');
const hashMentionPluginKey = new PluginKey('hashMentionSuggestion');

/**
 * Factory to create a configured mention extension for a specific trigger character.
 */
export function createMentionExtension(
  triggerChar: '@' | '#',
  suggestionOptions: Partial<Omit<SuggestionOptions, 'editor'>>
) {
  const pluginKey = triggerChar === '@' ? atMentionPluginKey : hashMentionPluginKey;

  return MentionExtension.extend({
    name: triggerChar === '@' ? 'atMention' : 'hashMention',
  }).configure({
    HTMLAttributes: {
      class: triggerChar === '@' ? 'mention mention-at' : 'mention mention-hash',
    },
    suggestion: {
      char: triggerChar,
      allowSpaces: false,
      allowedPrefixes: null,
      startOfLine: false,
      pluginKey,
      // Provide a minimal items function - actual data fetching happens in render component
      items: ({ query }: { query: string }) => {
        // Return a placeholder array - the render component handles actual search
        // TipTap needs items to be non-empty for the popup to show
        return [{ id: 'loading', query }];
      },
      ...suggestionOptions,
    },
  });
}
