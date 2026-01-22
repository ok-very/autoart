/**
 * Monday Board Selector
 *
 * Board selection UI for Monday.com connector imports.
 * Features:
 * - Searchable board list
 * - Multi-select with checkboxes
 * - Import button
 */

import {
    Search,
    Loader2,
    Calendar,
    CheckCircle2,
    ChevronDown,
    AlertCircle,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { useMondayBoards, useConnections, type MondayBoard } from '../../api/connections';

// ============================================================================
// TYPES
// ============================================================================

interface MondayBoardSelectorProps {
    onImport: (boardIds: string[]) => void;
    isImporting?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MondayBoardSelector({ onImport, isImporting }: MondayBoardSelectorProps) {
    const { data: connections } = useConnections();
    const { data: boards, isLoading, error } = useMondayBoards();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());

    // Filter boards by search query
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

    // Group boards by workspace
    const boardsByWorkspace = useMemo(() => {
        const grouped = new Map<string, MondayBoard[]>();
        for (const board of filteredBoards) {
            const existing = grouped.get(board.workspace) ?? [];
            grouped.set(board.workspace, [...existing, board]);
        }
        return grouped;
    }, [filteredBoards]);

    // Toggle board selection
    const toggleBoard = useCallback((boardId: string) => {
        setSelectedBoardIds((prev) => {
            const next = new Set(prev);
            if (next.has(boardId)) {
                next.delete(boardId);
            } else {
                next.add(boardId);
            }
            return next;
        });
    }, []);

    // Handle import
    const handleImport = useCallback(() => {
        if (selectedBoardIds.size === 0) return;
        onImport(Array.from(selectedBoardIds));
    }, [selectedBoardIds, onImport]);

    // Not connected state
    if (!connections?.monday?.connected && !boards) {
        return (
            <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-medium text-slate-900 mb-1">Monday.com not connected</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Connect your Monday account to import boards
                </p>
                <a
                    href="/settings"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                >
                    Go to Settings
                </a>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="p-6 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
                <p className="text-sm text-slate-500 mt-2">Loading boards...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-medium text-slate-900 mb-1">Failed to load boards</h3>
                <p className="text-sm text-red-600">
                    {(error as Error).message}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-4 border-b border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search boards..."
                        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Board List */}
            <div className="flex-1 overflow-auto p-4">
                {filteredBoards.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        No boards found
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Array.from(boardsByWorkspace.entries()).map(([workspace, workspaceBoards]) => (
                            <div key={workspace}>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase mb-2">
                                    <ChevronDown className="w-3 h-3" />
                                    {workspace}
                                </div>
                                <div className="space-y-1">
                                    {workspaceBoards.map((board) => (
                                        <button
                                            key={board.id}
                                            onClick={() => toggleBoard(board.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${selectedBoardIds.has(board.id)
                                                ? 'border-amber-300 bg-amber-50'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div
                                                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${selectedBoardIds.has(board.id)
                                                    ? 'bg-amber-500 text-white'
                                                    : 'border border-slate-300'
                                                    }`}
                                            >
                                                {selectedBoardIds.has(board.id) && (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-slate-900 truncate">
                                                    {board.name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {board.itemCount} items
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Options & Import */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
                {/* Import button */}
                <button
                    onClick={handleImport}
                    disabled={selectedBoardIds.size === 0 || isImporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 rounded-lg transition-colors"
                >
                    {isImporting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importing...
                        </>
                    ) : (
                        <>
                            <Calendar className="w-4 h-4" />
                            Import {selectedBoardIds.size > 0 ? `${selectedBoardIds.size} Board${selectedBoardIds.size > 1 ? 's' : ''}` : 'Selected'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default MondayBoardSelector;
