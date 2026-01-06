/**
 * Execution Controls
 *
 * Footer with explicit commit phase button.
 * 
 * Commit behavior by output kind:
 * - fact_candidate: Commit only if approved by user
 * - work_event: Auto-commit (always)
 * - field_value: Auto-commit (always)
 * - action_hint: Never commit (stored as classification only)
 * - unclassified: Never commit
 */

import { Ban, CheckCircle2, Loader2, AlertTriangle, Upload } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import type { ImportSession, ImportPlan } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

interface ExecutionControlsProps {
    session: ImportSession | null;
    plan: ImportPlan | null;
    isExecuting: boolean;
    onExecuteStart: () => void;
    onExecuteComplete: (success: boolean) => void;
    onReset: () => void;
}

interface CommitStats {
    factCandidatesApproved: number;
    factCandidatesPending: number;
    workEvents: number;
    fieldValues: number;
    actionHints: number;
    unclassified: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Count items by their commit status based on output kinds.
 */
function getCommitStats(plan: ImportPlan | null): CommitStats {
    const stats: CommitStats = {
        factCandidatesApproved: 0,
        factCandidatesPending: 0,
        workEvents: 0,
        fieldValues: 0,
        actionHints: 0,
        unclassified: 0,
    };

    if (!plan?.classifications) return stats;

    for (const c of plan.classifications) {
        const outputs = c.interpretationPlan?.outputs ?? [];
        const statusEvent = c.interpretationPlan?.statusEvent;

        // Count by primary classification
        if (c.outcome === 'UNCLASSIFIED' || c.outcome === 'AMBIGUOUS') {
            if (c.resolution) {
                // Resolved - count as approved if resolved to FACT_EMITTED
                if (c.resolution.resolvedOutcome === 'FACT_EMITTED') {
                    stats.factCandidatesApproved++;
                }
            } else {
                stats.unclassified++;
            }
            continue;
        }

        if (c.outcome === 'INTERNAL_WORK') {
            stats.actionHints++;
            continue;
        }

        if (c.outcome === 'DERIVED_STATE') {
            stats.workEvents++;
            continue;
        }

        if (c.outcome === 'FACT_EMITTED') {
            // Check if it has fact_candidate outputs
            const hasFactCandidate = outputs.some(o => o.kind === 'fact_candidate');
            if (hasFactCandidate) {
                if (c.resolution?.resolvedOutcome === 'FACT_EMITTED') {
                    stats.factCandidatesApproved++;
                } else {
                    stats.factCandidatesPending++;
                }
            }
        }

        // Count work_events from status
        if (statusEvent?.kind === 'work_event') {
            stats.workEvents++;
        }

        // Count field_values
        const fieldValues = outputs.filter(o => o.kind === 'field_value');
        stats.fieldValues += fieldValues.length;
    }

    return stats;
}

/**
 * Check if commit is allowed (no pending fact_candidates that need approval).
 */
function canCommit(stats: CommitStats): boolean {
    // Commit is allowed if there are no pending fact_candidates
    // (all must be resolved to proceed)
    return stats.factCandidatesPending === 0 && stats.unclassified === 0;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExecutionControls({
    session,
    plan,
    isExecuting,
    onExecuteStart,
    onExecuteComplete,
    onReset,
}: ExecutionControlsProps) {
    const [executionStatus, setExecutionStatus] = useState<'idle' | 'success' | 'error' | 'blocked'>('idle');

    const hasErrors = plan?.validationIssues.some((i) => i.severity === 'error') ?? false;

    // Commit stats
    const stats = useMemo(() => getCommitStats(plan), [plan]);
    const commitAllowed = canCommit(stats);

    const canExecute = session && plan && !hasErrors && commitAllowed && !isExecuting;

    // Summary of what will be committed
    const commitSummary = useMemo(() => {
        const parts: string[] = [];
        if (stats.factCandidatesApproved > 0) {
            parts.push(`${stats.factCandidatesApproved} fact${stats.factCandidatesApproved !== 1 ? 's' : ''}`);
        }
        if (stats.workEvents > 0) {
            parts.push(`${stats.workEvents} work event${stats.workEvents !== 1 ? 's' : ''}`);
        }
        if (stats.fieldValues > 0) {
            parts.push(`${stats.fieldValues} field value${stats.fieldValues !== 1 ? 's' : ''}`);
        }
        return parts.length > 0 ? parts.join(', ') : 'no events';
    }, [stats]);

    // Handle execute
    const handleExecute = useCallback(async () => {
        if (!session || !plan) return;

        if (!commitAllowed) {
            setExecutionStatus('blocked');
            return;
        }

        onExecuteStart();
        setExecutionStatus('idle');

        try {
            const response = await fetch(`/api/imports/sessions/${session.id}/execute`, {
                method: 'POST',
            });

            const result = await response.json();

            if (result.blocked) {
                setExecutionStatus('blocked');
                onExecuteComplete(false);
            } else {
                setExecutionStatus('success');
                onExecuteComplete(true);
            }
        } catch (err) {
            console.error('Import failed:', err);
            setExecutionStatus('error');
            onExecuteComplete(false);
        }
    }, [session, plan, commitAllowed, onExecuteStart, onExecuteComplete]);

    // No session yet
    if (!session || !plan) {
        return (
            <div className="h-16 bg-white border-t border-slate-200 flex items-center justify-end px-6">
                <span className="text-sm text-slate-400">
                    Configure and parse data to continue
                </span>
            </div>
        );
    }

    return (
        <div className="h-16 bg-white border-t border-slate-200 flex items-center justify-between px-6">
            {/* Stats summary */}
            <div className="flex items-center gap-4">
                <div className="text-sm text-slate-600">
                    Ready to import{' '}
                    <span className="font-medium text-slate-800">{plan.items.length}</span> items
                    {plan.containers.length > 0 && (
                        <> in <span className="font-medium text-slate-800">{plan.containers.length}</span> containers</>
                    )}
                </div>

                {/* Commit will produce */}
                <div className="text-sm text-slate-500 border-l border-slate-200 pl-4">
                    Will commit: <span className="font-medium text-slate-700">{commitSummary}</span>
                </div>

                {/* Pending items warning */}
                {(stats.factCandidatesPending > 0 || stats.unclassified > 0) && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-1 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                            {stats.factCandidatesPending + stats.unclassified} need review
                        </span>
                    </div>
                )}

                {/* Non-committed items info */}
                {stats.actionHints > 0 && (
                    <div className="text-xs text-slate-400">
                        ({stats.actionHints} action hint{stats.actionHints !== 1 ? 's' : ''} stored as classification only)
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
                {/* Success message */}
                {executionStatus === 'success' && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Import completed!
                    </div>
                )}

                {/* Blocked message */}
                {executionStatus === 'blocked' && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Approve or skip pending items first
                    </div>
                )}

                {/* Cancel button */}
                <button
                    onClick={onReset}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors"
                >
                    <Ban className="w-4 h-4" />
                    Cancel
                </button>

                {/* Commit button - explicit action */}
                <button
                    onClick={handleExecute}
                    disabled={!canExecute}
                    title={!commitAllowed ? 'Approve or skip pending fact candidates first' : undefined}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-300 rounded-lg transition-colors"
                >
                    {isExecuting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Committing...
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4" />
                            Commit Approved Events
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default ExecutionControls;
