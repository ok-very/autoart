/**
 * Schema Matcher Service
 *
 * Matches import field recordings against existing record definitions to:
 * 1. Find the best matching definition (prioritize existing schema matches)
 * 2. Score field compatibility
 * 3. Propose new definitions when no suitable match exists
 */

import type { FieldDef, FieldType } from '@autoart/shared';
import type { RecordDefinition } from '../../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field recording from import plan item (internal type)
 * Matches ImportPlanItem.fieldRecordings structure
 */
interface FieldRecording {
    fieldName: string;
    value: unknown;
    renderHint?: string;
}

/**
 * Detail about how a single field matched
 */
export interface FieldMatchDetail {
    /** Original field name from recording */
    recordingFieldName: string;
    /** Render hint from recording */
    recordingRenderHint?: string;
    /** Matched definition field key (null if no match) */
    matchedFieldKey: string | null;
    /** Matched definition field label (null if no match) */
    matchedFieldLabel: string | null;
    /** Quality of the match */
    matchQuality: 'exact' | 'compatible' | 'partial' | 'none';
    /** Match score (0-1) */
    score: number;
}

/**
 * Proposed new definition when no good match exists
 */
export interface ProposedDefinition {
    name: string;
    schemaConfig: {
        fields: Array<{
            key: string;
            type: FieldType;
            label: string;
        }>;
    };
}

/**
 * Result of matching field recordings against definitions
 */
export interface SchemaMatchResult {
    /** Best matching definition, if found */
    matchedDefinition: RecordDefinition | null;
    /** Match quality score (0-1) */
    matchScore: number;
    /** Individual field match details */
    fieldMatches: FieldMatchDetail[];
    /** Proposed definition if no good match */
    proposedDefinition?: ProposedDefinition;
    /** Human-readable explanation */
    rationale: string;
}

// ============================================================================
// TYPE COMPATIBILITY MAPPING
// ============================================================================

/**
 * Map renderHint to compatible FieldTypes.
 * First type in array is preferred/exact match.
 * Source: Combined from Monday/Airtable/Notion connectors.
 */
const RENDER_HINT_TO_FIELD_TYPES: Record<string, FieldType[]> = {
    // Core text types
    text: ['text', 'textarea'],
    longtext: ['textarea', 'text'],

    // Selection types
    status: ['status', 'select'],
    select: ['select', 'status'],

    // Date/time types
    date: ['date'],
    timeline: ['date'], // Date range - renders as timeline

    // User types
    person: ['user'],

    // Number types
    number: ['number', 'percent'],
    currency: ['number'],
    percent: ['percent', 'number'],

    // Link types
    url: ['url', 'text'],
    email: ['email', 'text'],
    phone: ['text'], // No dedicated phone type

    // Rich content types
    file: ['text'], // File attachments - fallback to text URLs
    doc: ['textarea', 'text'], // Documents - render as longtext

    // Relation types
    relation: ['link'], // Board relations → links
    mirror: ['text'], // Mirrored values → read-only text
    subtasks: ['text'], // Subitems summary → text

    // Misc
    checkbox: ['checkbox'],
    tags: ['tags', 'text'],
};

/**
 * Get compatible FieldTypes for a renderHint
 */
export function getCompatibleTypes(renderHint: string): FieldType[] {
    return RENDER_HINT_TO_FIELD_TYPES[renderHint] || ['text'];
}

/**
 * Map renderHint to the best FieldType for new definition creation
 */
function renderHintToFieldType(renderHint?: string): FieldType {
    if (!renderHint) return 'text';
    const types = getCompatibleTypes(renderHint);
    return types[0] || 'text';
}

// ============================================================================
// NAME NORMALIZATION
// ============================================================================

/**
 * Normalize a field name for comparison
 * "Target Date" → "targetdate"
 * "targetDate" → "targetdate"
 */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[\s_-]+/g, '') // Remove spaces, underscores, hyphens
        .trim();
}

/**
 * Convert field name to valid key format
 * "Target Date" → "targetDate"
 */
