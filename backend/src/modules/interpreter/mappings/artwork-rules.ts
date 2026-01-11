/**
 * Artwork Mapping Rules
 *
 * Rules for interpreting CSV rows as artwork lifecycle events:
 * - ARTWORK_INITIATED: Commission begins
 * - ARTWORK_SELECTED: Artist/artwork selected by panel
 * - ARTWORK_DESIGNED: Design phase complete
 * - ARTWORK_FABRICATED: Fabrication complete
 * - ARTWORK_INSTALLED: Physical installation complete
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

const ARTWORK_INITIATED = 'ARTWORK_INITIATED';
const ARTWORK_SELECTED = 'ARTWORK_SELECTED';
const ARTWORK_DESIGNED = 'ARTWORK_DESIGNED';
const ARTWORK_FABRICATED = 'ARTWORK_FABRICATED';
const ARTWORK_INSTALLED = 'ARTWORK_INSTALLED';

/**
 * Extract artist name from text if present.
 */
function extractArtistName(text: string): string | undefined {
    // Pattern: "Artist: John Smith" or "artist name: Jane Doe"
    const artistMatch = text.match(/artist(?:\s*name)?:\s*([^,;]+)/i);
    if (artistMatch) return artistMatch[1].trim();

    // Pattern: "[Name] selected" - try to extract name before action verb
    const selectedMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:selected|commissioned|chosen)/);
    if (selectedMatch) return selectedMatch[1];

    return undefined;
}

/**
 * Extract artwork title from text if present.
 */
function extractArtworkTitle(text: string): string | undefined {
    // Pattern: "Artwork: [title]" or "titled [title]"
    const titleMatch = text.match(/(?:artwork|titled|title):\s*([^,;]+)/i);
    if (titleMatch) return titleMatch[1].trim();

    // Pattern: quoted title
    const quotedMatch = text.match(/["']([^"']+)["']/);
    if (quotedMatch) return quotedMatch[1];

    return undefined;
}

/**
 * Extract medium from text.
 */
function extractMedium(text: string): string | undefined {
    const mediumMatch = text.match(/medium:\s*([^,;]+)/i);
    if (mediumMatch) return mediumMatch[1].trim();
    return undefined;
}

