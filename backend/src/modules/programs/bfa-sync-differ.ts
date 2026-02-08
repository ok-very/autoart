/**
 * BFA Sync Differ — Pure diff computation
 *
 * Takes Monday.com import plan items + local entity snapshots + BFA config,
 * produces a BfaSyncDiffReport describing what changed. No mutations.
 *
 * Ported from ~/dev/BFA-todo/bfa_pipeline/differ.py
 */

import { randomUUID } from 'crypto';

import type {
    BfaColumnMapping,
    BfaDiffSeverity,
    BfaFieldChange,
    BfaProgramConfig,
    BfaSyncDiffReport,
    BfaSyncWarning,
} from '@autoart/shared';

import type { ImportPlanItem } from '../imports/types.js';
import {
    budgetChangePct,
    canonicalizeBfaPhase,
    detectPhaseRegression,
    normalizeBudget,
} from './bfa-program.config.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Flat snapshot of a local entity's field values for comparison.
 * Built from action field_bindings or hierarchy_node metadata.
 */
export interface LocalEntitySnapshot {
    entityId: string;
    projectLabel: string;
    /** dot-path → current value (e.g. 'fields.total_budget' → '$500,000') */
    fields: Record<string, string | null>;
}

// ============================================================================
// CORE DIFF ENGINE
// ============================================================================

/**
 * Compute a BFA sync diff report from Monday data vs local state.
 *
 * For each Monday item that has a matching local entity, compares every
 * BFA column mapping and produces field-level change records with
 * authority and severity annotations.
 */
export function computeBfaDiff(
    mondayItems: ImportPlanItem[],
    localEntities: Map<string, LocalEntitySnapshot>,
    config: BfaProgramConfig,
): BfaSyncDiffReport {
    const fieldChanges: BfaFieldChange[] = [];
    const warnings: BfaSyncWarning[] = [];
    const affectedProjects = new Set<string>();

    for (const item of mondayItems) {
        const mondayId = extractMondayId(item);
        if (!mondayId) continue;

        const local = localEntities.get(mondayId);
        if (!local) {
            // Monday item with no local match — not yet imported
            warnings.push({
                message: `Monday item "${item.title}" (${mondayId}) has no local entity mapping`,
                severity: 'info',
            });
            continue;
        }

        const itemChanges = diffItem(item, local, config);
        if (itemChanges.changes.length > 0) {
            fieldChanges.push(...itemChanges.changes);
            affectedProjects.add(local.entityId);
        }
        warnings.push(...itemChanges.warnings);
    }

    // Compute stats
    const autoAccepted = fieldChanges.filter(c => c.authority === 'monday').length;
    const pendingReview = fieldChanges.filter(c => c.authority === 'merge').length;

    return {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        boardId: extractBoardId(mondayItems) ?? 'unknown',
        fieldChanges,
        rollups: [], // V1: no rollup groups (Monday connector produces structured items)
        warnings,
        stats: {
            totalChanges: fieldChanges.length,
            projectsAffected: affectedProjects.size,
            autoAccepted,
            pendingReview,
            warnings: warnings.length,
        },
    };
}

// ============================================================================
// PER-ITEM DIFFING
// ============================================================================

