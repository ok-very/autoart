/**
 * DataGridView
 * 
 * A premium card grid view for displaying records/actions.
 * Radix-style design with:
 * - Responsive grid layout (1-4 columns)
 * - Card hover effects with elevation
 * - Status badges (active/blocked/done)
 * - Context pills for metadata
 * - Search and filter toolbar
 */

import { useState, useMemo } from 'react';
import {
    Search,
    CheckSquare,
    Users,
    FileText,
    AlertCircle,
    DollarSign,
    ShoppingCart,
    Box,
    MoreHorizontal,
    Plus,
    Loader2,
    FolderOpen
} from 'lucide-react';

import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { HierarchyNode } from '../../types';
import { parseTaskMetadata, deriveTaskStatus } from '../../utils/nodeMetadata';
import { StatusKey, STATUS_COLORS } from '../../utils/statusUtils';

// Parse metadata safely
const parseMetadata = (metadata: HierarchyNode['metadata']): Record<string, unknown> => {
    if (typeof metadata === 'string') {
        try { return JSON.parse(metadata); }
        catch { return {}; }
    }
    return metadata || {};
};

// Type icon mapping
const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
        'task': <CheckSquare size={18} />,
        'meeting': <Users size={18} />,
        'document': <FileText size={18} />,
        'issue': <AlertCircle size={18} />,
        'finance': <DollarSign size={18} />,
        'procurement': <ShoppingCart size={18} />,
        'subprocess': <Box size={18} />,
    };
    return icons[type] || <Box size={18} />;
};

// Status badge component
function StatusBadge({ status }: { status: StatusKey }) {
    const styles: Record<string, string> = {
        'active': 'bg-indigo-100 text-indigo-700 border-indigo-200',
        'blocked': 'bg-red-100 text-red-600 border-red-200',
        'done': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'pending': 'bg-amber-100 text-amber-700 border-amber-200',
        'default': 'bg-slate-100 text-slate-600 border-slate-200',
    };

    const icons: Record<string, React.ReactNode> = {
        'active': <Loader2 size={12} className="animate-spin" />,
        'blocked': <AlertCircle size={12} />,
        'done': <CheckSquare size={12} />,
    };

    return (
        <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${styles[status] || styles.default}`}>
            {icons[status]}
            {status}
        </span>
    );
}

// Context pill component
function ContextPill({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-600 text-[11px] px-1.5 py-0.5 rounded max-w-full overflow-hidden whitespace-nowrap text-ellipsis">
            {icon && <span className="text-slate-400">{icon}</span>}
            {children}
        </span>
    );
}

// Single action card
interface ActionCardProps {
    node: HierarchyNode;
    onClick: () => void;
}

function ActionCard({ node, onClick }: ActionCardProps) {
    const meta = parseMetadata(node.metadata);
    const taskMeta = parseTaskMetadata(meta);
    const status = deriveTaskStatus(taskMeta);
    const type = node.type || 'task';

    // Format updated time (mock for now)
    const updatedTime = '2m ago';

    // Get parent context
    const { getNode } = useHierarchyStore();
    const parent = node.parent_id ? getNode(node.parent_id) : null;
    const contextLabel = parent?.title || 'Project';

    return (
        <div
            onClick={onClick}
            className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-indigo-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col h-full"
        >
            {/* Top Row */}
            <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                    {getTypeIcon(type)}
                </div>
                <StatusBadge status={status} />
            </div>

            {/* Main Content */}
            <div className="flex-1 mb-4">
                <h3 className="text-sm font-bold text-slate-800 leading-tight mb-2 group-hover:text-indigo-700 transition-colors">
                    {node.title}
                </h3>

                {/* Metadata Stack */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                            {node.id.slice(0, 12)}...
                        </span>
                    </div>
                    <ContextPill icon={<FolderOpen size={12} />}>
                        {contextLabel}
                    </ContextPill>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 -mx-4 mb-3" />

            {/* Footer */}
            <div className="flex justify-between items-center mt-auto">
                <div className="flex items-center gap-2">
                    <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-white shadow-sm"
                        style={{ backgroundColor: STATUS_COLORS[status] || '#94a3b8', color: 'white' }}
                        title={status}
                    >
                        {status.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{updatedTime}</span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        <span>•</span> {taskMeta.tags?.length || 0}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <MoreHorizontal size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Filter type
type FilterType = 'all' | 'active' | 'blocked' | 'done';

export function DataGridView() {
    const { getChildren } = useHierarchyStore();
    const { activeProjectId, setSelection, openDrawer } = useUIStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');

    // Collect all actionable nodes (tasks, subprocesses) from the project
    const allNodes = useMemo(() => {
        if (!activeProjectId) return [];

        const collectNodes = (parentId: string): HierarchyNode[] => {
            const children = getChildren(parentId);
            let result: HierarchyNode[] = [];

            for (const child of children) {
                // Include tasks and subprocesses as action cards
                if (child.type === 'task' || child.type === 'subprocess') {
                    result.push(child);
                }
                // Recurse into stages and subprocesses
                if (child.type === 'stage' || child.type === 'subprocess') {
                    result = result.concat(collectNodes(child.id));
                }
            }
            return result;
        };

        return collectNodes(activeProjectId);
    }, [activeProjectId, getChildren]);

    // Filter nodes based on search and status filter
    const filteredNodes = useMemo(() => {
        return allNodes.filter(node => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!node.title.toLowerCase().includes(query)) return false;
            }

            // Status filter
            if (filter !== 'all') {
                const meta = parseMetadata(node.metadata);
                const taskMeta = parseTaskMetadata(meta);
                const status = deriveTaskStatus(taskMeta);
                if (status !== filter) return false;
            }

            return true;
        });
    }, [allNodes, searchQuery, filter]);

    const handleCardClick = (node: HierarchyNode) => {
        setSelection({ type: 'node', id: node.id });
    };

    if (!activeProjectId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
                <div className="text-center">
                    <p className="text-lg font-medium">Select a project to view actions</p>
                    <p className="text-sm mt-1">Choose from the Projects menu</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Toolbar */}
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search actions..."
                            className="h-8 pl-8 pr-3 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-indigo-500 w-64 transition-shadow shadow-sm"
                        />
                    </div>

                    <div className="h-4 w-px bg-slate-300" />

                    {/* Filter Buttons */}
                    <div className="flex gap-1">
                        {(['all', 'active', 'blocked', 'done'] as FilterType[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`h-8 px-3 rounded text-xs font-medium border transition-colors ${filter === f
                                        ? 'bg-slate-100 border-slate-300 text-slate-800'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => openDrawer('create-node', { parentId: activeProjectId, nodeType: 'task' })}
                    className="h-8 px-3 rounded text-xs font-medium bg-slate-900 text-white hover:opacity-90 flex items-center gap-1.5"
                >
                    <Plus size={14} /> Declare Action
                </button>
            </div>

            {/* Card Grid */}
            <div className="flex-1 overflow-auto p-6 md:p-8">
                <div className="max-w-[1600px] mx-auto">
                    {filteredNodes.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-slate-400">
                            <div className="text-center">
                                <Box size={48} className="mx-auto mb-4 text-slate-300" />
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
                                <ActionCard
                                    key={node.id}
                                    node={node}
                                    onClick={() => handleCardClick(node)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
