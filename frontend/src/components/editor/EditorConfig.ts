/**
 * Editor Configuration Types
 *
 * Configuration-driven architecture for RichTextEditor.
 * Enables customization of styling, extensions, and search behavior.
 */

import type { ContextType } from '@autoart/shared';

// ============================================================================
// STYLE CONFIGURATION
// ============================================================================

export interface EditorStyleConfig {
    // Text formatting
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;

    // Block types
    heading?: boolean | { levels: number[] };
    bulletList?: boolean;
    orderedList?: boolean;
    codeBlock?: boolean;
    blockquote?: boolean;

    // Mention triggers
    recordReferences?: boolean; // # trigger for records
    userMentions?: boolean;     // @ trigger for users (future)
}

// ============================================================================
// SEARCH CONFIGURATION
// ============================================================================

export interface EditorSearchConfig {
    /** Minimum characters before search triggers */
    minQueryLength?: number;
    /** Debounce delay in milliseconds */
    debounceMs?: number;
    /** Maximum results to show */
    maxResults?: number;
    /** Search scope */
    searchScope?: 'project' | 'global';
    /** Show field picker after selecting record */
    showFieldPicker?: boolean;
    /** Allowed field types for references */
    allowedFieldTypes?: string[];
}

// ============================================================================
// EXTENSION CONFIGURATION
// ============================================================================

export interface EditorExtensionConfig {
    name: string;
    enabled: boolean;
    options?: Record<string, unknown>;
}

// ============================================================================
// MAIN CONFIG
// ============================================================================

export interface RichTextEditorConfig {
    styles: EditorStyleConfig;
    search: EditorSearchConfig;
    extensions?: EditorExtensionConfig[];
    placeholder?: string;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface EditorContext {
    /** Entity ID (action, record, subprocess, etc.) */
    id: string;
    /** Context type for reference creation */
    type: ContextType;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_STYLE_CONFIG: EditorStyleConfig = {
    bold: true,
    italic: true,
    underline: false,
    strikethrough: false,
    code: false,
    heading: false,
    bulletList: true,
    orderedList: true,
    codeBlock: false,
    blockquote: false,
    recordReferences: true,
    userMentions: false,
};

export const DEFAULT_SEARCH_CONFIG: EditorSearchConfig = {
    minQueryLength: 1,
    debounceMs: 150,
    maxResults: 10,
    searchScope: 'project',
    showFieldPicker: true,
};

export const DEFAULT_EDITOR_CONFIG: RichTextEditorConfig = {
    styles: DEFAULT_STYLE_CONFIG,
    search: DEFAULT_SEARCH_CONFIG,
    placeholder: 'Start typing... Use # to reference records',
};

// ============================================================================
// CONFIG PRESETS
// ============================================================================

/** Minimal config - plain text with basic formatting */
export const MINIMAL_EDITOR_CONFIG: RichTextEditorConfig = {
    styles: {
        bold: true,
        italic: true,
        recordReferences: false,
        userMentions: false,
    },
    search: DEFAULT_SEARCH_CONFIG,
    placeholder: 'Enter text...',
};

/** Full config - all features enabled */
export const FULL_EDITOR_CONFIG: RichTextEditorConfig = {
    styles: {
        bold: true,
        italic: true,
        underline: true,
        strikethrough: true,
        code: true,
        heading: { levels: [1, 2, 3] },
        bulletList: true,
        orderedList: true,
        codeBlock: true,
        blockquote: true,
        recordReferences: true,
        userMentions: true,
    },
    search: DEFAULT_SEARCH_CONFIG,
    placeholder: 'Start typing... Use # for records, @ for users',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Merge partial config with defaults
 */
export function mergeEditorConfig(
    partial?: Partial<RichTextEditorConfig>
): RichTextEditorConfig {
    if (!partial) return DEFAULT_EDITOR_CONFIG;

    return {
        styles: { ...DEFAULT_STYLE_CONFIG, ...partial.styles },
        search: { ...DEFAULT_SEARCH_CONFIG, ...partial.search },
        extensions: partial.extensions ?? [],
        placeholder: partial.placeholder ?? DEFAULT_EDITOR_CONFIG.placeholder,
    };
}
