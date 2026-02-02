/**
 * TextPruningSection Component
 *
 * Collapsible section for editing and pruning extracted text elements.
 */

import { useState } from 'react';
import { Stack, Text, Button, Inline } from '@autoart/ui';
import { ChevronDown, ChevronRight, Trash2, RotateCcw, Edit2, Check, X } from 'lucide-react';
import clsx from 'clsx';
import type { TextElement } from '../types';

export interface TextPruningSectionProps {
  textElements: TextElement[];
  prunedTextIds: Set<string>;
  onPrune: (id: string) => void;
  onRestore: (id: string) => void;
  onUpdateText: (id: string, newContent: string) => void;
}

export function TextPruningSection({
  textElements,
  prunedTextIds,
  onPrune,
  onRestore,
  onUpdateText,
}: TextPruningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const activeCount = textElements.filter((t) => !prunedTextIds.has(t.id)).length;

  const handleStartEdit = (element: TextElement) => {
    setEditingId(element.id);
    setEditValue(element.content);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      onUpdateText(editingId, editValue);
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handlePruneAll = () => {
    textElements.forEach((t) => {
      if (!prunedTextIds.has(t.id)) {
        onPrune(t.id);
      }
    });
  };

  const handleRestoreAll = () => {
    textElements.forEach((t) => {
      if (prunedTextIds.has(t.id)) {
        onRestore(t.id);
      }
    });
  };

  return (
    <div className="border border-ws-panel-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-ws-bg px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <Inline gap="sm" align="center">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-ws-text-secondary" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ws-text-secondary" />
          )}
          <Text weight="medium">Text Elements</Text>
        </Inline>
        <Text size="sm" color="muted">
          {activeCount} of {textElements.length} active
        </Text>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-ws-panel-border">
          {/* Bulk actions */}
          {textElements.length > 0 && (
            <div className="px-4 py-2 bg-slate-25 border-b border-ws-panel-border">
              <Inline gap="xs">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRestoreAll}
                  disabled={prunedTextIds.size === 0}
                >
                  Keep All
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePruneAll}
                  disabled={activeCount === 0}
                >
                  Remove All
                </Button>
              </Inline>
            </div>
          )}

          {/* Text list */}
          <div className="p-4">
            {textElements.length === 0 ? (
              <Text size="sm" color="muted">
                No text elements extracted. Text from the source (bio, captions, alt text) will appear here.
              </Text>
            ) : (
              <Stack gap="sm">
                {textElements.map((element) => {
                  const isPruned = prunedTextIds.has(element.id);
                  const isEditing = editingId === element.id;

                  return (
                    <div
                      key={element.id}
                      className={clsx(
                        'p-3 rounded-lg border transition-colors',
                        isPruned
                          ? 'bg-ws-bg border-ws-panel-border opacity-60'
                          : 'bg-ws-panel-bg border-ws-panel-border'
                      )}
                    >
                      {isEditing ? (
                        <Stack gap="sm">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                            autoFocus
                          />
                          <Inline gap="xs" justify="end">
                            <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                            <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                              <Check className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                          </Inline>
                        </Stack>
                      ) : (
                        <Inline justify="between" align="start" gap="md">
                          <div className="flex-1 min-w-0">
                            <Text
                              size="sm"
                              className={clsx(
                                'line-clamp-2',
                                isPruned && 'line-through'
                              )}
                            >
                              {element.content}
                            </Text>
                            {element.source && (
                              <Text size="xs" color="muted" className="mt-1">
                                Source: {element.source}
                              </Text>
                            )}
                          </div>
                          <Inline gap="xs" className="flex-shrink-0">
                            {!isPruned && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(element)}
                                className="p-1.5 text-ws-muted hover:text-ws-text-secondary hover:bg-slate-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {isPruned ? (
                              <button
                                type="button"
                                onClick={() => onRestore(element.id)}
                                className="p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Restore"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onPrune(element.id)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </Inline>
                        </Inline>
                      )}
                    </div>
                  );
                })}
              </Stack>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
