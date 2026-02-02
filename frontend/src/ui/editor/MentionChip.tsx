import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { clsx } from 'clsx';
import {
  Link2,
  Unlink,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  FileCode,
  Type,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  useUpdateRecord,
  useRecord,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { PopoverRoot, PopoverTrigger, PopoverContent } from '@autoart/ui';

type DisplayMode = 'label' | 'value';

export function MentionChip({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const { label, mode, referenceId, triggerChar, recordId, fieldKey, snapshot } = node.attrs;

  // State
  const [showMenu, setShowMenu] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('value');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);

  // Hooks - always resolve via direct Record ID
  const { data: sourceRecord } = useRecord(recordId || null);

  const updateRecord = useUpdateRecord();
  const { inspectRecord, openOverlay } = useUIStore();

  // All references are now direct (embedded in document)
  const currentMode = mode ?? 'dynamic';

  // Resolve Value
  const resolvedValue = useMemo(() => {
    if (currentMode === 'static') return snapshot;
    if (sourceRecord && fieldKey) return sourceRecord.data?.[fieldKey];
    return undefined;
  }, [currentMode, snapshot, sourceRecord, fieldKey]);

  // Drift Detection
  const hasDrift = useMemo(() => {
    if (currentMode !== 'static') return false;
    const liveValue = sourceRecord?.data?.[fieldKey];
    return JSON.stringify(liveValue) !== JSON.stringify(snapshot);
  }, [currentMode, snapshot, sourceRecord, fieldKey]);

  const trigger = triggerChar || '#';

  // Determine what to display based on mode
  const getDisplayText = useCallback(() => {
    if (displayMode === 'label') {
      return label;
    }

    // Value mode
    const value = resolvedValue;
    if (value === undefined || value === null) {
      return label;
    }

    // Check for :all prefix - show "RecordName: value"
    if (label && label.includes(':all') && sourceRecord) {
      const recordName = sourceRecord.unique_name || 'Record';
      return `${recordName}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
    }

    // Just show the value
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }, [displayMode, label, resolvedValue, sourceRecord]);

  // Simple click handler - toggle menu
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent editor selection from interfering
    e.stopPropagation();
    // Don't open if editing
    if (isEditing) return;
    setShowMenu((prev) => !prev);
  }, [isEditing]);

  // Open context menu (Right click)
  const handleOpenMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(true);
  }, []);

  // Double-click: Start inline editing
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!recordId) return;

    const val = resolvedValue;
    setEditValue(
      typeof val === 'object'
        ? JSON.stringify(val)
        : String(val ?? '')
    );
    setIsEditing(true);
    setShowMenu(false);
  }, [recordId, resolvedValue]);

  // Save edited value to source record
  const handleSaveEdit = useCallback(async () => {
    if (!recordId || !fieldKey) {
      setIsEditing(false);
      return;
    }

    try {
      if (sourceRecord) {
        const currentData = sourceRecord.data || {};
        await updateRecord.mutateAsync({
          id: recordId,
          data: { ...currentData, [fieldKey]: editValue },
        });
      }
    } catch (err) {
      console.error('Failed to update source record:', err);
    }

    setIsEditing(false);
  }, [recordId, fieldKey, sourceRecord, editValue, updateRecord]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  // Context menu actions
  const handleToggleMode = () => {
    const newMode = currentMode === 'static' ? 'dynamic' : 'static';
    const attrs: Record<string, unknown> = { mode: newMode };
    if (newMode === 'static') {
      attrs.snapshot = sourceRecord?.data?.[fieldKey];
    }
    updateAttributes(attrs);
    setShowMenu(false);
  };

  const handleSyncToLive = () => {
    if (hasDrift) {
      updateAttributes({ snapshot: sourceRecord?.data?.[fieldKey] });
    }
    setShowMenu(false);
  };

  const handleInspectRecord = useCallback(() => {
    if (recordId) {
      inspectRecord(recordId);
    }
    setShowMenu(false);
  }, [recordId, inspectRecord]);

  const handleViewDefinition = useCallback(() => {
    if (recordId) {
      openOverlay('view-definition', { recordId });
    }
    setShowMenu(false);
  }, [recordId, openOverlay]);

  const handleUnlink = useCallback(() => {
    if (!editor || typeof getPos !== 'function') {
      setShowMenu(false);
      return;
    }

    try {
      const pos = getPos();
      if (typeof pos !== 'number') {
        setShowMenu(false);
        return;
      }

      const displayText = getDisplayText();

      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .insertContentAt(pos, displayText)
        .run();
    } catch (err) {
      console.error('Failed to unlink value:', err);
    }

    setShowMenu(false);
  }, [editor, getPos, node, getDisplayText]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Styling
  const triggerClass = trigger === '@' ? 'mention-at' : 'mention-hash';
  const modeClass = currentMode === 'static' ? 'token-static' : 'token-dynamic';

  // Render inline edit mode
  if (isEditing) {
    return (
      <NodeViewWrapper
        as="span"
        className="inline-flex items-center"
        data-reference-id={referenceId}
      >
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSaveEdit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              handleCancelEdit();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="text-sm border border-blue-400 rounded px-1.5 py-0.5 min-w-[80px] max-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-ws-panel-bg"
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className={clsx(
        'token inline-flex items-center gap-1 cursor-pointer select-none relative',
        triggerClass,
        modeClass,
        hasDrift && 'token-drift',
        displayMode === 'value' && 'token-showing-value'
      )}
      data-reference-id={referenceId}
      data-mode={currentMode}
      data-trigger={trigger}
      data-display-mode={displayMode}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleOpenMenu}
    >
      {/* Mode indicator icon */}
      {currentMode === 'static' ? (
        <Unlink size={12} className="opacity-60" />
      ) : (
        <Link2 size={12} className="opacity-60" />
      )}

      {/* Label/Value */}
      <span>{getDisplayText()}</span>

      {/* Drift warning */}
      {hasDrift && (
        <span title="Value has changed since snapshot">
          <AlertTriangle size={12} className="text-amber-500" />
        </span>
      )}

      {/* Portal-based Context Menu */}
      <PopoverRoot open={showMenu} onOpenChange={setShowMenu}>
        <PopoverTrigger asChild>
          <span className="absolute inset-0" />
        </PopoverTrigger>
        <PopoverContent className="min-w-[200px] p-0" align="start" sideOffset={8}>
          <div className="px-3 py-1.5 text-[10px] text-ws-muted uppercase font-semibold border-b border-ws-panel-border">
            Reference Actions
          </div>

          {/* Inspect Record */}
          <button
            onClick={handleInspectRecord}
            className="w-full px-3 py-2 text-left text-sm hover:bg-ws-bg flex items-center gap-2"
          >
            <ExternalLink size={14} className="text-blue-500" />
            <span>Inspect Record</span>
          </button>

          {/* Toggle Display */}
          <button
            onClick={() => {
              setDisplayMode(prev => prev === 'label' ? 'value' : 'label');
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-ws-bg flex items-center gap-2"
          >
            {displayMode === 'label' ? (
              <FileCode size={14} className="text-ws-text-secondary" />
            ) : (
              <Type size={14} className="text-ws-text-secondary" />
            )}
            <span>Show {displayMode === 'label' ? 'Value' : 'Label'}</span>
          </button>

          {/* View Definition */}
          <button
            onClick={handleViewDefinition}
            className="w-full px-3 py-2 text-left text-sm hover:bg-ws-bg flex items-center gap-2"
          >
            <FileCode size={14} className="text-purple-500" />
            <span>View Definition</span>
          </button>

          <div className="border-t border-ws-panel-border my-1" />

          {/* Unlink Value */}
          <button
            onClick={handleUnlink}
            className="w-full px-3 py-2 text-left text-sm hover:bg-ws-bg flex items-center gap-2"
          >
            <Type size={14} className="text-orange-500" />
            <span>Unlink Value</span>
            <span className="text-[10px] text-ws-muted ml-auto">→ text</span>
          </button>

          <div className="border-t border-ws-panel-border my-1" />

          {/* Mode Toggle */}
          <button
            onClick={handleToggleMode}
            className="w-full px-3 py-2 text-left text-sm hover:bg-ws-bg flex items-center gap-2"
          >
            {currentMode === 'static' ? (
              <>
                <Link2 size={14} className="text-blue-500" />
                <span>Make Dynamic</span>
              </>
            ) : (
              <>
                <Unlink size={14} className="text-orange-500" />
                <span>Make Static</span>
              </>
            )}
          </button>

          {/* Sync to Live (if drift) */}
          {hasDrift && (
            <button
              onClick={handleSyncToLive}
              className="w-full px-3 py-2 text-left text-sm hover:bg-ws-bg flex items-center gap-2 text-amber-600"
            >
              <RefreshCw size={14} />
              <span>Sync to Live Value</span>
            </button>
          )}

          {/* Mode info footer */}
          <div className="px-3 py-1.5 text-[10px] text-ws-muted border-t border-ws-panel-border mt-1">
            {currentMode === 'static' ? (
              <span>Snapshot: won't update when source changes</span>
            ) : (
              <span>Live: updates when source changes</span>
            )}
          </div>
        </PopoverContent>
      </PopoverRoot>
    </NodeViewWrapper>
  );
}
