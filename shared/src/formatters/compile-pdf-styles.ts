/**
 * PDF Style Compiler
 *
 * Converts a StyleTokenSet into CSS-ready values for HTML-based PDF generation.
 * Colors get '#' prefix, sizes are converted from half-points to pt.
 */

import type { StyleTokenSet } from './style-tokens.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PdfCompiledColors {
    text: string;
    textSecondary: string;
    background: string;
    border: string;
    accent: string;
    accentSecondary: string;
    success: string;
    error: string;
}

export interface PdfCompiledFonts {
    primary: string;
    primaryStack: string;
    mono: string;
    monoStack: string;
}

export interface PdfCompiledSizes {
    h1: string;
    h2: string;
    body: string;
    meta: string;
    micro: string;
    mono: string;
    lineHeight: number;
}

export interface PdfCompiledStyles {
    /** Injectable <style> body with base reset and typography */
    cssText: string;
    /** Font loading CSS (@import or @font-face block), empty string if none */
    fontCss: string;
    colors: PdfCompiledColors;
    fonts: PdfCompiledFonts;
    sizes: PdfCompiledSizes;
}

// ============================================================================
// COMPILER
// ============================================================================

function hp(halfPoints: number): string {
    return `${halfPoints / 2}pt`;
}

function hex(bare: string): string {
    return `#${bare}`;
}

export function compilePdfStyles(tokens: StyleTokenSet): PdfCompiledStyles {
    const colors: PdfCompiledColors = {
        text: hex(tokens.colors.text),
        textSecondary: hex(tokens.colors.textSecondary),
        background: hex(tokens.colors.background),
        border: hex(tokens.colors.border),
        accent: hex(tokens.colors.accent),
        accentSecondary: hex(tokens.colors.accentSecondary),
        success: hex(tokens.colors.success),
        error: hex(tokens.colors.error),
    };

    const fonts: PdfCompiledFonts = {
        primary: tokens.fonts.primary,
        primaryStack: `'${tokens.fonts.primary}', ${tokens.fonts.primaryFallback}`,
        mono: tokens.fonts.mono,
        monoStack: `'${tokens.fonts.mono}', ${tokens.fonts.monoFallback}`,
    };

    const sizes: PdfCompiledSizes = {
        h1: hp(tokens.sizes.h1),
        h2: hp(tokens.sizes.h2),
        body: hp(tokens.sizes.body),
        meta: hp(tokens.sizes.meta),
        micro: hp(tokens.sizes.micro),
        mono: hp(tokens.sizes.mono),
        lineHeight: tokens.sizes.lineHeight,
    };

    let fontCss = '';
    if (tokens.fonts.cssImportUrl) {
        fontCss = `@import url('${tokens.fonts.cssImportUrl}');`;
    } else if (tokens.fonts.fontFaceDeclarations) {
        fontCss = tokens.fonts.fontFaceDeclarations;
    }

    const cssText = `
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: ${fonts.primaryStack};
            font-size: ${sizes.body};
            line-height: ${sizes.lineHeight};
            color: ${colors.text};
            background: ${colors.background};
        }
    `;

    return { cssText, fontCss, colors, fonts, sizes };
}
