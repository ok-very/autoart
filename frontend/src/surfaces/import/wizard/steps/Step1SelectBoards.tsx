
import { useState, useMemo } from 'react';
import { Search, Loader2, Calendar, CheckCircle2, ChevronDown, AlertCircle, FolderPlus } from 'lucide-react';

import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Select } from '@autoart/ui';

import { useMondayBoards, useConnections, type MondayBoard } from '../../../../api/connections';
import { useCreateConnectorSession, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';
import { useProjects } from '../../../../api/hooks/hierarchy';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

export function Step1SelectBoards({ onNext, onSessionCreated }: StepProps) {
    const { data: connections } = useConnections();
    const { data: boards, isLoading, error } = useMondayBoards();
    const { data: projects, isLoading: projectsLoading } = useProjects();
    const createConnectorSession = useCreateConnectorSession();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const [creationError, setCreationError] = useState<string | null>(null);

    // Build project options for select
    const projectOptions = useMemo(() => {
        const options = [{ value: '__new__', label: '+ Create New Project' }];
        if (projects) {
            for (const project of projects) {
                options.push({ value: project.id, label: project.title });
            }
        }
        return options;
    }, [projects]);

    // Filter boards
    const filteredBoards = useMemo(() => {
        if (!boards) return [];
        if (!searchQuery.trim()) return boards;

        const query = searchQuery.toLowerCase();
        return boards.filter(
            (board) =>
                board.name.toLowerCase().includes(query) ||
                board.workspace.toLowerCase().includes(query)
        );
    }, [boards, searchQuery]);

    // Group boards
    const boardsByWorkspace = useMemo(() => {
        const grouped = new Map<string, MondayBoard[]>();
        for (const board of filteredBoards) {
            const existing = grouped.get(board.workspace) ?? [];
            grouped.set(board.workspace, [...existing, board]);
        }
        return grouped;
    }, [filteredBoards]);



    const handleCreateSession = async () => {
        if (selectedBoardIds.size === 0) return;

        setIsCreatingSession(true);
        setCreationError(null);

        try {
            const boardId = Array.from(selectedBoardIds)[0];

            // Pass targetProjectId if a real project is selected (not __new__)
            const targetProjectId = selectedProjectId && selectedProjectId !== '__new__'
                ? selectedProjectId
                : undefined;

            const result = await createConnectorSession.mutateAsync({
                connectorType: 'monday',
                boardId,
                targetProjectId,
            });

            onSessionCreated(result.session, result.plan);
            onNext();

        } catch (err) {
            setCreationError((err as Error).message || 'Failed to create import session');
        } finally {
            setIsCreatingSession(false);
        }
    };

    // Toggle simplified for single select if we enforce it:
    // Actually, let's keep set logic but enforce size=1 check or auto-deselect others.
    const handleBoardClick = (boardId: string) => {
        setSelectedBoardIds(new Set([boardId])); // Single select behavior
    };

    // Render Logic

    if (isLoading) {
        return (
            <Stack className="items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                <Text color="muted">Loading boards...</Text>
            </Stack>
        );
    }

    if (error) {
        return (
            <Stack className="items-center justify-center h-full">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <Text color="error">Failed to load boards</Text>
                <Text size="sm">{error instanceof Error ? error.message : 'Unknown error'}</Text>
            </Stack>
        );
    }

    // Not Connected State
    if (!connections?.monday?.connected && !boards) {
        return (
            <Stack className="items-center justify-center h-full" gap="lg">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-amber-600" />
                </div>
                <div className="text-center">
                    <Text size="lg" weight="bold">Monday.com Not Connected</Text>
                    <Text color="muted">Connect your account in Settings to continue.</Text>
                </div>

                {/* We could link to settings or show nothing */}
                <Button onClick={() => window.location.href = '/settings'} variant="secondary">Go to Settings</Button>
            </Stack>
        );
    }

    return (
        <Stack className="h-full" gap="md">
            <Stack gap="sm">
                <Text size="lg" weight="bold">Step 1: Select a Monday Board</Text>
                <Text color="muted">Choose a board to import into AutoArt.</Text>
            </Stack>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search boards..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Board List */}
            <div className="flex-1 overflow-auto border rounded-lg bg-white relative">
                {filteredBoards.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Text color="muted">No boards found</Text>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {Array.from(boardsByWorkspace.entries()).map(([workspace, workspaceBoards]) => (
                            <div key={workspace}>
                                <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 text-xs font-medium text-slate-500 uppercase sticky top-0">
                                    <ChevronDown className="w-3 h-3" />
                                    {workspace}
                                </div>
                                <div>
                                    {workspaceBoards.map((board) => {
                                        const isSelected = selectedBoardIds.has(board.id);
                                        return (
                                            <button
                                                key={board.id}
                                                onClick={() => handleBoardClick(board.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                                            >
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300'}`}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </div>
                                                <div>
                                                    <div className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>{board.name}</div>
                                                    <div className="text-xs text-slate-500 flex gap-2">
                                                        <span>{board.itemCount} items</span>
                                                        <span>•</span>
                                                        <span className="capitalize">{board.boardKind}</span>
                                                        <span>•</span>
                                                        <span className="font-mono text-[10px] opacity-70">{board.id}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Target Project Selection */}
            {selectedBoardIds.size > 0 && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <Stack gap="sm">
                        <Inline gap="sm" align="center">
                            <FolderPlus className="w-4 h-4 text-slate-500" />
                            <Text weight="medium">Import Destination</Text>
                        </Inline>
                        <Text size="sm" color="muted">
                            Select an existing project to import into, or create a new one.
                        </Text>
                        <Select
                            value={selectedProjectId ?? '__new__'}
                            onChange={(val) => setSelectedProjectId(val === '__new__' ? null : val)}
                            data={projectOptions}
                            placeholder={projectsLoading ? 'Loading projects...' : 'Select project...'}
                            disabled={projectsLoading}
                        />
                    </Stack>
                </div>
            )}

            {/* Footer */}
            {creationError && (
                <Inline className="bg-red-50 p-2 rounded text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {creationError}
                </Inline>
            )}

            <Inline justify="end" className="pt-2">
                <Button
                    onClick={handleCreateSession}
                    variant="primary"
                    disabled={selectedBoardIds.size === 0 || isCreatingSession}
                >
                    {isCreatingSession ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating Session...
                        </>
                    ) : (
                        'Next: Configure Board'
                    )}
                </Button>
            </Inline>
        </Stack>
    );
}
