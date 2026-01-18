
import { useState, useMemo } from 'react';
import { Search, Loader2, Calendar, CheckCircle2, ChevronDown, AlertCircle } from 'lucide-react';

import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';

import { useMondayBoards, useConnections, type MondayBoard } from '../../../../api/connections';
import { useCreateConnectorSession, type ImportSession, type ImportPlan } from '../../../../api/hooks/imports';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

export function Step1SelectBoards({ onNext, session: _session, onSessionCreated }: StepProps) {
    const { data: connections } = useConnections();
    const { data: boards, isLoading, error } = useMondayBoards();
    const createConnectorSession = useCreateConnectorSession();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const [creationError, setCreationError] = useState<string | null>(null);

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
            // Pick first board for now, or handle multi-board sessions if backend supports it.
            // Currently backend likely supports single board per session or array?
            // createConnectorSession takes { connectorConfig: { boardId: string } }
            // It seems it takes a single boardId?
            // Checked imports.routes.ts: body.boardId (singular).
            // So we loop or pick first?
            // "Multi-select with checkboxes" implies we can select multiple.
            // But if backend only supports one, we should restrict to single select or loop.
            // For V1, let's assume single board import for simplicity OR check backend support.
            // monday-workspace.routes.ts (sync) expects boardConfigId.
            // imports.service.ts createConnectorSession expects boardId (singular).
            // So we limit to 1 board for now or change UI to radio buttons?
            // Or we iterate and create multiple sessions? That would be complex for Wizard.
            // Let's restrict to single selection or warn.
            // Changing to single selection logic:

            const boardId = Array.from(selectedBoardIds)[0];

            const result = await createConnectorSession.mutateAsync({
                connectorType: 'monday',
                boardId,
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
                <Text size="sm">{(error as Error).message}</Text>
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
