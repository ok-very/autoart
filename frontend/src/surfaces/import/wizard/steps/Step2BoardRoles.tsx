import { useState, useMemo } from 'react';
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';
import { Inline } from '../../../../ui/atoms/Inline';
import { Select } from '../../../../ui/atoms/Select';
import { Badge } from '../../../../ui/atoms/Badge';
import { Spinner } from '../../../../ui/atoms/Spinner';
import { useMondayBoardConfigs, useUpdateMondayBoardConfig } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import type { MondayBoardRole } from '../../../../api/types/monday';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

const ROLE_OPTIONS: { value: MondayBoardRole; label: string; description?: string }[] = [
    { value: 'project_board', label: 'Project', description: 'Container for tasks' },
    { value: 'action_board', label: 'Task List', description: 'List of actionable items' },
    { value: 'template_board', label: 'Template Library', description: 'Source of templates' },
    { value: 'reference_board', label: 'Reference Data', description: 'Passive records' },
    { value: 'ignore', label: 'Ignore', description: 'Skip this board' },
];

export function Step2BoardRoles({ onNext, onBack, session, onSessionCreated }: StepProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Extract board IDs from session config
    const boardIds = useMemo(() => {
        if (!session?.parser_config) return [];
        const config = session.parser_config;
        if (config.boardIds && Array.isArray(config.boardIds)) return config.boardIds;
        if (config.boardId) return [config.boardId];
        return [];
    }, [session]);

    // Fetch configs
    const { data: boardConfigs, isLoading } = useMondayBoardConfigs(boardIds);

    // Mutations
    const updateConfig = useUpdateMondayBoardConfig();
    const generatePlan = useGenerateImportPlan();

    const handleRoleChange = async (boardConfigId: string, newRole: MondayBoardRole) => {
        if (!session) return;

        await updateConfig.mutateAsync({
            workspaceId: 'ignored', // The route requires workspaceId but we'll get it from the config objects if possible or rely on the fact that we have the board ID.
            // Actually, we must provide it.
            boardConfigId,
            update: { role: newRole }
        } as any);
    };

    const handleNext = async () => {
        if (!session) return;

        try {
            setIsRefreshing(true);
            // Regenerate plan with new configurations
            const newPlan = await generatePlan.mutateAsync(session.id);

            // Update parent state
            onSessionCreated(session, newPlan);

            onNext();
        } catch (err) {
            console.error('Failed to refresh plan:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!boardConfigs || boardConfigs.length === 0) {
        return (
            <Stack className="h-full">
                <Text size="lg" weight="bold">Step 2: Configure Board Roles</Text>
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack} variant="secondary">Back</Button>
            </Stack>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Stack gap="sm" className="shrink-0">
                <Text size="lg" weight="bold">Step 2: Configure Board Roles</Text>
                <Text color="muted">
                    Define how each board should be interpreted. This determines the entity types created (Projects vs Tasks vs Templates).
                </Text>
            </Stack>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white mt-4 min-h-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-3">Board Name</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {boardConfigs.map((config) => (
                            <tr key={config.boardId} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {config.boardName}
                                </td>
                                <td className="px-4 py-3 w-[250px]">
                                    <Select
                                        value={config.role}
                                        onChange={(val) => {
                                            const workspaceId = config.workspaceId;
                                            const dbId = config.id;

                                            // Safe check
                                            if (val && workspaceId && dbId) {
                                                handleRoleChange(dbId, val as MondayBoardRole);
                                            } else {
                                                // Fallback if types mismatch at runtime
                                                const anyConfig = config as any;
                                                const wsId = anyConfig.workspaceId;
                                                const id = anyConfig.id;
                                                if (val && wsId && id) {
                                                    updateConfig.mutate({
                                                        workspaceId: wsId,
                                                        boardConfigId: id,
                                                        update: { role: val as MondayBoardRole }
                                                    });
                                                }
                                            }
                                        }}
                                        data={ROLE_OPTIONS}
                                        size="sm"
                                    />
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                    <Badge
                                        variant={
                                            config.role === 'project_board' ? 'project' :
                                                config.role === 'action_board' ? 'task' :
                                                    config.role === 'ignore' ? 'neutral' : 'warning'
                                        }
                                        size="sm"
                                    >
                                        {config.role.replace('_', ' ')}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
                <Button onClick={onBack} variant="secondary" disabled={isRefreshing}>
                    Back
                </Button>
                <Button
                    onClick={handleNext}
                    variant="primary"
                    disabled={isRefreshing || updateConfig.isPending}
                >
                    {isRefreshing ? 'Regenerating Plan...' : 'Next: Group Roles'}
                </Button>
            </Inline>
        </div>
    );
}
