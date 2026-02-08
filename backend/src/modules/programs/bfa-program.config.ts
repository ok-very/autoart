/**
 * BFA (Ballard Fine Art) Program Configuration
 *
 * Code-as-config: BFA's phase system, authority rules, column semantics,
 * and normalization functions. Type-safe, pure-function approach.
 *
 * Ported from:
 *   ~/dev/BFA-todo/bfa_pipeline/config.py (phases, column maps)
 *   ~/dev/BFA-todo/bfa_pipeline/differ.py (authority, budget normalization, phase regression)
 *
 * When a second program needs similar config, evaluate extracting into
 * database-driven config (JSON in a `program_configs` table).
 */

import type {
  BfaColumnMapping,
  BfaFieldAuthority,
  BfaFieldAuthorityMap,
  BfaPhase,
  BfaPhaseLegacy,
  BfaProgramConfig,
  BfaProjectState,
} from '@autoart/shared';
import { BFA_PHASES } from '@autoart/shared';

// ============================================================================
// PHASE MIGRATION (old 9-phase → new 12-phase)
// From config.py:142-152
// ============================================================================

export const BFA_PHASE_MIGRATION: Record<BfaPhaseLegacy, BfaPhase> = {
  'Intake/Scoping': '1. Project Initiation',
  'EOI/Shortlist': '4.1. Artist Selection SP#1',
  'Artist selected': '4.2. Artist Selection SP#2',
  'Contracting': '5. Artist Contract',
  'Design development': '6. Detailed Design',
  'Approvals': '6. Detailed Design',
  'Fabrication': '7. Fabrication Start',
  'Install': '9. 100% Fabrication/Install',
  'Closeout': '10. Final Documents',
  'TBC': 'TBC',
};

// ============================================================================
// EXCEL PHASE MAP (Monday/Excel text variants → canonical)
// From config.py:155-168
// ============================================================================

export const BFA_EXCEL_PHASE_MAP: Record<string, BfaPhase> = {
  '1. Project Initiation/Fee Proposal': '1. Project Initiation',
  '2. PPAP': '2. PPAP',
  '3. DPAP': '3. DPAP',
  '4.1. Artist Selection SP#1': '4.1. Artist Selection SP#1',
  '4.2. Artist Selection SP#2': '4.2. Artist Selection SP#2',
  '5. Artist Contract': '5. Artist Contract',
  '6. Detailed Design': '6. Detailed Design',
  '7. Fabrication Start': '7. Fabrication Start',
  '8. 50% Fabrication': '8. 50% Fabrication',
  '9. 100% Fabrication/Installation': '9. 100% Fabrication/Install',
  '10. Final Documents': '10. Final Documents',
  '11. Photo': '11. Photo',
};

// ============================================================================
// PHASE ORDER (for regression detection)
// Derived from BFA_PHASES, matching differ.py:38
// ============================================================================

export const BFA_PHASE_ORDER: Record<string, number> = Object.fromEntries(
  BFA_PHASES.map((phase, idx) => [phase, idx]),
);

// ============================================================================
// DOC-SOURCED PHASE CANONICALIZATION (old 9-phase free text → canonical)
// From config.py:85-108
// ============================================================================

const DOC_PHASE_CANON: Record<string, BfaPhaseLegacy> = {
  'scoping': 'Intake/Scoping',
  'intake': 'Intake/Scoping',
  'eoi': 'EOI/Shortlist',
  'shortlist': 'EOI/Shortlist',
  'looping': 'EOI/Shortlist',
  'selection': 'Artist selected',
  'selected': 'Artist selected',
  'artist selected': 'Artist selected',
  'contract': 'Contracting',
  'contracting': 'Contracting',
  'concept': 'Design development',
  'design': 'Design development',
  'detailed design': 'Design development',
  'dd': 'Design development',
  'design development': 'Design development',
  'approvals': 'Approvals',
  'fabrication': 'Fabrication',
  'install': 'Install',
  'installation': 'Install',
  'complete': 'Closeout',
  'done': 'Closeout',
  'closeout': 'Closeout',
};

// ============================================================================
// PHASE CANONICALIZATION
// ============================================================================