function toFieldKey(name: string): string {
    return name
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .map((word, i) =>
            i === 0
                ? word.toLowerCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
}

// ============================================================================
// FIELD MATCHING
// ============================================================================

/**
 * Score how well a field recording matches a definition field
 * Returns 0-1 score
 */
export function scoreFieldMatch(
    recording: FieldRecording,
    fieldDef: FieldDef
): number {
    let score = 0;

    // Name matching (0-0.7)
    const recordingNorm = normalizeName(recording.fieldName);
    const labelNorm = normalizeName(fieldDef.label);
    const keyNorm = normalizeName(fieldDef.key);

    if (recordingNorm === labelNorm || recordingNorm === keyNorm) {
        // Exact match
        score += 0.7;
    } else if (labelNorm.includes(recordingNorm) || recordingNorm.includes(labelNorm)) {
        // Partial match
        score += 0.5;
    } else if (keyNorm.includes(recordingNorm) || recordingNorm.includes(keyNorm)) {
        // Key partial match
        score += 0.4;
    }

    // Type compatibility (0-0.3)
    if (recording.renderHint) {
        const compatibleTypes = getCompatibleTypes(recording.renderHint);
        if (compatibleTypes[0] === fieldDef.type) {
            // Exact type match
            score += 0.3;
        } else if (compatibleTypes.includes(fieldDef.type)) {
            // Compatible type
            score += 0.2;
        } else if (fieldDef.type === 'text' || fieldDef.type === 'textarea') {
            // Fallback to text
            score += 0.1;
        }
    } else {
        // No render hint, be lenient
        score += 0.1;
    }

    return Math.min(1, score);
}

/**
 * Match a single recording against all fields in a definition
 * Returns the best matching field
 */
function findBestFieldMatch(
    recording: FieldRecording,
    fields: FieldDef[]
): FieldMatchDetail {
    let bestMatch: FieldMatchDetail = {
        recordingFieldName: recording.fieldName,
        recordingRenderHint: recording.renderHint,
        matchedFieldKey: null,
        matchedFieldLabel: null,
        matchQuality: 'none',
        score: 0,
    };

    for (const field of fields) {
        const score = scoreFieldMatch(recording, field);
        if (score > bestMatch.score) {
            bestMatch = {
                recordingFieldName: recording.fieldName,
                recordingRenderHint: recording.renderHint,
                matchedFieldKey: field.key,
                matchedFieldLabel: field.label,
                matchQuality: score >= 0.9 ? 'exact' : score >= 0.6 ? 'compatible' : score > 0 ? 'partial' : 'none',
                score,
            };
        }
    }

    return bestMatch;
}

// ============================================================================
// DEFINITION MATCHING
// ============================================================================

/**
 * Score how well field recordings match a definition
 */
function scoreDefinitionMatch(
    recordings: FieldRecording[],
    definition: RecordDefinition
): { score: number; fieldMatches: FieldMatchDetail[] } {
    if (recordings.length === 0) {
        return { score: 0, fieldMatches: [] };
    }

    const schemaConfig = definition.schema_config as { fields?: FieldDef[] } | null;
    const fields = schemaConfig?.fields || [];
    if (fields.length === 0) {
        return { score: 0, fieldMatches: [] };
    }

    const fieldMatches: FieldMatchDetail[] = [];
    let totalScore = 0;

    for (const recording of recordings) {
        const match = findBestFieldMatch(recording, fields);
        fieldMatches.push(match);
        totalScore += match.score;
    }

    // Normalize by max of recording count and field count
    // Penalizes both missing fields and extra fields
    const normalizer = Math.max(recordings.length, fields.length);
    const score = totalScore / normalizer;

    return { score, fieldMatches };
}

/**
 * Match field recordings against available definitions
 * Returns the best match with scoring details
 */
export function matchSchema(
    fieldRecordings: FieldRecording[],
    definitions: RecordDefinition[]
): SchemaMatchResult {
    if (fieldRecordings.length === 0) {
        return {
            matchedDefinition: null,
            matchScore: 0,
            fieldMatches: [],
            rationale: 'No field recordings to match',
        };
    }

    if (definitions.length === 0) {
        const proposed = generateProposedDefinition(fieldRecordings, 'Imported Record');
        return {
            matchedDefinition: null,
            matchScore: 0,
            fieldMatches: [],
            proposedDefinition: proposed,
            rationale: 'No existing definitions to match against',
        };
    }

    let bestResult: SchemaMatchResult = {
        matchedDefinition: null,
        matchScore: 0,
        fieldMatches: [],
        rationale: '',
    };

    for (const definition of definitions) {
        const { score, fieldMatches } = scoreDefinitionMatch(fieldRecordings, definition);

        if (score > bestResult.matchScore) {
            bestResult = {
                matchedDefinition: definition,
                matchScore: score,
                fieldMatches,
                rationale: '',
            };
        }
    }

    // Determine match quality and rationale
    if (bestResult.matchScore >= 0.7) {
        bestResult.rationale = `Good match with "${bestResult.matchedDefinition?.name}" (${Math.round(bestResult.matchScore * 100)}% compatibility)`;
    } else if (bestResult.matchScore >= 0.4) {
        bestResult.rationale = `Partial match with "${bestResult.matchedDefinition?.name}" (${Math.round(bestResult.matchScore * 100)}% compatibility) - review recommended`;
        // Still propose a new definition as alternative
        bestResult.proposedDefinition = generateProposedDefinition(fieldRecordings, 'Imported Record');
    } else {
        const proposed = generateProposedDefinition(fieldRecordings, 'Imported Record');
        bestResult.rationale = 'No suitable match found - new definition recommended';
        bestResult.proposedDefinition = proposed;
        // Clear the weak match
        if (bestResult.matchScore < 0.2) {
            bestResult.matchedDefinition = null;
            bestResult.matchScore = 0;
            bestResult.fieldMatches = [];
        }
    }

    return bestResult;
}

// ============================================================================
// DEFINITION PROPOSAL
// ============================================================================

/**
 * Generate a proposed definition from field recordings
 */
export function generateProposedDefinition(
    fieldRecordings: FieldRecording[],
    baseName: string
): ProposedDefinition {
    const fields = fieldRecordings.map((recording) => ({
        key: toFieldKey(recording.fieldName),
        type: renderHintToFieldType(recording.renderHint),
        label: recording.fieldName,
    }));

    return {
        name: baseName,
        schemaConfig: { fields },
    };
}
