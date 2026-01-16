import { useState, useMemo } from 'react';
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';
import { Inline } from '../../../../ui/atoms/Inline';
import { Select } from '../../../../ui/atoms/Select';
import { Badge } from '../../../../ui/atoms/Badge';
import { Spinner } from '../../../../ui/atoms/Spinner';
import { useMondayBoardConfigs, useUpdateMondayColumnConfigs } from '../../../../api/hooks/monday';
import { useGenerateImportPlan, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import type { MondayColumnSemanticRole } from '../../../../api/types/monday';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

const SEMANTIC_ROLE_OPTIONS: { value: MondayColumnSemanticRole; label: string }[] = [
    { value: 'title', label: 'Item Title' },
    { value: 'description', label: 'Description' },
    { value: 'status', label: 'Status' },
    { value: 'dueDate', label: 'Due Date' },
    { value: 'assignee', label: 'Assignee / Owner' },
    { value: 'priority', label: 'Priority' },
    { value: 'tags', label: 'Tags' },
    { value: 'effort', label: 'Effort' },
    { value: 'cost', label: 'Cost' },
    { value: 'dependency', label: 'Dependency' },
    { value: 'link_to_project', label: 'Link to Project' },
    { value: 'link_to_action', label: 'Link to Action' },
    { value: 'link_to_record', label: 'Link to Record' },
    { value: 'custom', label: 'Custom Field' },
    { value: 'ignore', label: 'Ignore' },
];

export function Step4Columns({ onNext, onBack, session, onSessionCreated }: StepProps) {
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
    const updateColumns = useUpdateMondayColumnConfigs();
    const generatePlan = useGenerateImportPlan();

    const handleColumnUpdate = async (boardConfigId: string, workspaceId: string, columnId: string, update: any) => {
        const board = boardConfigs?.find(b => b.id === boardConfigId);
        if (!board) return;

        const currentColumns = board.columns || [];
        const updatedColumns = currentColumns.map(c => {
            if (c.columnId === columnId) {
                return { ...c, ...update };
            }
            return c;
        });

        await updateColumns.mutateAsync({
            workspaceId,
            boardConfigId,
            columns: updatedColumns
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
                <Text size="lg" weight="bold">Step 4: Map Columns</Text>
                <Text color="error">No board configurations found.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Stack gap="sm" className="shrink-0">
                <Text size="lg" weight="bold">Step 4: Map Columns</Text>
                <Text color="muted">
                    Map Monday columns to AutoArt fields. Ensure critical fields like Title, Status, and Due Date are mapped correctly.
                </Text>
            </Stack>

            <div className="flex-1 overflow-auto space-y-6 mt-4 min-h-0">
                {boardConfigs.map((board) => (
                    <div key={board.boardId} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <Text weight="medium">{board.boardName}</Text>
                            <Badge variant="light">
                                {board.columns.length} Columns
                            </Badge>
                        </div>

                        <table className="w-full text-left text-sm">
                            <thead className="text-slate-500 font-medium border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-2 w-1/4">Column Name</th>
                                    <th className="px-4 py-2 w-1/4">Type</th>
                                    <th className="px-4 py-2 w-1/2">Semantic Role</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {board.columns.map((column) => (
                                    <tr key={column.columnId} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-700">
                                            {column.columnTitle}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {column.columnType}
                                        </td>
                                        <td className="px-4 py-2">
                                            <Select
                                                value={column.semanticRole}
                                                onChange={(val) => {
                                                    if (val && board.id && board.workspaceId) {
                                                        handleColumnUpdate(board.id, board.workspaceId, column.columnId, { semanticRole: val });
                                                    }
                                                }}
                                                data={SEMANTIC_ROLE_OPTIONS}
                                                size="sm"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                    disabled={isRefreshing || updateColumns.isPending}
                >
                    {isRefreshing ? 'Regenerating Plan...' : 'Next: Templates'}
                </Button>
            </Inline>
        </div>
    );
}