/**
 * Normalize any phase string to a canonical BfaPhase.
 *
 * Resolution order:
 * 1. Exact match against 12-phase canonical system
 * 2. Excel/Monday variant text → canonical
 * 3. Doc free-text → legacy 9-phase → migrated to 12-phase
 * 4. null if unrecognized
 */
export function canonicalizeBfaPhase(input: string): BfaPhase | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Exact match against canonical phases
  if ((BFA_PHASES as readonly string[]).includes(trimmed)) {
    return trimmed as BfaPhase;
  }

  // 2. Excel/Monday variant text
  const excelMatch = BFA_EXCEL_PHASE_MAP[trimmed];
  if (excelMatch) return excelMatch;

  // 3. Doc free-text → legacy → migrated
  const lower = trimmed.toLowerCase();
  const legacyPhase = DOC_PHASE_CANON[lower];
  if (legacyPhase) {
    return BFA_PHASE_MIGRATION[legacyPhase];
  }

  // 4. Check if it's a legacy phase name directly
  if (legacyPhase === undefined) {
    const migrated = BFA_PHASE_MIGRATION[trimmed as BfaPhaseLegacy];
    if (migrated) return migrated;
  }

  return null;
}

// ============================================================================
// PHASE REGRESSION DETECTION
// From differ.py:96-102
// ============================================================================

/**
 * Check if newPhase represents a regression (earlier phase) from oldPhase.
 */
export function detectPhaseRegression(oldPhase: string, newPhase: string): boolean {
  const oldIdx = BFA_PHASE_ORDER[oldPhase] ?? -1;
  const newIdx = BFA_PHASE_ORDER[newPhase] ?? -1;
  return oldIdx >= 0 && newIdx >= 0 && newIdx < oldIdx;
}

// ============================================================================
// FIELD AUTHORITY
// From differ.py:14-35
// ============================================================================

export const BFA_FIELD_AUTHORITY: BfaFieldAuthorityMap = {
  // Monday overwrites unconditionally
  project_phase: 'monday',
  project_budget: 'monday',
  artist_fee: 'monday',
  target_completion: 'monday',
  municipality: 'monday',
  project_state: 'monday',
  // Local values preserved
  next_steps: 'local',
  governance: 'local',
  sections: 'local',
  // Both sources contribute, conflicts reviewed
  contacts: 'merge',
  artists: 'merge',
};

// ============================================================================
// BUDGET NORMALIZATION
// From differ.py:62-93
// ============================================================================

/**
 * Normalize a budget value to canonical format: "$1,500,000" or "$TBC".
 */
