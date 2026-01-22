import { useState } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { ProgressBar } from '@autoart/ui';
import { Card } from '@autoart/ui';
import { useExecuteImport, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';

interface StepProps {
    onNext: () => void; // Not used (end of flow)
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

interface BlockedState {
    blocked: true;
    unresolvedCount: number;
    ambiguous: number;
    unclassified: number;
    message: string;
}

interface ExecutionStats {
    itemCount?: number;
    containerCount?: number;
    actionsCreated?: number;
    recordsCreated?: number;
    factEventsEmitted?: number;
    workEventsEmitted?: number;
    fieldValuesApplied?: number;
    skippedNoContext?: number;
    createdIds?: Record<string, string>;
}

export function Step6Execute({ onBack, session, plan }: StepProps) {
    const [isComplete, setIsComplete] = useState(false);
    const [blockedState, setBlockedState] = useState<BlockedState | null>(null);
    const [executionStats, setExecutionStats] = useState<ExecutionStats | null>(null);

    const executeImport = useExecuteImport();

    const handleExecute = async () => {
        if (!session) return;

        // Reset any previous blocked state
        setBlockedState(null);

        try {
            const result = await executeImport.mutateAsync(session.id);

            // Check for blocked response
            if (result.blocked) {
                setBlockedState({
                    blocked: true,
                    unresolvedCount: result.unresolvedCount ?? 0,
                    ambiguous: result.ambiguous ?? 0,
                    unclassified: result.unclassified ?? 0,
                    message: result.message ?? 'Import blocked: resolve classifications first',
                });
                return;
            }

            // Store execution stats
            setExecutionStats({
                itemCount: result.itemCount,
                containerCount: result.containerCount,
                actionsCreated: result.actionsCreated,
                recordsCreated: result.recordsCreated,
                factEventsEmitted: result.factEventsEmitted,
                workEventsEmitted: result.workEventsEmitted,
                fieldValuesApplied: result.fieldValuesApplied,
                skippedNoContext: result.skippedNoContext,
                createdIds: result.createdIds,
            });

            // Only mark complete if actually completed
            if (result.status === 'completed') {
                setIsComplete(true);
            }
        } catch (err) {
            console.error('Import failed:', err);
        }
    };

    const handleFinish = () => {
        // Navigate to projects or reload to clear state
        // Using safe check for browser environment
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = '/projects';
        }
    };

    if (!session || !plan) {
        return <Text>No session available.</Text>;
    }

    // Blocked state - need to resolve classifications
    if (blockedState) {
        return (
            <Stack className="h-full items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-10 h-10 text-amber-600" />
                </div>
                <Text size="xl" weight="bold">Import Blocked</Text>
                <Text color="muted" className="max-w-md">
                    {blockedState.message}
                </Text>

                <Card padding="md" className="mt-6 border border-amber-200 bg-amber-50">
                    <Stack gap="sm">
                        <Inline justify="between">
                            <Text size="sm">Ambiguous Items</Text>
                            <Text size="sm" weight="bold">{blockedState.ambiguous}</Text>
                        </Inline>
                        <Inline justify="between">
                            <Text size="sm">Unclassified Items</Text>
                            <Text size="sm" weight="bold">{blockedState.unclassified}</Text>
                        </Inline>
                        <div className="border-t border-amber-200 pt-2 mt-2">
                            <Inline justify="between">
                                <Text size="sm" weight="medium">Total Unresolved</Text>
                                <Text size="sm" weight="bold" className="text-amber-700">{blockedState.unresolvedCount}</Text>
                            </Inline>
                        </div>
                    </Stack>
                </Card>

                <div className="mt-8">
                    <Button onClick={onBack} variant="secondary">
                        Back to Resolve Classifications
                    </Button>
                </div>
            </Stack>
        );
    }

    if (isComplete) {
        return (
            <Stack className="h-full items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <Text size="xl" weight="bold">Import Complete!</Text>
                <Text color="muted">
                    Your Monday.com data has been successfully imported.
                </Text>

                {executionStats && (
                    <Card padding="md" className="mt-6 border border-green-200 bg-green-50">
                        <Stack gap="sm">
                            {/* Show items created - primary metric */}
                            {(executionStats.actionsCreated ?? 0) > 0 && (
                                <Inline justify="between">
                                    <Text size="sm">Items Imported</Text>
                                    <Text size="sm" weight="bold">{executionStats.actionsCreated}</Text>
                                </Inline>
                            )}
                            {/* Show structure only if containers were created */}
                            {(executionStats.containerCount ?? 0) > 0 && (
                                <Inline justify="between">
                                    <Text size="sm" color="muted">Structure Created</Text>
                                    <Text size="sm" weight="bold">{executionStats.containerCount}</Text>
                                </Inline>
                            )}
                            {(executionStats.recordsCreated ?? 0) > 0 && (
                                <Inline justify="between">
                                    <Text size="sm">Records Created</Text>
                                    <Text size="sm" weight="bold">{executionStats.recordsCreated}</Text>
                                </Inline>
                            )}
                            {(executionStats.skippedNoContext ?? 0) > 0 && (
                                <div className="border-t border-amber-200 pt-2 mt-2">
                                    <Inline justify="between">
                                        <Text size="sm" color="muted">Skipped (no project selected)</Text>
                                        <Text size="sm" weight="bold" className="text-amber-600">{executionStats.skippedNoContext}</Text>
                                    </Inline>
                                </div>
                            )}
                        </Stack>
                    </Card>
                )}

                <div className="mt-8">
                    <Button onClick={handleFinish} variant="primary" size="lg">
                        Go to Project
                    </Button>
                </div>
            </Stack>
        );
    }

    return (
        <Stack className="h-full max-w-2xl mx-auto" gap="lg">
            <Stack gap="sm" className="text-center py-6">
                <Text size="xl" weight="bold">Ready to Import?</Text>
                <Text color="muted">
                    You are about to import {plan.items.length} items from {session.parser_name}.
                </Text>
            </Stack>

            <Card padding="lg" className="border border-slate-200">
                <Stack gap="md">
                    <Inline justify="between">
                        <Text>Items to Import</Text>
                        <Text weight="bold">{plan.items.length}</Text>
                    </Inline>
                    <Inline justify="between">
                        <Text>Project Structure</Text>
                        <Text weight="bold">{plan.containers.length}</Text>
                    </Inline>
                </Stack>
            </Card>

            {executeImport.isError && (
                <div className="bg-red-50 p-4 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <Text weight="bold" color="error">Import Failed</Text>
                        <Text color="error" size="sm">
                            {executeImport.error instanceof Error ? executeImport.error.message : 'Unknown error occurred'}
                        </Text>
                    </div>
                </div>
            )}

            {executeImport.isPending && (
                <Stack gap="sm" className="py-8">
                    <Inline justify="between">
                        <Text weight="medium">Importing...</Text>
                        <Text color="muted">Please wait</Text>
                    </Inline>
                    <ProgressBar
                        segments={[{
                            key: 'loading',
                            percentage: 100,
                            color: '#e2e8f0', // slate-200 or animate pulse color
                            label: 'Processing',
                            count: plan.items.length
                        }]}
                        height="8px"
                        className="animate-pulse"
                    />
                    {/* Indeterminate or we could fake progress */}
                </Stack>
            )}

            {!executeImport.isPending && (
                <Inline justify="between" className="pt-8">
                    <Button onClick={onBack} variant="secondary">
                        Back to Preview
                    </Button>
                    <Button
                        onClick={handleExecute}
                        variant="primary"
                        size="lg"
                    >
                        Start Import
                    </Button>
                </Inline>
            )}
        </Stack>
    );
}
