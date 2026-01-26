import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, Folder } from 'lucide-react';

import { useUIStore } from '@/stores/uiStore';
import { useProjects } from '@/api/hooks/hierarchy';
import { fuzzySearchMultiField } from '@/utils/fuzzySearch';

export function CommandPalette() {
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useUIStore((s) => s.closeCommandPalette);
  const setActiveProject = useUIStore((s) => s.setActiveProject);
  const { data: projects = [] } = useProjects();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter projects by query
  const filtered = useMemo(() => {
    if (!query.trim()) return projects;
    return fuzzySearchMultiField(
      query,
      projects,
      [{ key: 'title', extractor: (p) => p.title, weight: 1 }]
    ).map((r) => r.item);
  }, [projects, query]);

  // Reset state when opening
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [commandPaletteOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!commandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            setActiveProject(filtered[selectedIndex].id);
            closeCommandPalette();
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
  }, [commandPaletteOpen, filtered, selectedIndex, setActiveProject, closeCommandPalette]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!commandPaletteOpen) return null;

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
            placeholder="Search projects..."
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No projects found
            </div>
          ) : (
            filtered.map((project, index) => (
              <button
                key={project.id}
                data-index={index}
                onClick={() => {
                  setActiveProject(project.id);
                  closeCommandPalette();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 ${
                  index === selectedIndex ? 'bg-blue-50' : ''
                }`}
              >
                <Folder className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium">{project.title}</span>
              </button>
            ))
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