function diffItem(
    mondayItem: ImportPlanItem,
    local: LocalEntitySnapshot,
    config: BfaProgramConfig,
): { changes: BfaFieldChange[]; warnings: BfaSyncWarning[] } {
    const changes: BfaFieldChange[] = [];
    const warnings: BfaSyncWarning[] = [];

    // Build a lookup from fieldName → value for Monday data
    const mondayFields = new Map<string, string>();
    for (const rec of mondayItem.fieldRecordings) {
        const val = rec.value != null ? String(rec.value).trim() : '';
        if (val) {
            mondayFields.set(rec.fieldName, val);
        }
    }

    for (const mapping of config.columnMappings) {
        const mondayRaw = mondayFields.get(mapping.columnKey) ?? '';
        const localRaw = local.fields[mapping.localField] ?? '';

        // Skip if Monday value is empty/TBC — don't overwrite with nothing
        if (!mondayRaw || /^(tbc|tbd|\$tbc)$/i.test(mondayRaw.trim())) {
            continue;
        }

        // Skip local-authority fields entirely (we never overwrite from Monday)
        if (mapping.authority === 'local') {
            continue;
        }

        // Normalize and compare
        const { mondayNorm, localNorm } = normalizeValues(mondayRaw, localRaw, mapping);

        if (mondayNorm === localNorm) continue;

        // Compute severity
        const severity = computeSeverity(mapping, localNorm, mondayNorm);

        // Emit warnings for regressions
        if (severity === 'warning' && isPhaseField(mapping)) {
            warnings.push({
                entityId: local.entityId,
                message: `Phase regression: "${localNorm}" → "${mondayNorm}" for ${local.projectLabel}`,
                severity: 'warning',
            });
        }

        if (severity === 'critical') {
            warnings.push({
                entityId: local.entityId,
                message: `Budget change >50%: "${localNorm}" → "${mondayNorm}" for ${local.projectLabel}`,
                severity: 'critical',
            });
        }

        changes.push({
            entityId: local.entityId,
            projectLabel: local.projectLabel,
            field: mapping.localField,
            sourceField: mapping.columnKey,
            oldValue: localRaw || '(empty)',
            newValue: mondayRaw,
            severity,
            authority: mapping.authority,
        });
    }

    return { changes, warnings };
}

// ============================================================================
// NORMALIZATION
// ============================================================================

function normalizeValues(
    mondayRaw: string,
    localRaw: string,
    mapping: BfaColumnMapping,
): { mondayNorm: string; localNorm: string } {
    // Phase fields: canonicalize both
    if (isPhaseField(mapping)) {
        return {
            mondayNorm: canonicalizeBfaPhase(mondayRaw) ?? mondayRaw.trim(),
            localNorm: canonicalizeBfaPhase(localRaw) ?? localRaw.trim(),
        };
    }

    // Budget fields: normalize to "$X,XXX" format
    if (isBudgetField(mapping)) {
        return {
            mondayNorm: normalizeBudget(mondayRaw),
            localNorm: normalizeBudget(localRaw),
        };
    }

    // Default: trimmed string comparison
    return {
        mondayNorm: mondayRaw.trim(),
        localNorm: localRaw.trim(),
    };
}

// ============================================================================
// SEVERITY
// ============================================================================

function computeSeverity(
    mapping: BfaColumnMapping,
    localNorm: string,
    mondayNorm: string,
): BfaDiffSeverity {
    // Phase regression → warning
    if (isPhaseField(mapping) && detectPhaseRegression(localNorm, mondayNorm)) {
        return 'warning';
    }

    // Budget change >50% → critical
    if (isBudgetField(mapping)) {
        const pct = budgetChangePct(localNorm, mondayNorm);
        if (pct != null && pct > 0.5) {
            return 'critical';
        }
    }

    return 'info';
}

// ============================================================================
// FIELD TYPE DETECTION
// ============================================================================

function isPhaseField(mapping: BfaColumnMapping): boolean {
    return mapping.semanticRole === 'status' && mapping.columnKey === 'project_phase';
}

function isBudgetField(mapping: BfaColumnMapping): boolean {
    return mapping.semanticRole === 'metric';
}

// ============================================================================
// HELPERS
// ============================================================================

function extractMondayId(item: ImportPlanItem): string | null {
    const meta = item.metadata as Record<string, unknown>;
    // The domain interpreter stores mondayId in metadata
    const mondayId = meta.mondayId ?? meta.monday_id ?? meta.externalId;
    return mondayId ? String(mondayId) : null;
}

function extractBoardId(items: ImportPlanItem[]): string | null {
    for (const item of items) {
        const meta = item.metadata as Record<string, unknown>;
        const boardId = meta.boardId ?? meta.board_id;
        if (boardId) return String(boardId);
    }
    return null;
}
