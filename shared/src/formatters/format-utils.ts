/**
 * Format Utilities
 *
 * Shared helpers used across multiple formatters.
 */

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Validate a CSS color value, returning the fallback if the value
 * contains anything beyond safe hex / rgb() / hsl() syntax.
 */
const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const BARE_HEX_RE = /^[0-9a-fA-F]{6}$/;
const FUNC_RE = /^(?:rgba?|hsla?)\(\s*[\d.,\s%]+\s*\)$/;

export function sanitizeCssColor(value: string, fallback: string): string {
    const v = value.trim();
    if (HEX_RE.test(v)) return v;
    if (BARE_HEX_RE.test(v)) return `#${v}`;
    if (FUNC_RE.test(v)) return v;
    return fallback;
}

/**
 * Strip everything except alphanumerics and hyphens from a class name.
 */
export function sanitizeClassName(value: string): string {
    return value.replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Format a cent value as a currency string (e.g. 15000 → "$150.00").
 */
export function formatCents(cents: number, currency: string): string {
    const dollars = cents / 100;
    return dollars.toLocaleString('en-CA', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
