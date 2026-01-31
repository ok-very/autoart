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
