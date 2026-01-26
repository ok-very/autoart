import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, Folder, FileText, Zap } from 'lucide-react';

import { useUIStore } from '@/stores/uiStore';
import { useProjects } from '@/api/hooks/hierarchy';
import { useRecords } from '@/api/hooks/entities/records';
import { useAllActions } from '@/api/hooks/actions/actions';
import { fuzzySearchMultiField } from '@/utils/fuzzySearch';
import type { HierarchyNode, DataRecord } from '@/types';
import type { Action } from '@autoart/shared';

type ResultCategory = 'project' | 'record' | 'action';

interface SearchResult {
  id: string;
  category: ResultCategory;
  label: string;
  sublabel?: string;
}

const CATEGORY_CONFIG: Record<ResultCategory, { icon: typeof Folder; label: string }> = {
  project: { icon: Folder, label: 'Projects' },
  record: { icon: FileText, label: 'Records' },
  action: { icon: Zap, label: 'Actions' },
};

function getActionLabel(action: Action): string {
  // Try to extract a name from fieldBindings
  const nameBinding = action.fieldBindings.find(
    (b) => b.fieldKey === 'name' || b.fieldKey === 'title'
  );
  if (nameBinding?.value && typeof nameBinding.value === 'string') {
    return nameBinding.value;
  }
  // Fall back to action type
  return action.type;
}

export function CommandPalette() {
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useUIStore((s) => s.closeCommandPalette);
  const setActiveProject = useUIStore((s) => s.setActiveProject);
  const inspectRecord = useUIStore((s) => s.inspectRecord);
  const inspectAction = useUIStore((s) => s.inspectAction);

  const { data: projects = [] } = useProjects();
  const { data: records = [] } = useRecords();
  const { data: actionsData } = useAllActions({ limit: 200 });
  const actions = actionsData?.actions ?? [];

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Combined search results across all categories
  const results = useMemo<SearchResult[]>(() => {
    const allResults: SearchResult[] = [];

    if (!query.trim()) {
      // Show recent/all projects when no query
      projects.slice(0, 10).forEach((p) => {
        allResults.push({ id: p.id, category: 'project', label: p.title });
      });
      return allResults;
    }

    // Search projects
    fuzzySearchMultiField(
      query,
      projects,
      [{ key: 'title', extractor: (p: HierarchyNode) => p.title, weight: 1 }]
    ).slice(0, 5).forEach((r) => {
      allResults.push({ id: r.item.id, category: 'project', label: r.item.title });
    });

    // Search records
    fuzzySearchMultiField(
      query,
      records,
      [{ key: 'unique_name', extractor: (r: DataRecord) => r.unique_name, weight: 1 }]
    ).slice(0, 5).forEach((r) => {
      allResults.push({
        id: r.item.id,
        category: 'record',
        label: r.item.unique_name,
      });
    });

    // Search actions
    fuzzySearchMultiField(
      query,
      actions,
      [
        { key: 'type', extractor: (a: Action) => a.type, weight: 0.5 },
        { key: 'label', extractor: (a: Action) => getActionLabel(a), weight: 1 },
      ]
    ).slice(0, 5).forEach((r) => {
      allResults.push({
        id: r.item.id,
        category: 'action',
        label: getActionLabel(r.item),
        sublabel: r.item.type,
      });
    });

    return allResults;
  }, [projects, records, actions, query]);

  // Group results by category for display
  const groupedResults = useMemo(() => {
    const groups: { category: ResultCategory; items: SearchResult[] }[] = [];
    const categoryOrder: ResultCategory[] = ['project', 'record', 'action'];

    for (const cat of categoryOrder) {
      const items = results.filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  }, [results]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(() => results, [results]);

  // Reset state when opening
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [commandPaletteOpen]);

  // Handle result selection
  const handleSelect = (result: SearchResult) => {
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
  };

  // Keyboard navigation
  useEffect(() => {
    if (!commandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            handleSelect(flatResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeCommandPalette();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, flatResults, selectedIndex, closeCommandPalette]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!commandPaletteOpen) return null;

  // Calculate the flat index for each item
  let flatIndex = 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeCommandPalette}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl border border-slate-200">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search projects, records, actions..."
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {flatResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No results found
            </div>
          ) : (
            groupedResults.map((group) => {
              const config = CATEGORY_CONFIG[group.category];
              return (
                <div key={group.category}>
                  {/* Category header */}
                  <div className="px-4 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-50">
                    {config.label}
                  </div>
                  {/* Items */}
                  {group.items.map((result) => {
                    const currentIndex = flatIndex++;
                    const Icon = config.icon;
                    return (
                      <button
                        key={result.id}
                        data-index={currentIndex}
                        onClick={() => handleSelect(result)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 ${
                          currentIndex === selectedIndex ? 'bg-blue-50' : ''
                        }`}
                      >
                        <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {result.label}
                          </span>
                          {result.sublabel && (
                            <span className="text-xs text-slate-400 truncate block">
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
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          <span>
            <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">Enter</kbd> Select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
