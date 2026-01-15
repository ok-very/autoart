import { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';
import { Inline } from '../../../../ui/atoms/Inline';
import { ProgressBar } from '../../../../ui/atoms/ProgressBar';
import { Card } from '../../../../ui/atoms/Card';
import { useExecuteImport, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';

interface StepProps {
    onNext: () => void; // Not used (end of flow)
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

export function Step7Execute({ onBack, session, plan }: StepProps) {
    const [isComplete, setIsComplete] = useState(false);

    const executeImport = useExecuteImport();

    const handleExecute = async () => {
        if (!session) return;

        try {
            await executeImport.mutateAsync(session.id);
            setIsComplete(true);
        } catch (err) {
            console.error('Import failed:', err);
        }
    };

    const handleFinish = () => {
        // Reload page or reset to start? 
        // For now, reload window to clear state is safest until we have robust reset.
        window.location.reload();
    };

    if (!session || !plan) {
        return <Text>No session available.</Text>;
    }

    if (isComplete) {
        return (
            <Stack className="h-full items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <Text size="xl" weight="bold">Import Complete!</Text>
                <Text color="dimmed">
                    Your Monday.com data has been successfully imported.
                </Text>
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
                <Text color="dimmed">
                    You are about to import {plan.items.length} items from {session.parser_name}.
                </Text>
            </Stack>

            <Card padding="lg" className="border border-slate-200">
                <Stack gap="md">
                    <Inline justify="between">
                        <Text>Total Items</Text>
                        <Text weight="bold">{plan.items.length}</Text>
                    </Inline>
                    <Inline justify="between">
                        <Text>Containers (Projects/Lists)</Text>
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
                        <Text color="dimmed">Please wait</Text>
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
