import { useState, useMemo } from 'react';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
// Select replaced by PortalSelect below
import { Badge } from '@autoart/ui';
import { Spinner } from '@autoart/ui';
import { PortalSelect } from '@autoart/ui';
import { useMondayBoardConfigs, useUpdateMondayGroupConfigs } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import type { MondayGroupRole } from '../../../../api/types/monday';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

const GROUP_ROLE_OPTIONS: { value: MondayGroupRole; label: string }[] = [
    { value: 'stage', label: 'Stage' },
    { value: 'subprocess', label: 'Subprocess' },
    { value: 'backlog', label: 'Backlog' },
    { value: 'done', label: 'Done' },
    { value: 'archive', label: 'Archive' },
    { value: 'template_group', label: 'Template Group' },
    { value: 'reference_group', label: 'Record' },
    { value: 'ignore', label: 'Ignore' },
];

const STAGE_KIND_OPTIONS = [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'done', label: 'Done' },
    { value: 'archive', label: 'Archive' },
];

export function Step3GroupRoles({ onNext, onBack, session, onSessionCreated }: StepProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Extract board IDs
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
    const updateGroups = useUpdateMondayGroupConfigs();
    const generatePlan = useGenerateImportPlan();

    const handleGroupUpdate = async (boardConfigId: string, workspaceId: string, groupId: string, update: any) => {
        // Find current groups for this board
        const board = boardConfigs?.find(b => b.id === boardConfigId);
        if (!board) return;

        const currentGroups = board.groups || [];
        const updatedGroups = currentGroups.map(g => {
            if (g.groupId === groupId) {
                return { ...g, ...update };
            }
            return g;
        });

        await updateGroups.mutateAsync({
            workspaceId,
            boardConfigId,
            groups: updatedGroups
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
                <Text size="lg" weight="bold">Step 3: Group Roles</Text>
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Stack gap="sm" className="shrink-0">
                <Text size="lg" weight="bold">Step 3: Configure Group Roles</Text>
                <Text color="muted">
                    Map Monday groups to AutoArt constructs. For Stage roles, specify if they represent To Do, Doing, or Done states.
                </Text>
            </Stack>

            <div className="flex-1 overflow-auto mt-4 space-y-6 min-h-0">
                {boardConfigs.map((board) => (
                    <div key={board.boardId} className="border border-slate-200 rounded-lg bg-white">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <Text weight="medium">{board.boardName}</Text>
                            <Badge variant={board.role === 'project_board' ? 'project' : 'light'}>
                                {board.role.replace('_', ' ')}
                            </Badge>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm table-fixed">
                                <thead className="text-slate-500 font-medium border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 w-[30%]">Group Name</th>
                                        <th className="px-4 py-2 w-[30%]">Role</th>
                                        <th className="px-4 py-2 w-[40%]">Options</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {board.groups.map((group) => (
                                        <tr key={group.groupId}>
                                            <td className="px-4 py-2 font-medium text-slate-700">
                                                {group.groupTitle}
                                            </td>
                                            <td className="px-4 py-2">
                                                <PortalSelect
                                                    value={group.role}
                                                    onChange={(val) => {
                                                        if (val && board.id && board.workspaceId) {
                                                            const update: any = { role: val };
                                                            // Set default stageKind if switching to stage
                                                            if (val === 'stage' && !group.stageKind) {
                                                                update.stageKind = 'todo';
                                                            }
                                                            handleGroupUpdate(board.id, board.workspaceId, group.groupId, update);
                                                        }
                                                    }}
                                                    data={GROUP_ROLE_OPTIONS}
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                {group.role === 'stage' && (
                                                    <PortalSelect
                                                        value={group.stageKind || 'todo'}
                                                        onChange={(val) => {
                                                            if (val && board.id && board.workspaceId) {
                                                                handleGroupUpdate(board.id, board.workspaceId, group.groupId, { stageKind: val });
                                                            }
                                                        }}
                                                        data={STAGE_KIND_OPTIONS}
                                                        size="sm"
                                                    />
                                                )}
                                                {group.role === 'reference_group' && (
                                                    <PortalSelect
                                                        value={group.settings?.referenceStrategy || 'create'}
                                                        onChange={(val) => {
                                                            if (val && board.id && board.workspaceId) {
                                                                const currentSettings = group.settings || {};
                                                                handleGroupUpdate(board.id, board.workspaceId, group.groupId, {
                                                                    settings: { ...currentSettings, referenceStrategy: val }
                                                                });
                                                            }
                                                        }}
                                                        data={[
                                                            { value: 'create', label: 'Always Create New' },
                                                            { value: 'link_or_create', label: 'Link or Create' },
                                                            { value: 'link_strict', label: 'Link Only (Review)' }
                                                        ]}
                                                        size="sm"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            <Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
                <Button onClick={onBack} variant="secondary" disabled={isRefreshing}>
                    Back
                </Button>
                <Button
                    onClick={handleNext}
                    variant="primary"
                    disabled={isRefreshing || updateGroups.isPending}
                >
                    {isRefreshing ? 'Regenerating Plan...' : 'Next: Columns'}
                </Button>
            </Inline>
        </div>
    );
}
