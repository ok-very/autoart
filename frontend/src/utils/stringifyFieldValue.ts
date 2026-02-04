/**
 * Safe value serialization for display and sort keys.
 *
 * Handles objects that would otherwise render as "[object Object]".
 * Tries common display properties first, falls back to JSON.
 */

export function stringifyFieldValue(val: unknown): string | null {
    if (val == null) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);

    // Array: join elements
    if (Array.isArray(val)) {
        return val.map(stringifyFieldValue).filter(Boolean).join(', ') || null;
    }

    // Object: try common display properties, then JSON
    if (typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        // Common display property names
        for (const key of ['name', 'label', 'title', 'value', 'display', 'text']) {
            if (typeof obj[key] === 'string') return obj[key];
        }
        // Fallback to JSON (compact)
        try {
            return JSON.stringify(val);
        } catch {
            return '[complex value]';
        }
    }

    return String(val);
}
