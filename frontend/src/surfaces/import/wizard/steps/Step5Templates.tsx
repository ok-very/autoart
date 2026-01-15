import { useState, useMemo } from 'react';
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';
import { Inline } from '../../../../ui/atoms/Inline';
import { Select } from '../../../../ui/atoms/Select';
import { Badge } from '../../../../ui/atoms/Badge';
import { Spinner } from '../../../../ui/atoms/Spinner';
import { useMondayBoardConfigs, useUpdateMondayBoardConfig } from '../../../../api/hooks/monday';
import { useProjects } from '../../../../api/hooks/hierarchy';
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

export function Step5Templates({ onNext, onBack, session, onSessionCreated }: StepProps) {
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
    const { data: projects, isLoading: projectsLoading } = useProjects();

    // Mutations
    const updateConfig = useUpdateMondayBoardConfig();
    const generatePlan = useGenerateImportPlan();

    const handleUpdate = async (boardConfigId: string, workspaceId: string, update: any) => {
        await updateConfig.mutateAsync({
            workspaceId,
            boardConfigId,
            update
        });
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

    if (configsLoading || projectsLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!boardConfigs || boardConfigs.length === 0) {
        return (
            <Stack className="h-full">
                <Text size="lg" weight="bold">Step 5: Templates & Links</Text>
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    const projectOptions = [
        { value: '', label: 'Create New Project (Default)' },
        ...(projects || []).map(p => ({ value: p.id, label: p.title }))
    ];

    return (
        <Stack className="h-full" gap="lg">
            <Stack gap="sm">
                <Text size="lg" weight="bold">Step 5: Templates & Links</Text>
                <Text color="dimmed">
                    Configure advanced settings for templates and project linking.
                </Text>
            </Stack>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-3 w-1/3">Board Name</th>
                            <th className="px-4 py-3 w-1/4">Role</th>
                            <th className="px-4 py-3 w-1/3">Settings</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {boardConfigs.map((config) => {
                            const isProject = config.role === 'project_board';
                            const isTemplate = config.role === 'template_board';
                            const showSettings = isProject || isTemplate;

                            return (
                                <tr key={config.boardId} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-800">
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
                                        {isProject && (
                                            <Select
                                                label="Link to Existing Project"
                                                value={config.linkedProjectId || ''}
                                                onChange={(val) => {
                                                    const workspaceId = (config as any).workspaceId;
                                                    const dbId = (config as any).id;
                                                    if (workspaceId && dbId) {
                                                        handleUpdate(dbId, workspaceId, { linkedProjectId: val || null });
                                                    }
                                                }}
                                                data={projectOptions}
                                                size="sm"
                                            />
                                        )}
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
                                        {!showSettings && (
                                            <Text color="dimmed" size="xs">No settings available for this role</Text>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Inline justify="between" className="pt-4 border-t border-slate-200">
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
        </Stack>
    );
}
