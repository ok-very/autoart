/**
 * Execution Controls
 *
 * Footer with explicit commit phase button using bespoke atoms.
 * 
 * Commit behavior by output kind:
 * - fact_candidate: Commit only if approved by user
 * - work_event: Auto-commit (always)
 * - field_value: Auto-commit (always)
 * - action_hint: Never commit (stored as classification only)
 * - unclassified: Never commit
 */

import { Ban, CheckCircle2, AlertTriangle, Upload, Loader2 } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';

import type { ImportSession, ImportPlan } from '../../../api/hooks/imports';
import { useExecuteImport } from '../../../api/hooks/imports';
import { Card, Inline, Text, Button, Badge } from '@autoart/ui';

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

        // Count fact_candidates in outputs
        const factCandidates = outputs.filter(o => o.kind === 'fact_candidate');
        for (const fc of factCandidates) {
            // Use optional access as approved may not be on the base type
            if ((fc as { approved?: boolean }).approved) {
                stats.factCandidatesApproved++;
            } else {
                stats.factCandidatesPending++;
            }
        }

        // Count work_events
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
    const executeMutation = useExecuteImport();

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
            const result = await executeMutation.mutateAsync(session.id);

            if (result.status === 'failed') {
                setExecutionStatus('error');
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
    }, [session, plan, commitAllowed, onExecuteStart, onExecuteComplete, executeMutation]);

    // No session yet
    if (!session || !plan) {
        return (
            <Card className="h-16 border-t border-ws-panel-border rounded-none shadow-none">
                <Inline justify="end" className="h-full px-4">
                    <Text size="sm" color="dimmed">
                        Configure and parse data to continue
                    </Text>
                </Inline>
            </Card>
        );
    }

    return (
        <Card className="h-16 border-t border-ws-panel-border rounded-none shadow-none">
            <Inline justify="between" className="h-full px-4">
                {/* Stats summary */}
                <Inline gap="md">
                    <Text size="sm" color="dimmed">
                        Ready to import{' '}
                        <span className="font-medium text-ws-fg">{plan.items.length}</span> items
                        {plan.containers.length > 0 && (
                            <> in <span className="font-medium text-ws-fg">{plan.containers.length}</span> containers</>
                        )}
                    </Text>

                    {/* Commit will produce */}
                    <Text size="sm" color="dimmed" className="border-l border-ws-panel-border pl-4">
                        Will commit: <span className="font-medium text-ws-fg">{commitSummary}</span>
                    </Text>

                    {/* Pending items warning */}
                    {(stats.factCandidatesPending > 0 || stats.unclassified > 0) && (
                        <Badge variant="warning" className="flex items-center gap-1">
                            <AlertTriangle size={12} />
                            {stats.factCandidatesPending + stats.unclassified} need review
                        </Badge>
                    )}

                    {/* Non-committed items info */}
                    {stats.actionHints > 0 && (
                        <Text size="xs" color="dimmed">
                            ({stats.actionHints} action hint{stats.actionHints !== 1 ? 's' : ''} stored as classification only)
                        </Text>
                    )}
                </Inline>

                {/* Action buttons */}
                <Inline gap="sm">
                    {/* Success message */}
                    {executionStatus === 'success' && (
                        <Inline gap="xs" className="text-green-600">
                            <CheckCircle2 size={16} />
                            <Text size="sm">Import completed!</Text>
                        </Inline>
                    )}

                    {/* Blocked message */}
                    {executionStatus === 'blocked' && (
                        <Inline gap="xs" className="text-amber-600">
                            <AlertTriangle size={16} />
                            <Text size="sm">Approve or skip pending items first</Text>
                        </Inline>
                    )}

                    {/* Cancel button */}
                    <Button
                        variant="secondary"
                        disabled={isExecuting}
                        onClick={onReset}
                    >
                        <Ban size={16} className="mr-1" />
                        Cancel
                    </Button>

                    {/* Commit button - explicit action */}
                    <Button
                        variant="primary"
                        disabled={!canExecute}
                        onClick={handleExecute}
                        title={!commitAllowed ? 'Approve or skip pending fact candidates first' : undefined}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isExecuting ? (
                            <>
                                <Loader2 size={16} className="mr-1 animate-spin" />
                                Committing...
                            </>
                        ) : (
                            <>
                                <Upload size={16} className="mr-1" />
                                Commit Approved Events
                            </>
                        )}
                    </Button>
                </Inline>
            </Inline>
        </Card>
    );
}

export default ExecutionControls;
