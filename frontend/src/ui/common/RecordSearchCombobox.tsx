import { useState, useEffect, useCallback, useMemo, useRef, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Search, X, ArrowLeft } from 'lucide-react';
import { useSearch } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { fuzzySearch } from '../../utils/fuzzySearch';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { SearchResult } from '../../types';

interface RecordSearchComboboxProps {
  /** Initial search query */
  query?: string;
  /** Trigger character that opened the combobox (@ or #) */
  triggerChar?: '@' | '#';
  /** Position to anchor the dropdown */
  position: { top: number; left: number };
  /** Callback when item is selected */
  onSelect: (item: SearchResult, fieldKey?: string) => void;
  /** Callback when combobox should close */
  onClose: () => void;
  /** Optional: filter to specific record types */
  definitionId?: string;
  /** Optional: show field selection step (default: true for #, false for @) */
  showFieldSelection?: boolean;
  /** Optional: exclude a specific record ID (for self-reference prevention) */
  excludeRecordId?: string;
  /** Optional: Ref to the parent input element to prevent closing when clicking it */
  parentRef?: RefObject<HTMLElement | null>;
}

export function RecordSearchCombobox({
  query: initialQuery = '',
  triggerChar = '#',
  position,
  onSelect,
  onClose,
  definitionId,
  showFieldSelection,
  excludeRecordId,
  parentRef,
}: RecordSearchComboboxProps) {
  const { activeProjectId } = useUIStore();
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [showFields, setShowFields] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside both the combobox and the parent input
  useClickOutside([containerRef, parentRef || { current: null }], onClose);

  // Determine if field selection should be shown
  const shouldShowFieldSelection = showFieldSelection ?? triggerChar === '#';

  // Search with API
  const { data: results, isLoading } = useSearch(query, activeProjectId || undefined, true);

  // Apply fuzzy filtering on client-side
  const filteredItems = useMemo(() => {
    if (!results) return [];

    let items = results;

    // Filter by definition if specified
    if (definitionId) {
      items = items.filter(
        (item) => item.type === 'record' && item.definitionId === definitionId
      );
    }

    // Exclude specific record (for self-reference prevention)
    if (excludeRecordId) {
      items = items.filter((item) => item.id !== excludeRecordId);
    }

    if (!query.trim()) return items.slice(0, 10);

    const fuzzyResults = fuzzySearch(query, items, (item) => item.name, {
      threshold: 0.1,
      limit: 10,
    });

    return fuzzyResults.map((r) => r.item);
  }, [results, query, definitionId, excludeRecordId]);

  // Fuzzy filter fields when in field selection mode
  const filteredFields = useMemo(() => {
    if (!showFields || !selectedItem?.fields) return [];
    return selectedItem.fields;
  }, [showFields, selectedItem]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const selectItem = useCallback(
    (index: number) => {
      const item = filteredItems[index];
      if (!item) return;

      if (shouldShowFieldSelection && item.fields && item.fields.length > 0) {
        setSelectedItem(item);
        setShowFields(true);
        setSelectedIndex(0);
      } else {
        onSelect(item);
      }
    },
    [filteredItems, onSelect, shouldShowFieldSelection]
  );

  const selectField = useCallback(
    (fieldKey: string) => {
      if (selectedItem) {
        onSelect(selectedItem, fieldKey);
      }
    },
    [selectedItem, onSelect]
  );

  const goBack = useCallback(() => {
    setShowFields(false);
    setSelectedItem(null);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentItems = showFields ? filteredFields : filteredItems;

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev <= 0 ? currentItems.length - 1 : prev - 1));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev >= currentItems.length - 1 ? 0 : prev + 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (showFields && filteredFields[selectedIndex]) {
          selectField(filteredFields[selectedIndex].key);
        } else if (!showFields && filteredItems[selectedIndex]) {
          selectItem(selectedIndex);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (showFields) {
          goBack();
        } else {
          onClose();
        }
      } else if (event.key === 'Backspace' && showFields && query === '') {
        goBack();
      }
    },
    [showFields, filteredFields, filteredItems, selectedIndex, selectField, selectItem, goBack, onClose, query]
  );

  const triggerLabel = triggerChar === '@' ? 'Mention' : 'Reference';
  const triggerColor = triggerChar === '@' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50';

  const dropdown = (
    <div
      ref={containerRef}
      className="fixed bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-[9999]"
      style={{
        top: position.top,
        left: position.left,
        minWidth: 320,
        maxWidth: 420,
        maxHeight: 400,
      }}
    >
      {/* Search Header */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        {showFields && selectedItem ? (
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
            >
              <ArrowLeft size={14} />
            </button>
            <span className="text-xs text-slate-500">Select field from:</span>
            <span className="text-sm font-medium text-slate-700">{selectedItem.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', triggerColor)}>
              {triggerChar}
            </span>
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Search ${triggerLabel.toLowerCase()}s...`}
                className="w-full pl-7 pr-8 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            <div className="inline-block animate-spin w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full mr-2" />
            Searching...
          </div>
        ) : showFields ? (
          // Field list
          filteredFields.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">No fields available</div>
          ) : (
            filteredFields.map((field, index) => (
              <div
                key={field.key}
                onClick={() => selectField(field.key)}
                className={clsx(
                  'px-3 py-2.5 cursor-pointer flex items-center gap-3 border-b border-slate-50 transition-colors',
                  index === selectedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'
                )}
              >
                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {field.key}
                </span>
                <span className="text-sm text-slate-700">{field.label}</span>
              </div>
            ))
          )
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            {query ? 'No matches found' : 'Type to search...'}
          </div>
        ) : (
          // Record list
          filteredItems.map((item, index) => (
            <div
              key={item.id}
              onClick={() => selectItem(index)}
              className={clsx(
                'px-3 py-2.5 cursor-pointer flex items-center gap-2 border-b border-slate-50 transition-colors',
                index === selectedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'
              )}
            >
              <span
                className={clsx('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0', {
                  'bg-blue-100 text-blue-700': item.type === 'record',
                  'bg-purple-100 text-purple-700': item.type === 'node',
                })}
              >
                {item.type === 'record' ? item.definitionName : item.nodeType}
              </span>
              <span className="text-sm font-medium text-slate-700 truncate flex-1">{item.name}</span>
              {item.fields && item.fields.length > 0 && shouldShowFieldSelection && (
                <span className="text-[10px] text-slate-400 shrink-0">{item.fields.length} fields →</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-3">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  );

  return createPortal(dropdown, document.body);
}
