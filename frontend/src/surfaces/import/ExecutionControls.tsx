/**
 * Execution Controls
 *
 * Footer with cancel/execute import buttons.
 * Gates execution when unresolved classifications exist.
 */

import { Play, Ban, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
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

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Count unresolved classifications that block execution.
 */
function countUnresolved(plan: ImportPlan | null): { ambiguous: number; unclassified: number } {
    if (!plan?.classifications) return { ambiguous: 0, unclassified: 0 };

    let ambiguous = 0;
    let unclassified = 0;

    for (const c of plan.classifications) {
        if (c.resolution) continue;
        if (c.outcome === 'AMBIGUOUS') ambiguous++;
        if (c.outcome === 'UNCLASSIFIED') unclassified++;
    }

    return { ambiguous, unclassified };
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

    // Classification gate
    const { ambiguous, unclassified } = useMemo(() => countUnresolved(plan), [plan]);
    const hasUnresolved = ambiguous + unclassified > 0;

    const canExecute = session && plan && !hasErrors && !hasUnresolved && !isExecuting;

    // Handle execute
    const handleExecute = useCallback(async () => {
        if (!session || !plan) return;

        if (hasUnresolved) {
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
    }, [session, plan, hasUnresolved, onExecuteStart, onExecuteComplete]);

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

                {/* Unresolved classification warning */}
                {hasUnresolved && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-1 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                            {ambiguous + unclassified} unresolved
                            {ambiguous > 0 && ` (${ambiguous} ambiguous)`}
                            {unclassified > 0 && ` (${unclassified} unclassified)`}
                        </span>
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
                        Resolve classifications first
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

                {/* Execute button */}
                <button
                    onClick={handleExecute}
                    disabled={!canExecute}
                    title={hasUnresolved ? 'Resolve unclassified items first' : undefined}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 rounded-lg transition-colors"
                >
                    {isExecuting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importing...
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            Execute Import
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default ExecutionControls;
