/**
 * Style Tokens
 *
 * Shared style token sets for formatter output. Colors are bare 6-char hex
 * (DOCX-native); PDF compilers prepend '#'. Sizes are in half-points
 * (DOCX-native, e.g. 28 = 14pt); PDF compilers divide by 2.
 *
 * Two presets:
 * - PARCHMENT_TOKENS: design-system-aligned (Source Serif 4, parchment palette)
 * - BFA_TOKENS: corporate export style (Carlito, generic colors) — documented
 *   exception, BFA exports intentionally diverge from the design system
 */

import { z } from 'zod';

// ============================================================================
// SCHEMA
// ============================================================================

const hexColor = z.string().regex(/^[0-9A-Fa-f]{6}$/);

export const StyleTokenSetSchema = z.object({
    version: z.literal(1),

    colors: z.object({
        text: hexColor,
        textSecondary: hexColor,
        background: hexColor,
        border: hexColor,
        accent: hexColor,
        accentSecondary: hexColor,
        success: hexColor,
        error: hexColor,
    }),

    fonts: z.object({
        primary: z.string(),
        primaryFallback: z.string(),
        mono: z.string(),
        monoFallback: z.string(),
        /** Google Fonts @import URL (PDF only, ignored by DOCX) */
        cssImportUrl: z.string().optional(),
        /** Self-hosted @font-face declarations (PDF only, ignored by DOCX) */
        fontFaceDeclarations: z.string().optional(),
    }),

    sizes: z.object({
        /** Page title, half-points (e.g. 40 = 20pt) */
        h1: z.number(),
        /** Section heading, half-points */
        h2: z.number(),
        /** Body / table text, half-points */
        body: z.number(),
        /** Metadata / labels, half-points */
        meta: z.number(),
        /** Small UI copy, half-points */
        micro: z.number(),
        /** Mono text, half-points */
        mono: z.number(),
        /** Line height multiplier (e.g. 1.5) */
        lineHeight: z.number(),
    }),

    page: z.object({
        /** Page margin in inches */
        marginInches: z.number(),
    }),
});

export type StyleTokenSet = z.infer<typeof StyleTokenSetSchema>;

// ============================================================================
// PARCHMENT TOKENS (design-system-aligned)
// ============================================================================

export const PARCHMENT_TOKENS: StyleTokenSet = {
    version: 1,

    colors: {
        text: '2E2E2C',           // Charcoal Ink
        textSecondary: '5A5A57',
        background: 'F5F2ED',     // Parchment
        border: 'D6D2CB',         // Ash Taupe
        accent: '3F5C6E',         // Oxide Blue
        accentSecondary: '8A5A3C', // Burnt Umber
        success: '6F7F5C',        // Moss Green
        error: '8C4A4A',          // Iron Red
    },

    fonts: {
        primary: 'Source Serif 4',
        primaryFallback: 'Georgia',
        mono: 'IBM Plex Mono',
        monoFallback: 'Courier New',
        cssImportUrl: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap',
    },

    sizes: {
        h1: 40,    // 20pt
        h2: 32,    // 16pt
        body: 28,  // 14pt
        meta: 20,  // 10pt
        micro: 22, // 11pt
        mono: 24,  // 12pt
        lineHeight: 1.5,
    },

    page: {
        marginInches: 0.75,
    },
};

// ============================================================================
// BFA TOKENS (corporate export — documented exception)
// ============================================================================

export const BFA_TOKENS: StyleTokenSet = {
    version: 1,

    colors: {
        text: '000000',
        textSecondary: '666666',
        background: 'FFFFFF',
        border: 'CCCCCC',
        accent: '3b82f6',
        accentSecondary: '666666',
        success: '22c55e',
        error: 'ef4444',
    },

    fonts: {
        primary: 'Carlito',
        primaryFallback: 'Calibri',
        mono: 'Carlito',
        monoFallback: 'Calibri',
        // fontFaceDeclarations injected at runtime via buildCarlitoFontFace()
    },

    sizes: {
        h1: 28,    // 14pt
        h2: 24,    // 12pt
        body: 22,  // 11pt
        meta: 20,  // 10pt
        micro: 20, // 10pt
        mono: 22,  // 11pt
        lineHeight: 1.4,
    },

    page: {
        marginInches: 0.5,
    },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build @font-face declarations for self-hosted Carlito font.
 * Pass the AutoHelper base URL (e.g. 'http://localhost:9100').
 */
export function buildCarlitoFontFace(baseUrl: string): string {
    return `
        @font-face {
            font-family: 'Carlito';
            src: url('${baseUrl}/fonts/Carlito/regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: 'Carlito';
            src: url('${baseUrl}/fonts/Carlito/bold.ttf') format('truetype');
            font-weight: bold;
            font-style: normal;
        }
        @font-face {
            font-family: 'Carlito';
            src: url('${baseUrl}/fonts/Carlito/italic.ttf') format('truetype');
            font-weight: normal;
            font-style: italic;
        }`;
}
