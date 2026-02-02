import { useState, useMemo } from 'react';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Select } from '@autoart/ui';
import { Badge } from '@autoart/ui';
import { Spinner } from '@autoart/ui';
import { useMondayBoardConfigs, useUpdateMondayBoardConfig } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

const SCOPE_OPTIONS = [
    { value: 'global', label: 'Global (All Projects)' },
    { value: 'project', label: 'Project-Specific' },
];

export function Step4Templates({ onNext, onBack, session, onSessionCreated }: StepProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Extract board IDs
    const boardIds = useMemo(() => {
        if (!session?.parser_config) return [];
        const config = session.parser_config;
        if (config.boardIds && Array.isArray(config.boardIds)) return config.boardIds;
        if (config.boardId) return [config.boardId];
        return [];
    }, [session]);

    // Fetch data
    const { data: boardConfigs, isLoading: configsLoading } = useMondayBoardConfigs(boardIds);

    // Mutations
    const updateConfig = useUpdateMondayBoardConfig();
    const generatePlan = useGenerateImportPlan();

    const handleUpdate = async (boardConfigId: string, workspaceId: string, update: any) => {
        try {
            await updateConfig.mutateAsync({
                workspaceId,
                boardConfigId,
                update
            });
        } catch (err) {
            console.error('Failed to update board config:', err);
        }
    };

    const handleNext = async () => {
        if (!session) return;

        try {
            setIsRefreshing(true);
            const newPlan = await generatePlan.mutateAsync(session.id);
            onSessionCreated(session, newPlan);
            onNext();
        } catch (err) {
            console.error('Failed to refresh plan:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (configsLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!boardConfigs || boardConfigs.length === 0) {
        return (
            <Stack className="h-full">
                <Text size="lg" weight="bold">Step 4: Templates & Links</Text>
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Stack gap="sm" className="shrink-0">
                <Text size="lg" weight="bold">Step 4: Templates & Links</Text>
                <Text color="muted">
                    Review board roles and template settings.
                </Text>
            </Stack>

            <div className="flex-1 overflow-auto border border-ws-panel-border rounded-lg bg-ws-panel-bg mt-4 min-h-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-ws-bg border-b border-ws-panel-border text-ws-text-secondary font-medium">
                        <tr>
                            <th className="px-4 py-3 w-1/3">Board Name</th>
                            <th className="px-4 py-3 w-1/4">Role</th>
                            <th className="px-4 py-3 w-1/3">Settings</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {boardConfigs.map((config) => {
                            const isTemplate = config.role === 'template_board';

                            return (
                                <tr key={config.boardId} className="hover:bg-ws-bg">
                                    <td className="px-4 py-3 font-medium text-ws-fg">
                                        {config.boardName}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge
                                            variant={
                                                config.role === 'project_board' ? 'project' :
                                                    config.role === 'template_board' ? 'info' :
                                                        config.role === 'action_board' ? 'task' :
                                                            config.role === 'ignore' ? 'neutral' : 'warning'
                                            }
                                            size="sm"
                                        >
                                            {config.role.replace('_', ' ')}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        {isTemplate && (
                                            <Select
                                                label="Template Scope"
                                                value={config.templateScope || 'global'}
                                                onChange={(val) => {
                                                    const workspaceId = (config as any).workspaceId;
                                                    const dbId = (config as any).id;
                                                    if (val && workspaceId && dbId) {
                                                        handleUpdate(dbId, workspaceId, { templateScope: val });
                                                    }
                                                }}
                                                data={SCOPE_OPTIONS}
                                                size="sm"
                                            />
                                        )}
                                        {!isTemplate && (
                                            <Text color="muted" size="xs">—</Text>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Inline justify="between" className="pt-4 mt-4 border-t border-ws-panel-border shrink-0">
                <Button onClick={onBack} variant="secondary" disabled={isRefreshing}>
                    Back
                </Button>
                <Button
                    onClick={handleNext}
                    variant="primary"
                    disabled={isRefreshing || updateConfig.isPending}
                >
                    {isRefreshing ? 'Regenerating Plan...' : 'Next: Preview'}
                </Button>
            </Inline>
        </div>
    );
}
