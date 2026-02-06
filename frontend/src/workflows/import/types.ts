export interface PendingResolution {
    itemTempId: string;
    outcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'EXTERNAL_WORK' | 'AMBIGUOUS' | 'UNCLASSIFIED' | 'DEFERRED' | null;
    factKind?: string;
    hintType?: string; // Track selected hint type for action_hints
    customFactLabel?: string; // User-entered custom fact kind label
}
