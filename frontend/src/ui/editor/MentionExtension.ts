import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';

import type { RichTextEditorConfig } from './EditorConfig';
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
        command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: MentionAttributes }) => {
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
        parseHTML: (element: HTMLElement) => element.getAttribute('data-reference-id'),
        renderHTML: (attributes: MentionAttributes) => ({
          'data-reference-id': attributes.referenceId,
        }),
      },
      label: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-label') || element.textContent,
        renderHTML: (attributes: MentionAttributes) => ({
          'data-label': attributes.label,
        }),
      },
      mode: {
        default: 'dynamic',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-mode') || 'dynamic',
        renderHTML: (attributes: MentionAttributes) => ({
          'data-mode': attributes.mode,
        }),
      },
      recordId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-record-id'),
        renderHTML: (attributes: MentionAttributes) => ({
          'data-record-id': attributes.recordId,
        }),
      },
      fieldKey: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-field-key'),
        renderHTML: (attributes: MentionAttributes) => ({
          'data-field-key': attributes.fieldKey,
        }),
      },
      triggerChar: {
        default: '#',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-trigger') || '#',
        renderHTML: (attributes: MentionAttributes) => ({
          'data-trigger': attributes.triggerChar,
        }),
      },
      snapshot: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute('data-snapshot');
          try {
            return val ? JSON.parse(val) : null;
          } catch {
            return val;
          }
        },
        renderHTML: (attributes: MentionAttributes) => ({
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
    const attrs = node.attrs as MentionAttributes;
    const triggerChar = attrs.triggerChar || '#';
    const chipClass = triggerChar === '@' ? 'mention-at' : 'mention-hash';
    const modeClass = attrs.mode === 'static' ? 'token-static' : 'token-dynamic';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mention',
        class: `mention ${chipClass} ${modeClass}`,
      }),
      attrs.label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionChip);
  },

  addCommands() {
    return {
      insertMention:
        (attrs: MentionAttributes) =>
          ({ chain }: { chain: () => { insertContent: (content: { type: string; attrs: MentionAttributes }) => { run: () => boolean } } }) => {
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

// ============================================================================
// CONFIGURED EXTENSIONS FACTORY
// ============================================================================

import Placeholder from '@tiptap/extension-placeholder';


type SuggestionRenderFn = () => ReturnType<NonNullable<SuggestionOptions['render']>>;

/**
 * Create TipTap extensions based on editor configuration.
 * Enables conditional feature inclusion based on config flags.
 */
export function createConfiguredExtensions(
  config: RichTextEditorConfig,
  suggestionHandlers: {
    '#'?: SuggestionRenderFn;
    '@'?: SuggestionRenderFn;
  }
) {
  const extensions = [];

  // StarterKit with conditional features based on config
  // Note: StarterKit expects `false` to disable, or options object to configure
  extensions.push(
    StarterKit.configure({
      bold: config.styles.bold === false ? false : {},
      italic: config.styles.italic === false ? false : {},
      strike: config.styles.strikethrough === false ? false : {},
      code: config.styles.code === false ? false : {},
      heading: config.styles.heading === false
        ? false
        : typeof config.styles.heading === 'object'
          ? { levels: config.styles.heading.levels as [1, 2, 3, 4, 5, 6] }
          : false, // Disable heading by default
      bulletList: config.styles.bulletList === false ? false : {},
      orderedList: config.styles.orderedList === false ? false : {},
      codeBlock: config.styles.codeBlock === false ? false : {},
      blockquote: config.styles.blockquote === false ? false : {},
    })
  );

  // Placeholder extension
  if (config.placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: config.placeholder,
      })
    );
  }

  // Record reference mentions (# trigger)
  if (config.styles.recordReferences && suggestionHandlers['#']) {
    extensions.push(
      createMentionExtension('#', {
        render: suggestionHandlers['#'],
      })
    );
  }

  // User mentions (@ trigger) - future feature
  if (config.styles.userMentions && suggestionHandlers['@']) {
    extensions.push(
      createMentionExtension('@', {
        render: suggestionHandlers['@'],
      })
    );
  }

  return extensions;
}

