/**
 * ActionCardsView - Card grid view for project actions
 *
 * Radix-style design with:
 * - Responsive grid layout (1-4 columns)
 * - Card hover effects with elevation
 * - Status badges (pending/active/blocked/finished)
 * - Context pills for metadata
 * - Search and filter toolbar
 */

import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Search, MoreHorizontal, Plus, FolderOpen, Clock } from 'lucide-react';

import { useWorkflowSurfaceNodes } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { WorkflowSurfaceNode, DerivedStatus } from '@autoart/shared';
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
} from '@autoart/ui';

// Status badge styles
const STATUS_CONFIG: Record<DerivedStatus, { label: string; bg: string; text: string; border: string }> = {
    pending: { label: 'Pending', bg: 'bg-slate-100', text: 'text-ws-text-secondary', border: 'border-ws-panel-border' },
    active: { label: 'Active', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    blocked: { label: 'Blocked', bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
    finished: { label: 'Done', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
};

// Filter type
type FilterType = 'all' | DerivedStatus;

// Action card component
function ActionCard({ node, onClick }: { node: WorkflowSurfaceNode; onClick: () => void }) {
    const { payload, actionId, flags } = node;
    const status = (payload.status || 'pending') as DerivedStatus;
    const statusStyle = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

    // Format relative time
    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    };

    return (
        <div
            onClick={onClick}
            className="bg-ws-panel-bg border border-ws-panel-border rounded-lg p-4 shadow-sm hover:border-indigo-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col h-full"
        >
            {/* Top Row */}
            <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-lg bg-ws-bg border border-ws-panel-border flex items-center justify-center text-ws-text-secondary">
                    <Clock size={16} />
                </div>
                <span
                    className={clsx(
                        'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold uppercase tracking-wide border',
                        statusStyle.bg,
                        statusStyle.text,
                        statusStyle.border
                    )}
                >
                    {statusStyle.label}
                </span>
            </div>

            {/* Main Content */}
            <div className="flex-1 mb-4">
                <h3 className="text-sm font-semibold text-ws-fg leading-tight mb-2 group-hover:text-indigo-700 transition-colors">
                    {payload.title || 'Untitled'}
                </h3>
                <div className="space-y-1.5">
                    <span className="text-[10px] text-ws-muted font-mono">{actionId.slice(0, 12)}...</span>
                    <div className="inline-flex items-center gap-1 bg-ws-bg border border-ws-panel-border text-ws-text-secondary text-[11px] px-1.5 py-0.5 rounded">
                        <FolderOpen size={10} className="text-ws-muted" />
                        {payload.assignees?.[0]?.name || 'Unassigned'}
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 -mx-4 mb-3" />

            {/* Footer */}
            <div className="flex justify-between items-center mt-auto">
                <div className="flex items-center gap-2">
                    {payload.assignees?.[0] && (
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-semibold text-ws-text-secondary">
                            {payload.assignees[0].name?.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                    <span className="text-[10px] text-ws-muted">
                        {formatTime((payload as Record<string, unknown>).updatedAt as string | undefined)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-[10px] text-ws-muted bg-ws-bg px-1.5 py-0.5 rounded border border-ws-panel-border">
                        {String((flags as Record<string, unknown>)?.eventCount ?? 0)} events
                    </div>
                    <Dropdown>
                        <DropdownTrigger
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded flex items-center justify-center text-ws-muted hover:text-ws-text-secondary hover:bg-slate-100 transition-colors"
                        >
                            <MoreHorizontal size={16} />
                        </DropdownTrigger>
                        <DropdownContent align="end" className="w-40">
                            <DropdownItem>View Details</DropdownItem>
                            <DropdownItem>Amend Intent</DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem className="text-red-600">Retract</DropdownItem>
                        </DropdownContent>
                    </Dropdown>
                </div>
            </div>
        </div>
    );
}

export function ActionCardsView() {
    const { activeProjectId, setSelection, toggleComposerBar } = useUIStore();

    // Fetch all workflow nodes for the project
    const { data: nodes = [], isLoading } = useWorkflowSurfaceNodes(activeProjectId, 'project');

    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');

    // Filter nodes
    const filteredNodes = useMemo(() => {
        return nodes.filter((node) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const title = node.payload.title?.toLowerCase() || '';
                const assigneeName = node.payload.assignees?.[0]?.name?.toLowerCase() || '';
                if (!title.includes(query) && !assigneeName.includes(query)) return false;
            }
            // Status filter
            if (filter !== 'all' && node.payload.status !== filter) return false;
            return true;
        });
    }, [nodes, searchQuery, filter]);

    const handleCardClick = (node: WorkflowSurfaceNode) => {
        setSelection({ type: 'action', id: node.actionId });
    };

    if (!activeProjectId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-ws-bg text-ws-muted">
                <div className="text-center">
                    <p className="text-ws-body">Select a project to view actions</p>
                    <p className="text-sm mt-1">Choose from the Projects menu</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-ws-bg/50">
            {/* Toolbar */}
            <div className="h-10 border-b border-ws-panel-border flex items-center justify-between px-4 bg-ws-panel-bg shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ws-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search actions..."
                            className="h-8 pl-8 pr-3 text-xs bg-ws-panel-bg border border-slate-300 rounded focus:outline-none focus:border-indigo-500 w-64 transition-shadow shadow-sm"
                        />
                    </div>
                    <div className="h-4 w-px bg-slate-300" />
                    <div className="flex gap-1">
                        {(['all', 'active', 'blocked', 'finished'] as FilterType[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={clsx(
                                    'h-8 px-3 rounded text-xs font-medium border transition-colors',
                                    filter === f
                                        ? 'bg-slate-100 border-slate-300 text-ws-fg'
                                        : 'bg-ws-panel-bg border-ws-panel-border text-ws-text-secondary hover:bg-ws-bg'
                                )}
                            >
                                {f === 'all' ? 'All' : STATUS_CONFIG[f as DerivedStatus].label}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={toggleComposerBar}
                    className="h-8 px-3 rounded text-xs font-medium bg-slate-900 text-white hover:opacity-90 flex items-center gap-1.5"
                    title="TODO: Replace with Command Palette (#87)"
                >
                    <Plus size={14} /> Declare Action
                </button>
            </div>

            {/* Card Grid */}
            <div className="flex-1 overflow-auto p-6 md:p-8">
                <div className="max-w-[1600px] mx-auto">
                    {filteredNodes.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-ws-muted">
                            <div className="text-center">
                                <p className="text-lg font-medium">No actions found</p>
                                <p className="text-sm mt-1">
                                    {searchQuery || filter !== 'all'
                                        ? 'Try adjusting your filters'
                                        : 'Create your first action to get started'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredNodes.map((node) => (
                                <ActionCard key={node.actionId} node={node} onClick={() => handleCardClick(node)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
