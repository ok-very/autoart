import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Search,
  Folder,
  FileText,
  Zap,
  FolderPlus,
  FilePlus,
  PanelLeft,
  PanelRight,
  GitBranch,
  List,
  LayoutGrid,
  Columns,
  Terminal,
} from 'lucide-react';

import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useProjects } from '@/api/hooks/hierarchy';
import { useRecords } from '@/api/hooks/entities/records';
import { useAllActions } from '@/api/hooks/actions/actions';
import { fuzzySearchMultiField, fuzzySearch } from '@/utils/fuzzySearch';
import type { HierarchyNode, DataRecord } from '@/types';
import type { ProjectViewMode } from '@autoart/shared';
import type { Action } from '@autoart/shared';

type ResultCategory = 'project' | 'record' | 'action';
type PaletteMode = 'search' | 'command';

interface SearchResult {
  id: string;
  category: ResultCategory;
  label: string;
  sublabel?: string;
}

interface Command {
  id: string;
  label: string;
  icon: typeof Folder;
  action: () => void;
}

const CATEGORY_CONFIG: Record<ResultCategory, { icon: typeof Folder; label: string }> = {
  project: { icon: Folder, label: 'Projects' },
  record: { icon: FileText, label: 'Records' },
  action: { icon: Zap, label: 'Actions' },
};

function getActionLabel(action: Action): string {
  // Try to extract a name from fieldBindings (with null safety)
  const bindings = action.fieldBindings ?? [];
  const nameBinding = bindings.find(
    (b) => b.fieldKey === 'name' || b.fieldKey === 'title'
  );
  if (nameBinding?.value && typeof nameBinding.value === 'string') {
    return nameBinding.value;
  }
  // Fall back to action type
  return action.type ?? 'Action';
}

