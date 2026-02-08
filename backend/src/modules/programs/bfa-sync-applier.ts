/**
 * BFA Sync Applier — Pure decision resolution logic
 *
 * Takes a diff report and persisted decision rows, produces write operations.
 * No I/O — all database reads/writes happen in the service layer.
 */

import type { BfaSyncDiffReport, BfaFieldChange } from '@autoart/shared';
import type { SyncDecision } from '../../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FieldWriteOp {
  field: string;      // dot-path (e.g. 'fields.total_budget')
  newValue: string;
}

export interface ApplyOpsResult {
  /** entityId -> list of field writes to apply */
  writeOps: Map<string, FieldWriteOp[]>;
  /** Decision row IDs to stamp with applied_at */
  autoAccepted: string[];
  counts: { applied: number; rejected: number; deferred: number };
}

// ============================================================================
// CORE LOGIC
// ============================================================================

/**
 * Resolve which field changes should be applied based on authority rules
 * and user decisions.
 *
 * - authority === 'monday': auto-accept (always applied)
 * - authority === 'merge' + decision === 'accept': applied
 * - authority === 'merge' + decision === 'reject': rejected
 * - authority === 'merge' + decision null or 'defer': deferred
 */
export function resolveApplyOps(
  report: BfaSyncDiffReport,
  decisionRows: SyncDecision[],
): ApplyOpsResult {
  // Build lookup: "entityId:field" -> decision row
  const decisionLookup = new Map<string, SyncDecision>();
  for (const row of decisionRows) {
    decisionLookup.set(`${row.entity_id}:${row.field}`, row);
  }

  const writeOps = new Map<string, FieldWriteOp[]>();
  const autoAccepted: string[] = [];
  const counts = { applied: 0, rejected: 0, deferred: 0 };

  function addWriteOp(change: BfaFieldChange): void {
    const ops = writeOps.get(change.entityId) ?? [];
    ops.push({ field: change.field, newValue: change.newValue });
    writeOps.set(change.entityId, ops);
    counts.applied++;
  }

  for (const change of report.fieldChanges) {
    const key = `${change.entityId}:${change.field}`;
    const decision = decisionLookup.get(key);

    if (change.authority === 'monday') {
      // Auto-accept: Monday is authoritative
      addWriteOp(change);
      if (decision) {
        autoAccepted.push(decision.id);
      }
    } else if (change.authority === 'merge') {
      if (decision?.decision === 'accept') {
        addWriteOp(change);
        autoAccepted.push(decision.id);
      } else if (decision?.decision === 'reject') {
        counts.rejected++;
      } else {
        // null or 'defer'
        counts.deferred++;
      }
    }
    // authority === 'local' fields are never written from Monday data
  }

  return { writeOps, autoAccepted, counts };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Set a value at a dot-path on a nested object, creating intermediate objects
 * as needed.
 *
 * Example: setDotPath({}, 'fields.total_budget', '$500k')
 *   => { fields: { total_budget: '$500k' } }
 */
export function setDotPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}
