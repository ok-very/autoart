/**
 * Font Definitions
 * 
 * Common fonts available across export targets
 */

export interface FontOption {
    family: string;
    category: 'serif' | 'sans-serif' | 'monospace';
    displayName?: string;
}

export const COMMON_FONTS: FontOption[] = [
    { family: 'Arial', category: 'sans-serif' },
    { family: 'Calibri', category: 'sans-serif' },
    { family: 'Times New Roman', category: 'serif' },
    { family: 'Georgia', category: 'serif' },
    { family: 'Verdana', category: 'sans-serif' },
    { family: 'Courier New', category: 'monospace' },
    { family: 'Roboto', category: 'sans-serif' },
];

/**
 * Get fonts compatible with a specific export format
 */
export function getFontsForFormat(_format: string): FontOption[] {
    // For now, all fonts work with all formats
    // Can be refined per-format later
    return COMMON_FONTS;
}

/**
 * Get default font for a format
 */
export function getDefaultFont(format: string): string {
    switch (format) {
        case 'rtf':
            return 'Calibri';
        case 'google-doc':
        case 'google-sheets':
        case 'google-slides':
            return 'Arial';
        default:
            return 'Arial';
    }
}
