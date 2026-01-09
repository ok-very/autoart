/**
 * Execution Controls
 *
 * Footer with explicit commit phase button using Mantine components.
 * 
 * Commit behavior by output kind:
 * - fact_candidate: Commit only if approved by user
 * - work_event: Auto-commit (always)
 * - field_value: Auto-commit (always)
 * - action_hint: Never commit (stored as classification only)
 * - unclassified: Never commit
 */

import { Ban, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { Paper, Group, Text, Button, Badge, Loader } from '@mantine/core';
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
            <Paper h={64} shadow="none" className="border-t border-slate-200">
                <Group justify="flex-end" h="100%" px="md">
                    <Text size="sm" c="dimmed">
                        Configure and parse data to continue
                    </Text>
                </Group>
            </Paper>
        );
    }

    return (
        <Paper h={64} shadow="none" className="border-t border-slate-200">
            <Group justify="space-between" h="100%" px="md">
                {/* Stats summary */}
                <Group gap="md">
                    <Text size="sm" c="dimmed">
                        Ready to import{' '}
                        <Text span fw={500} c="dark">{plan.items.length}</Text> items
                        {plan.containers.length > 0 && (
                            <> in <Text span fw={500} c="dark">{plan.containers.length}</Text> containers</>
                        )}
                    </Text>

                    {/* Commit will produce */}
                    <Text size="sm" c="dimmed" className="border-l border-slate-200 pl-4">
                        Will commit: <Text span fw={500} c="dark">{commitSummary}</Text>
                    </Text>

                    {/* Pending items warning */}
                    {(stats.factCandidatesPending > 0 || stats.unclassified > 0) && (
                        <Badge color="yellow" variant="light" leftSection={<AlertTriangle size={12} />}>
                            {stats.factCandidatesPending + stats.unclassified} need review
                        </Badge>
                    )}

                    {/* Non-committed items info */}
                    {stats.actionHints > 0 && (
                        <Text size="xs" c="dimmed">
                            ({stats.actionHints} action hint{stats.actionHints !== 1 ? 's' : ''} stored as classification only)
                        </Text>
                    )}
                </Group>

                {/* Action buttons */}
                <Group gap="sm">
                    {/* Success message */}
                    {executionStatus === 'success' && (
                        <Group gap="xs" c="green">
                            <CheckCircle2 size={16} />
                            <Text size="sm">Import completed!</Text>
                        </Group>
                    )}

                    {/* Blocked message */}
                    {executionStatus === 'blocked' && (
                        <Group gap="xs" c="yellow.7">
                            <AlertTriangle size={16} />
                            <Text size="sm">Approve or skip pending items first</Text>
                        </Group>
                    )}

                    {/* Cancel button */}
                    <Button
                        variant="default"
                        leftSection={<Ban size={16} />}
                        disabled={isExecuting}
                        onClick={onReset}
                    >
                        Cancel
                    </Button>

                    {/* Commit button - explicit action */}
                    <Button
                        color="green"
                        leftSection={isExecuting ? <Loader size={16} color="white" /> : <Upload size={16} />}
                        disabled={!canExecute}
                        onClick={handleExecute}
                        title={!commitAllowed ? 'Approve or skip pending fact candidates first' : undefined}
                    >
                        {isExecuting ? 'Committing...' : 'Commit Approved Events'}
                    </Button>
                </Group>
            </Group>
        </Paper>
    );
}

export default ExecutionControls;
