/**
 * FiletreeSelector - File/folder picker from AutoHelper indexed filetree
 *
 * An inline tree component for selecting file paths from the indexed filesystem.
 * Supports folder expansion, search filtering, keyboard navigation, and
 * project-context filtering based on nomenclature pattern [Developer] - [ProjectName].
 */

import { clsx } from 'clsx';
import {
    ChevronRight,
    ChevronDown,
    Folder,
    FolderOpen,
    File,
    Search,
    X,
    RefreshCw,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { useFiletree, type FiletreeNode } from '../../api/hooks';
import { Spinner } from '@autoart/ui';

export interface FiletreeProjectContext {
    developer: string;
    projectName: string;
}

const PROJECT_FOLDER_PATTERN = /^.+ - .+$/;

function isProjectFolder(name: string): boolean {
    return PROJECT_FOLDER_PATTERN.test(name);
}

function matchesProjectContext(folderName: string, ctx: FiletreeProjectContext): boolean {
    const expected = `${ctx.developer} - ${ctx.projectName}`;
    return folderName.toLowerCase() === expected.toLowerCase();
}

interface FiletreeSelectorProps {
    /** Callback when file/folder is selected */
    onSelect: (path: string, isDir: boolean) => void;
    /** Optional: only show specific extensions */
    extensions?: string[];
    /** Optional: filter to specific root */
    rootId?: string;
    /** Optional: max tree depth */
    maxDepth?: number;
    /** Optional: allow selecting directories (default: false, files only) */
    allowDirSelection?: boolean;
    /** Optional: custom height */
    height?: number | string;
    /** Optional: placeholder when empty */
    placeholder?: string;
    /**
     * Project context for filtering.
     * - If provided: only show files within matching project folder
     * - If null/undefined: show everything except project folders
     */
    projectContext?: FiletreeProjectContext | null;
}

interface TreeNodeProps {
    node: FiletreeNode;
    depth: number;
    expandedPaths: Set<string>;
    toggleExpand: (path: string) => void;
    onSelect: (path: string, isDir: boolean) => void;
    allowDirSelection: boolean;
    searchQuery: string;
}

function TreeNode({
    node,
    depth,
    expandedPaths,
    toggleExpand,
    onSelect,
    allowDirSelection,
    searchQuery,
}: TreeNodeProps) {
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isSelectable = node.is_dir ? allowDirSelection : true;

    // Children are already filtered by parent
    const visibleChildren = node.children || [];

    const handleClick = () => {
        if (node.is_dir && hasChildren) {
            toggleExpand(node.path);
        }
        if (isSelectable) {
            onSelect(node.path, node.is_dir);
        }
    };

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleExpand(node.path);
    };

    return (
        <div>
            <div
                onClick={handleClick}
                className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors',
                    isSelectable ? 'hover:bg-slate-100' : 'text-slate-400 cursor-default',
                    depth > 0 && 'ml-4'
                )}
                style={{ paddingLeft: depth * 16 + 8 }}
            >
                {/* Expand/Collapse */}
                {node.is_dir && hasChildren ? (
                    <button
                        onClick={handleExpand}
                        className="p-0.5 hover:bg-slate-200 rounded"
                    >
                        {isExpanded ? (
                            <ChevronDown size={14} className="text-slate-500" />
                        ) : (
                            <ChevronRight size={14} className="text-slate-500" />
                        )}
                    </button>
                ) : (
                    <span className="w-5" /> // Spacer
                )}

                {/* Icon */}
                {node.is_dir ? (
                    isExpanded ? (
                        <FolderOpen size={16} className="text-amber-500 shrink-0" />
                    ) : (
                        <Folder size={16} className="text-amber-500 shrink-0" />
                    )
                ) : (
                    <File size={16} className="text-slate-400 shrink-0" />
                )}

                {/* Name */}
                <span className="text-sm truncate flex-1">{node.name}</span>

                {/* Size badge for files */}
                {!node.is_dir && node.size !== null && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                        {formatBytes(node.size)}
                    </span>
                )}
            </div>

            {/* Children */}
            {isExpanded && visibleChildren.length > 0 && (
                <div>
                    {visibleChildren.map((child) => (
                        <TreeNode
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            expandedPaths={expandedPaths}
                            toggleExpand={toggleExpand}
                            onSelect={onSelect}
                            allowDirSelection={allowDirSelection}
                            searchQuery={searchQuery}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FiletreeSelector({
    onSelect,
    extensions,
    rootId,
    maxDepth = 10,
    allowDirSelection = false,
    height = 300,
    placeholder = 'No files indexed. Run AutoHelper indexer first.',
    projectContext,
}: FiletreeSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

    const { data, isLoading, refetch, isRefetching } = useFiletree({
        rootId,
        maxDepth,
        extensions,
    });

    const toggleExpand = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    /**
     * Filter tree by project context.
     * - If projectContext is provided: only show the matching project folder and its contents
     * - If projectContext is null/undefined: show everything except project folders (files at root level ok)
     */
    const filterByProjectContext = useCallback((nodes: FiletreeNode[]): FiletreeNode[] => {
        return nodes.map(node => {
            if (!node.is_dir) {
                // Files at any level are always shown (project context only restricts folders)
                return node;
            }

            const folderIsProject = isProjectFolder(node.name);

            if (projectContext) {
                // Project selected: only show matching project folder
                if (folderIsProject) {
                    if (matchesProjectContext(node.name, projectContext)) {
                        // This is the matching project folder - show it and all children
                        return node;
                    }
                    // Different project folder - exclude
                    return null;
                }
                // Non-project folder: check if any children match
                const filteredChildren = node.children ? filterByProjectContext(node.children) : [];
                if (filteredChildren.length > 0) {
                    return { ...node, children: filteredChildren };
                }
                // Keep non-project directories even if empty (like "Archive", "Templates", etc.)
                return node;
            } else {
                // No project selected: exclude all project folders, keep everything else
                if (folderIsProject) {
                    return null;
                }
                // Keep non-project folders and their children
                const filteredChildren = node.children ? filterByProjectContext(node.children) : [];
                return { ...node, children: filteredChildren };
            }
        }).filter((n): n is FiletreeNode => n !== null);
    }, [projectContext]);

    // Recursive filter function for search query
    const filterBySearch = useCallback((nodes: FiletreeNode[], query: string): FiletreeNode[] => {
        const lowerQuery = query.toLowerCase();

        return nodes.map(node => {
            const filteredChildren = node.children ? filterBySearch(node.children, query) : [];
            const matchesName = node.name.toLowerCase().includes(lowerQuery);
            const hasMatchingChildren = filteredChildren.length > 0;

            if (matchesName || hasMatchingChildren) {
                return {
                    ...node,
                    children: filteredChildren.length > 0 ? filteredChildren : (matchesName ? node.children : [])
                };
            }

            return null;
        }).filter((n): n is FiletreeNode => n !== null);
    }, []);

    // Apply both filters: project context first, then search
    const filteredRoots = useMemo(() => {
        if (!data?.roots) return [];

        // First apply project context filter
        let filtered = filterByProjectContext(data.roots);

        // Then apply search filter if query exists
        if (searchQuery) {
            filtered = filterBySearch(filtered, searchQuery);
        }

        return filtered;
    }, [data?.roots, searchQuery, filterByProjectContext, filterBySearch]);

    const hasContent = filteredRoots.length > 0;

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            {/* Search Header */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter files..."
                    className="flex-1 text-sm bg-transparent border-none outline-none"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="p-0.5 text-slate-400 hover:text-slate-600"
                    >
                        <X size={14} />
                    </button>
                )}
                <button
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    className={clsx(
                        'p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded',
                        isRefetching && 'animate-spin'
                    )}
                    title="Refresh filetree"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Tree Content */}
            <div
                className="overflow-y-auto"
                style={{ height: typeof height === 'number' ? `${height}px` : height }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Spinner />
                    </div>
                ) : !hasContent ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400 px-4 text-center">
                        {placeholder}
                    </div>
                ) : (
                    <div className="py-1">
                        {filteredRoots.map((root) => (
                            <TreeNode
                                key={root.path}
                                node={root}
                                depth={0}
                                expandedPaths={expandedPaths}
                                toggleExpand={toggleExpand}
                                onSelect={onSelect}
                                allowDirSelection={allowDirSelection}
                                searchQuery={searchQuery}
                            // Ensure we expand all nodes if searching? 
                            // Ideally yes, but for now we rely on user expanding
                            // or we could force expand in the effect
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {hasContent && (
                <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
                    {filteredRoots.length} root{filteredRoots.length !== 1 ? 's' : ''} •
                    Click to select
                </div>
            )}
        </div>
    );
}