export const artworkMappingRules: MappingRule[] = [
    // =========================================================================
    // ARTWORK_INITIATED rules
    // =========================================================================
    {
        id: 'artwork-initiated-explicit',
        description: 'Artwork commission initiated',
        pattern: /(?:artwork|commission)\s+(?:has\s+been\s+)?initiated/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_INITIATED,
            payload: {
                artworkTitle: extractArtworkTitle(ctx.text),
                artistName: extractArtistName(ctx.text),
                medium: extractMedium(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 12,
        terminal: true,
    },
    {
        id: 'artwork-commissioned',
        description: 'Artwork has been commissioned',
        pattern: /artwork\s+(?:has\s+been\s+)?commissioned/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_INITIATED,
            payload: {
                artworkTitle: extractArtworkTitle(ctx.text),
                artistName: extractArtistName(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 12,
        terminal: true,
    },
    {
        id: 'commission-started',
        description: 'Commission started/begun',
        pattern: /commission\s+(?:started|begun|begins)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_INITIATED,
            payload: {
                artistName: extractArtistName(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 11,
    },

    // =========================================================================
    // ARTWORK_SELECTED rules
    // =========================================================================
    {
        id: 'artist-selected-explicit',
        description: 'Artist explicitly selected',
        pattern: /(?:artist|artwork)\s+(?:has\s+been\s+)?selected/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_SELECTED,
            payload: {
                artistName: extractArtistName(ctx.text),
                artworkTitle: extractArtworkTitle(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 12,
        terminal: true,
    },
    {
        id: 'final-artist-selected',
        description: 'Final artist selection',
        pattern: /final\s*(?:artist|artwork|selection)\s*(?:selected|chosen|confirmed)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_SELECTED,
            payload: {
                artistName: extractArtistName(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 13,
        terminal: true,
    },
    {
        id: 'selection-panel-decision',
        description: 'Selection panel made decision',
        pattern: /selection\s+panel\s+(?:has\s+)?(?:selected|chosen|decided)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_SELECTED,
            payload: {
                artistName: extractArtistName(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 12,
    },
    {
        id: 'artist-chosen',
        description: 'Artist chosen pattern',
        pattern: /artist\s+(?:has\s+been\s+)?chosen/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_SELECTED,
            payload: {
                artistName: extractArtistName(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 11,
    },

    // =========================================================================
    // ARTWORK_DESIGNED rules
    // =========================================================================
    {
        id: 'design-complete',
        description: 'Design phase complete',
        pattern: /design\s+(?:phase\s+)?(?:complete|finished|approved)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const approverMatch = ctx.text.match(/approved\s+by\s+([^,;.]+)/i);
            return [{
                kind: 'fact_candidate',
                factKind: ARTWORK_DESIGNED,
                payload: {
                    artworkTitle: extractArtworkTitle(ctx.text),
                    designApprovedBy: approverMatch?.[1]?.trim(),
                },
                confidence: 'high',
            }];
        },
        priority: 11,
        terminal: true,
    },
    {
        id: 'artwork-design-approved',
        description: 'Artwork design approved',
        pattern: /(?:artwork|final)\s+design\s+(?:has\s+been\s+)?approved/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const approverMatch = ctx.text.match(/(?:by|from)\s+([^,;.]+)/i);
            return [{
                kind: 'fact_candidate',
                factKind: ARTWORK_DESIGNED,
                payload: {
                    artworkTitle: extractArtworkTitle(ctx.text),
                    designApprovedBy: approverMatch?.[1]?.trim(),
                },
                confidence: 'high',
            }];
        },
        priority: 12,
        terminal: true,
    },
    {
        id: 'detailed-design-complete',
        description: 'Detailed design (DD) complete',
        pattern: /(?:dd|detailed\s+design)\s+(?:complete|approved|signed\s+off)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_DESIGNED,
            payload: {},
            confidence: 'high',
        }],
        priority: 11,
    },

    // =========================================================================
    // ARTWORK_FABRICATED rules
    // =========================================================================
    {
        id: 'fabrication-complete',
        description: 'Fabrication complete/finished',
        pattern: /fabrication\s+(?:complete|finished|done)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const fabricatorMatch = ctx.text.match(/(?:by|from)\s+([^,;.]+)/i);
            return [{
                kind: 'fact_candidate',
                factKind: ARTWORK_FABRICATED,
                payload: {
                    artworkTitle: extractArtworkTitle(ctx.text),
                    fabricatorName: fabricatorMatch?.[1]?.trim(),
                },
                confidence: 'high',
            }];
        },
        priority: 11,
        terminal: true,
    },
    {
        id: 'artwork-fabricated',
        description: 'Artwork has been fabricated',
        pattern: /artwork\s+(?:has\s+been\s+)?fabricated/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_FABRICATED,
            payload: {
                artworkTitle: extractArtworkTitle(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 12,
        terminal: true,
    },
    {
        id: 'ready-for-install',
        description: 'Artwork ready for installation (implies fabrication complete)',
        pattern: /(?:artwork\s+)?ready\s+for\s+install(?:ation)?/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_FABRICATED,
            payload: {
                artworkTitle: extractArtworkTitle(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 10,
    },

    // =========================================================================
    // ARTWORK_INSTALLED rules
    // =========================================================================
    {
        id: 'artwork-installed-explicit',
        description: 'Artwork explicitly installed',
        pattern: /artwork\s+(?:has\s+been\s+)?installed/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const locationMatch = ctx.text.match(/(?:at|in)\s+([^,.]+)/i);
            const installerMatch = ctx.text.match(/(?:by)\s+([^,.]+)/i);
            return [{
                kind: 'fact_candidate',
                factKind: ARTWORK_INSTALLED,
                payload: {
                    artworkTitle: extractArtworkTitle(ctx.text),
                    artistName: extractArtistName(ctx.text),
                    installLocation: locationMatch?.[1]?.trim(),
                    installerName: installerMatch?.[1]?.trim(),
                },
                confidence: 'high',
            }];
        },
        priority: 12,
        terminal: true,
    },
    {
        id: 'installation-complete',
        description: 'Installation complete/finished',
        pattern: /installation\s+(?:complete|finished|done)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_INSTALLED,
            payload: {
                artworkTitle: extractArtworkTitle(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 11,
        terminal: true,
    },
    {
        id: 'artwork-unveiled',
        description: 'Artwork unveiled/inaugurated',
        pattern: /artwork\s+(?:has\s+been\s+)?(?:unveiled|inaugurated|dedicated)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: ARTWORK_INSTALLED,
            payload: {
                artworkTitle: extractArtworkTitle(ctx.text),
                artistName: extractArtistName(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 11,
        terminal: true,
    },
    {
        id: 'public-art-installed',
        description: 'Public art installed pattern',
        pattern: /public\s+art\s+(?:has\s+been\s+)?installed/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const locationMatch = ctx.text.match(/(?:at|in)\s+([^,.]+)/i);
            return [{
                kind: 'fact_candidate',
                factKind: ARTWORK_INSTALLED,
                payload: {
                    installLocation: locationMatch?.[1]?.trim(),
                },
                confidence: 'high',
            }];
        },
        priority: 10,
    },
];
