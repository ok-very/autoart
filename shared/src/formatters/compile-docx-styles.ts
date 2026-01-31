/**
 * DOCX Style Compiler
 *
 * Converts a StyleTokenSet into docx-package-ready values.
 * Colors and sizes pass through as-is (already in DOCX-native format).
 */

import { BorderStyle, convertInchesToTwip } from 'docx';
import type { StyleTokenSet } from './style-tokens.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DocxBorder {
    style: typeof BorderStyle.SINGLE | typeof BorderStyle.NONE;
    size: number;
    color: string;
}

export interface DocxCompiledBorders {
    thin: DocxBorder;
    thick: DocxBorder;
    none: DocxBorder;
}

export interface DocxCompiledStyles {
    /** Default run properties for docx.Document({ styles.default.document.run }) */
    defaultRun: {
        font: string;
        size: number;
        color: string;
    };
    /** Default paragraph properties for docx.Document({ styles.default.document.paragraph }) */
    defaultParagraph: {
        spacing: { line: number };
    };
    /** Pre-built border objects */
    borders: DocxCompiledBorders;
    /** Raw token colors (bare hex, no '#') */
    colors: StyleTokenSet['colors'];
    /** Raw token fonts */
    fonts: StyleTokenSet['fonts'];
    /** Raw token sizes (half-points) */
    sizes: StyleTokenSet['sizes'];
    /** Page margin in twips */
    pageMarginTwip: number;
}

// ============================================================================
// COMPILER
// ============================================================================

export function compileDocxStyles(tokens: StyleTokenSet): DocxCompiledStyles {
    const lineSpacing = Math.round(tokens.sizes.lineHeight * 240);

    return {
        defaultRun: {
            font: tokens.fonts.primary,
            size: tokens.sizes.body,
            color: tokens.colors.text,
        },
        defaultParagraph: {
            spacing: { line: lineSpacing },
        },
        borders: {
            thin: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: tokens.colors.border,
            },
            thick: {
                style: BorderStyle.SINGLE,
                size: 2,
                color: tokens.colors.text,
            },
            none: {
                style: BorderStyle.NONE,
                size: 0,
                color: 'FFFFFF',
            },
        },
        colors: tokens.colors,
        fonts: tokens.fonts,
        sizes: tokens.sizes,
        pageMarginTwip: convertInchesToTwip(tokens.page.marginInches),
    };
}