export function CommandPalette() {
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useUIStore((s) => s.closeCommandPalette);
  const setActiveProject = useUIStore((s) => s.setActiveProject);
  const inspectRecord = useUIStore((s) => s.inspectRecord);
  const inspectAction = useUIStore((s) => s.inspectAction);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleInspector = useUIStore((s) => s.toggleInspector);
  const setProjectViewMode = useWorkspaceStore((s) => s.setProjectViewMode);
  const openOverlay = useUIStore((s) => s.openOverlay);

  // Generate unique IDs for ARIA
  const listboxId = 'command-palette-listbox';
  const getOptionId = (index: number) => `command-palette-option-${index}`;

  const { data: projects = [] } = useProjects();
  const { data: records = [] } = useRecords();
  const { data: actionsData } = useAllActions({ limit: 200 });
  const actions = useMemo(() => actionsData?.actions ?? [], [actionsData?.actions]);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Detect mode based on query prefix
  const mode: PaletteMode = query.startsWith('>') ? 'command' : 'search';
  const cleanQuery = mode === 'command' ? query.slice(1).trim() : query;

  // Command registry
  const commands = useMemo<Command[]>(() => [
    {
      id: 'new-project',
      label: 'Create Project',
      icon: FolderPlus,
      action: () => openOverlay('create-project'),
    },
    {
      id: 'new-record',
      label: 'Create Record',
      icon: FilePlus,
      action: () => openOverlay('create-record'),
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      icon: PanelLeft,
      action: toggleSidebar,
    },
    {
      id: 'toggle-inspector',
      label: 'Toggle Inspector',
      icon: PanelRight,
      action: toggleInspector,
    },
    {
      id: 'view-workflow',
      label: 'View: Workflow',
      icon: GitBranch,
      action: () => setProjectViewMode('workflow' as ProjectViewMode),
    },
    {
      id: 'view-log',
      label: 'View: Log',
      icon: List,
      action: () => setProjectViewMode('log' as ProjectViewMode),
    },
    {
      id: 'view-cards',
      label: 'View: Cards',
      icon: LayoutGrid,
      action: () => setProjectViewMode('cards' as ProjectViewMode),
    },
    {
      id: 'view-columns',
      label: 'View: Columns',
      icon: Columns,
      action: () => setProjectViewMode('columns' as ProjectViewMode),
    },
  ], [openOverlay, toggleSidebar, toggleInspector, setProjectViewMode]);

  // Filtered commands
  const filteredCommands = useMemo(() => {
    if (!cleanQuery.trim()) return commands;
    return fuzzySearch(
      cleanQuery,
      commands,
      (c) => c.label
    ).map((r) => r.item);
  }, [commands, cleanQuery]);

  // Combined search results across all categories
  const searchResults = useMemo<SearchResult[]>(() => {
    const allResults: SearchResult[] = [];

    if (!cleanQuery.trim()) {
      // Show recent/all projects when no query
      projects.slice(0, 10).forEach((p) => {
        allResults.push({ id: p.id, category: 'project', label: p.title ?? 'Untitled' });
      });
      return allResults;
    }

    // Search projects
    fuzzySearchMultiField(
      cleanQuery,
      projects,
      [{ key: 'title', extractor: (p: HierarchyNode) => p.title ?? '', weight: 1 }]
    ).slice(0, 5).forEach((r) => {
      allResults.push({ id: r.item.id, category: 'project', label: r.item.title ?? 'Untitled' });
    });

    // Search records
    fuzzySearchMultiField(
      cleanQuery,
      records,
      [{ key: 'unique_name', extractor: (r: DataRecord) => r.unique_name ?? '', weight: 1 }]
    ).slice(0, 5).forEach((r) => {
      allResults.push({
        id: r.item.id,
        category: 'record',
        label: r.item.unique_name ?? 'Unnamed',
      });
    });

    // Search actions
    fuzzySearchMultiField(
      cleanQuery,
      actions,
      [
        { key: 'type', extractor: (a: Action) => a.type ?? '', weight: 0.5 },
        { key: 'label', extractor: (a: Action) => getActionLabel(a), weight: 1 },
      ]
    ).slice(0, 5).forEach((r) => {
      allResults.push({
        id: r.item.id,
        category: 'action',
        label: getActionLabel(r.item),
        sublabel: r.item.type ?? 'Action',
      });
    });

    return allResults;
  }, [projects, records, actions, cleanQuery]);

  // Group results by category for display
  const groupedResults = useMemo(() => {
    const groups: { category: ResultCategory; items: SearchResult[] }[] = [];
    const categoryOrder: ResultCategory[] = ['project', 'record', 'action'];

    for (const cat of categoryOrder) {
      const items = searchResults.filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  }, [searchResults]);

  // Total items for navigation
  const totalItems = mode === 'command' ? filteredCommands.length : searchResults.length;

  // Clamp selectedIndex when totalItems changes to prevent out-of-bounds
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (totalItems === 0) return 0;
      if (prev >= totalItems) return totalItems - 1;
      return prev;
    });
  }, [totalItems]);

  // Reset state when opening
  useEffect(() => {
    if (!commandPaletteOpen) return;
    setQuery('');
    setSelectedIndex(0);
    const timeoutId = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeoutId);
  }, [commandPaletteOpen]);

  // Handle result selection
  const handleSelectSearch = useCallback((result: SearchResult) => {
    switch (result.category) {
      case 'project':
        setActiveProject(result.id);
        break;
      case 'record':
        inspectRecord(result.id);
        break;
      case 'action':
        inspectAction(result.id);
        break;
    }
    closeCommandPalette();
  }, [setActiveProject, inspectRecord, inspectAction, closeCommandPalette]);

  // Handle command selection
  const handleSelectCommand = useCallback((command: Command) => {
    command.action();
    closeCommandPalette();
  }, [closeCommandPalette]);

  // Keyboard navigation
  useEffect(() => {
    if (!commandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (totalItems > 0 ? Math.min(i + 1, totalItems - 1) : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter': {
          e.preventDefault();
          // Clamp index inline to handle race conditions
          const safeIndex = Math.max(0, Math.min(selectedIndex, totalItems - 1));
          if (mode === 'command') {
            const cmd = filteredCommands[safeIndex];
            if (cmd) handleSelectCommand(cmd);
          } else {
            const result = searchResults[safeIndex];
            if (result) handleSelectSearch(result);
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          closeCommandPalette();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, mode, totalItems, selectedIndex, filteredCommands, searchResults, handleSelectCommand, handleSelectSearch, closeCommandPalette]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!commandPaletteOpen) return null;

  // Calculate the flat index for search results
  let flatIndex = 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeCommandPalette}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-ws-panel-bg rounded-lg shadow-2xl border border-ws-panel-border">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ws-panel-border">
          {mode === 'command' ? (
            <Terminal className="w-5 h-5 text-violet-500" />
          ) : (
            <Search className="w-5 h-5 text-ws-muted" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={mode === 'command' ? 'Type a command...' : 'Search or type > for commands...'}
            className="flex-1 outline-none text-sm bg-transparent"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={totalItems > 0 ? getOptionId(selectedIndex) : undefined}
            aria-autocomplete="list"
          />
        </div>

        {/* Results */}
        <div ref={listRef} id={listboxId} role="listbox" className="max-h-80 overflow-y-auto">
          {mode === 'command' ? (
            // Command mode
            filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ws-text-secondary">
                No commands found
              </div>
            ) : (
              <div>
                <div className="px-4 py-1.5 text-xs font-medium text-ws-muted uppercase tracking-wide bg-ws-bg">
                  Commands
                </div>
                {filteredCommands.map((command, index) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      id={getOptionId(index)}
                      data-index={index}
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleSelectCommand(command)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-ws-bg ${
                        index === selectedIndex ? 'bg-blue-50' : ''
                      }`}
                    >
                      <Icon className="w-4 h-4 text-violet-500 flex-shrink-0" />
                      <span className="text-sm font-medium">{command.label}</span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            // Search mode
            searchResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ws-text-secondary">
                No results found
              </div>
            ) : (
              groupedResults.map((group) => {
                const config = CATEGORY_CONFIG[group.category];
                // Skip unknown categories to prevent runtime errors
                if (!config) return null;
                return (
                  <div key={group.category}>
                    {/* Category header */}
                    <div className="px-4 py-1.5 text-xs font-medium text-ws-muted uppercase tracking-wide bg-ws-bg">
                      {config.label}
                    </div>
                    {/* Items */}
                    {group.items.map((result) => {
                      const currentIndex = flatIndex++;
                      const Icon = config.icon;
                      return (
                        <button
                          key={result.id}
                          id={getOptionId(currentIndex)}
                          data-index={currentIndex}
                          role="option"
                          aria-selected={currentIndex === selectedIndex}
                          onClick={() => handleSelectSearch(result)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-ws-bg ${
                            currentIndex === selectedIndex ? 'bg-blue-50' : ''
                          }`}
                        >
                          <Icon className="w-4 h-4 text-ws-muted flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {result.label}
                            </span>
                            {result.sublabel && (
                              <span className="text-xs text-ws-muted truncate block">
                                {result.sublabel}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-ws-panel-border bg-ws-bg text-xs text-ws-text-secondary">
          <span>
            <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">Enter</kbd> Select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">Esc</kbd> Close
          </span>
          {mode === 'search' && (
            <span className="ml-auto">
              <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">&gt;</kbd> Commands
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
