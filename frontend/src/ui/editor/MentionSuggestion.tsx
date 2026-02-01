import { clsx } from 'clsx';
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

import { useSearch } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { SearchResult } from '../../types';
import { fuzzySearch } from '../../utils/fuzzySearch';

interface MentionSuggestionProps {
  query: string;
  triggerChar: '@' | '#';
  onSelect: (item: SearchResult, fieldKey?: string) => void;
}

export interface MentionSuggestionRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export const MentionSuggestion = forwardRef<MentionSuggestionRef, MentionSuggestionProps>(
  ({ query, triggerChar, onSelect }, ref) => {
    const { activeProjectId } = useUIStore();
    const { data: results, isLoading } = useSearch(query, activeProjectId || undefined);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
    const [showFields, setShowFields] = useState(false);
    const [fieldQuery, setFieldQuery] = useState('');
    const prevFilteredItemsLengthRef = useRef(0);
    const prevShowFieldsRef = useRef(showFields);
    const prevSelectedItemRef = useRef(selectedItem);

    // Apply fuzzy filtering on client-side for better UX
    const filteredItems = useMemo(() => {
      if (!results) return [];
      if (!query.trim()) return results;

      // Apply fuzzy search for client-side refinement
      const fuzzyResults = fuzzySearch(
        query,
        results,
        (item) => item.name,
        { threshold: 0.1, limit: 10 }
      );

      return fuzzyResults.map((r) => r.item);
    }, [results, query]);

    // Fuzzy filter fields when in field selection mode
    const filteredFields = useMemo(() => {
      if (!showFields || !selectedItem?.fields) return [];
      if (!fieldQuery.trim()) return selectedItem.fields;

      const fuzzyResults = fuzzySearch(
        fieldQuery,
        selectedItem.fields,
        (field) => `${field.key} ${field.label}`,
        { threshold: 0.1 }
      );

      return fuzzyResults.map((r) => r.item);
    }, [showFields, selectedItem, fieldQuery]);

    // Reset selection when results change
    useEffect(() => {
      if (filteredItems.length !== prevFilteredItemsLengthRef.current) {
        prevFilteredItemsLengthRef.current = filteredItems.length;
        // Defer setState to avoid synchronous cascading render
        requestAnimationFrame(() => setSelectedIndex(0));
      }
    }, [filteredItems]);

    // Reset field selection when switching items
    useEffect(() => {
      const showFieldsChanged = showFields !== prevShowFieldsRef.current;
      const selectedItemChanged = selectedItem !== prevSelectedItemRef.current;

      if (showFieldsChanged || selectedItemChanged) {
        prevShowFieldsRef.current = showFields;
        prevSelectedItemRef.current = selectedItem;

        if (showFields) {
          // Defer setState to avoid synchronous cascading render
          requestAnimationFrame(() => {
            setSelectedIndex(0);
            setFieldQuery('');
          });
        }
      }
    }, [showFields, selectedItem]);

    const selectItem = useCallback(
      (index: number) => {
        const item = filteredItems[index];
        if (!item) return;

        if (item.fields && item.fields.length > 0) {
          setSelectedItem(item);
          setShowFields(true);
          setSelectedIndex(0);
        } else {
          onSelect(item);
        }
      },
      [filteredItems, onSelect]
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
      setFieldQuery('');
    }, []);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        const currentItems = showFields ? filteredFields : filteredItems;

        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) =>
            prev <= 0 ? currentItems.length - 1 : prev - 1
          );
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) =>
            prev >= currentItems.length - 1 ? 0 : prev + 1
          );
          return true;
        }

        if (event.key === 'Enter') {
          if (showFields && filteredFields[selectedIndex]) {
            selectField(filteredFields[selectedIndex].key);
          } else if (!showFields && filteredItems[selectedIndex]) {
            selectItem(selectedIndex);
          }
          return true;
        }

        if (event.key === 'Escape') {
          if (showFields) {
            goBack();
            return true;
          }
          return false;
        }

        if (event.key === 'Backspace' && showFields && fieldQuery === '') {
          goBack();
          return true;
        }

        return false;
      },
    }));

    // Header showing current trigger mode
    const triggerLabel = triggerChar === '@' ? 'Mention' : 'Reference';
    const triggerColor = triggerChar === '@' ? 'text-purple-600' : 'text-blue-600';

    if (isLoading) {
      return (
        <div className="mention-dropdown">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <span className={clsx('text-sm font-semibold', triggerColor)}>{triggerChar}</span>
            <span className="text-xs text-slate-400">{triggerLabel}</span>
          </div>
          <div className="p-4 text-center text-slate-400 text-sm">
            <div className="inline-block animate-spin w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full mr-2" />
            Searching...
          </div>
        </div>
      );
    }

    if (!showFields && filteredItems.length === 0) {
      return (
        <div className="mention-dropdown">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <span className={clsx('text-sm font-semibold', triggerColor)}>{triggerChar}</span>
            <span className="text-xs text-slate-400">
              {query ? `Search: "${query}"` : triggerLabel}
            </span>
          </div>
          <div className="p-4 text-center text-slate-400 text-sm">
            {query ? 'No matches found' : 'Type to search...'}
          </div>
        </div>
      );
    }

    // Show field selector
    if (showFields && selectedItem) {
      return (
        <div className="mention-dropdown">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={goBack}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ← Back
              </button>
              <span className="text-xs text-slate-500">Select field from:</span>
            </div>
            <div className="text-sm font-medium text-slate-700">{selectedItem.name}</div>
          </div>
          {filteredFields.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              No fields available
            </div>
          ) : (
            filteredFields.map((field, index) => (
              <div
                key={field.key}
                onClick={() => selectField(field.key)}
                className={clsx('mention-dropdown-item', {
                  'is-selected': index === selectedIndex,
                })}
              >
                <span className="text-xs font-mono text-blue-500 shrink-0">{field.key}</span>
                <span className="text-sm text-slate-700 truncate">{field.label}</span>
              </div>
            ))
          )}
        </div>
      );
    }

    // Show records/nodes list
    return (
      <div className="mention-dropdown">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span className={clsx('text-sm font-semibold', triggerColor)}>{triggerChar}</span>
          <span className="text-xs text-slate-400">
            {query ? `Search: "${query}"` : triggerLabel}
          </span>
          <span className="text-[10px] text-slate-300 ml-auto">
            {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
          </span>
        </div>
        {filteredItems.map((item, index) => (
          <div
            key={item.id}
            onClick={() => selectItem(index)}
            className={clsx('mention-dropdown-item', {
              'is-selected': index === selectedIndex,
            })}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className={clsx('text-[10px] font-semibold uppercase px-1 py-0.5 rounded shrink-0', {
                  'bg-blue-100 text-blue-700': item.type === 'record',
                  'bg-purple-100 text-purple-700': item.type === 'node',
                })}
              >
                {item.type === 'record' ? item.definitionName : item.nodeType}
              </span>
              <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
              {item.path && item.path !== item.name && (
                <span className="text-[10px] text-slate-400 truncate" title={item.path}>
                  {item.path}
                </span>
              )}
            </div>
            {item.fields && item.fields.length > 0 && (
              <span className="text-[10px] text-slate-400 shrink-0">
                {item.fields.length} fields →
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
);

MentionSuggestion.displayName = 'MentionSuggestion';
