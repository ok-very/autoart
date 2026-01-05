/**
 * Execution Controls
 *
 * Footer with cancel/execute import buttons.
 */

import { Play, Ban, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
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
    const [executionStatus, setExecutionStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const hasErrors = plan?.validationIssues.some((i) => i.severity === 'error') ?? false;
    const canExecute = session && plan && !hasErrors && !isExecuting;

    // Handle execute
    const handleExecute = useCallback(async () => {
        if (!canExecute) return;

        onExecuteStart();
        setExecutionStatus('idle');

        try {
            // TODO: Replace with actual API call when backend is ready
            await new Promise((resolve) => setTimeout(resolve, 2000));

            setExecutionStatus('success');
            onExecuteComplete(true);
        } catch (err) {
            console.error('Import failed:', err);
            setExecutionStatus('error');
            onExecuteComplete(false);
        }
    }, [canExecute, onExecuteStart, onExecuteComplete]);

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
            <div className="text-sm text-slate-600">
                Ready to import{' '}
                <span className="font-medium text-slate-800">{plan.items.length}</span> items
                {plan.containers.length > 0 && (
                    <> in <span className="font-medium text-slate-800">{plan.containers.length}</span> containers</>
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