export function normalizeBudget(val: string | number | null | undefined): string {
  if (val == null) return '$TBC';
  const s = String(val).trim();
  if (!s || /^(tbc|tbd|\$tbc)$/i.test(s)) return '$TBC';

  const clean = s.replace(/[$,\s]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return s;

  return `$${Math.round(num).toLocaleString('en-US')}`;
}

/**
 * Calculate percentage change between two budget values.
 * Returns null if either value is non-numeric or $TBC.
 */
export function budgetChangePct(oldVal: string, newVal: string): number | null {
  const toNum = (v: string): number | null => {
    if (!v || v === '$TBC') return null;
    const clean = v.replace(/[$,\s]/g, '');
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  };

  const oldNum = toNum(oldVal);
  const newNum = toNum(newVal);
  if (oldNum && newNum && oldNum > 0) {
    return Math.abs(newNum - oldNum) / oldNum;
  }
  return null;
}

// ============================================================================
// STATE PRIORITY
// From differ.py:270-274
// ============================================================================

export const BFA_STATE_PRIORITY: Record<BfaProjectState, number> = {
  'Trouble': 0,
  'Issues': 1,
  'Receivership': 2,
  'On Hold': 3,
  'Low Activity': 4,
  'On Track': 5,
  'TBC': 6,
};

// ============================================================================
// COLUMN MAPPINGS
// From config.py:171-201, mapped to MondayColumnSemanticRole + authority
// ============================================================================

export const BFA_COLUMN_MAPPINGS: BfaColumnMapping[] = [
  // Core identity
  { columnKey: 'raw_name', localField: 'name', semanticRole: 'title', authority: 'monday' },
  // Personnel
  { columnKey: 'bfa_lead', localField: 'fields.bfa_lead', semanticRole: 'assignee', authority: 'monday' },
  // Milestones / dates
  { columnKey: 'dp_issuance_date', localField: 'fields.dp_issuance_date', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'milestone_sp1', localField: 'fields.milestone_sp1', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'artist_orientation', localField: 'fields.artist_orientation', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'milestone_sp2', localField: 'fields.milestone_sp2', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'project_kickoff', localField: 'fields.project_kickoff', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'selection_process', localField: 'fields.selection_process', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'artist_contract_signed', localField: 'fields.artist_contract_signed', semanticRole: 'fact', authority: 'monday' },
  // Status / phase
  { columnKey: 'project_state', localField: 'project_state', semanticRole: 'status', authority: 'monday' },
  { columnKey: 'project_phase', localField: 'bfa_phase_canonical', semanticRole: 'status', authority: 'monday' },
  // Location
  { columnKey: 'municipality', localField: 'fields.city', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'address', localField: 'fields.address', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'billing_entity', localField: 'fields.billing_entity', semanticRole: 'fact', authority: 'monday' },
  // Selection panel / community
  { columnKey: 'selection_panel', localField: 'fields.selection_panel', semanticRole: 'note', authority: 'monday' },
  { columnKey: 'community_advisors', localField: 'fields.community_advisors', semanticRole: 'note', authority: 'monday' },
  // Artists / contacts (merge authority)
  { columnKey: 'shortlisted_artists', localField: 'fields.shortlisted_artists', semanticRole: 'note', authority: 'merge' },
  { columnKey: 'selected_artist', localField: 'artists_text', semanticRole: 'note', authority: 'merge' },
  { columnKey: 'artwork_title', localField: 'sections.artwork_title', semanticRole: 'note', authority: 'merge' },
  { columnKey: 'fabricator', localField: 'contacts_text.Fabricator', semanticRole: 'note', authority: 'merge' },
  { columnKey: 'developer_contact', localField: 'contacts_text.Contact', semanticRole: 'note', authority: 'merge' },
  { columnKey: 'architect', localField: 'contacts_text.Architect', semanticRole: 'note', authority: 'merge' },
  { columnKey: 'landscape_architect', localField: 'contacts_text.Landscape', semanticRole: 'note', authority: 'merge' },
  // Budget (monday authority)
  { columnKey: 'project_budget', localField: 'fields.total_budget', semanticRole: 'metric', authority: 'monday' },
  { columnKey: 'artist_fee', localField: 'fields.art_budget', semanticRole: 'metric', authority: 'monday' },
  { columnKey: 'target_completion', localField: 'fields.install_date', semanticRole: 'due_date', authority: 'monday' },
  { columnKey: 'consultant_fee', localField: 'fields.consultant_fee', semanticRole: 'metric', authority: 'monday' },
  { columnKey: 'building_occupancy', localField: 'fields.building_occupancy', semanticRole: 'fact', authority: 'monday' },
  { columnKey: 'target_completion_start', localField: 'fields.target_completion_start', semanticRole: 'due_date', authority: 'monday' },
];

// ============================================================================
// PROGRAM CONFIG EXPORT
// ============================================================================

/**
 * Returns the full BFA program configuration.
 * Conforms to the BfaProgramConfig Zod schema from @autoart/shared.
 */
export function getBfaProgramConfig(): BfaProgramConfig {
  return {
    programId: 'bfa',
    name: 'Ballard Fine Art',
    phases: [...BFA_PHASES],
    phaseOrder: { ...BFA_PHASE_ORDER },
    phaseMigration: { ...BFA_PHASE_MIGRATION },
    phaseNormalization: { ...BFA_EXCEL_PHASE_MAP },
    fieldAuthority: { ...BFA_FIELD_AUTHORITY },
    columnMappings: [...BFA_COLUMN_MAPPINGS],
    statePriority: { ...BFA_STATE_PRIORITY },
  };
}
