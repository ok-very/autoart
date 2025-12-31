import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import {
  useResolveReference,
  useUpdateReferenceMode,
  useUpdateRecord,
  useDeleteReference,
  useRecord,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { PortalMenu } from '../common/PortalMenu';

type DisplayMode = 'label' | 'value';

export function MentionChip({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const { label, mode, referenceId, triggerChar, recordId, fieldKey, snapshot } = node.attrs;

  // State
  const [showMenu, setShowMenu] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('value');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Refs
  const chipRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hooks
  // 1. Resolve via DB Reference if referenceId exists
  const { data: resolvedRef, refetch: refetchRef } = useResolveReference(referenceId);
  
  // 2. Resolve via Direct Record ID if no referenceId
  const effectiveSourceId = resolvedRef?.sourceRecordId || recordId;
  const { data: sourceRecord } = useRecord(effectiveSourceId || null);

  const updateMode = useUpdateReferenceMode();
  const updateRecord = useUpdateRecord();
  const deleteReference = useDeleteReference();
  const { openDrawer } = useUIStore();

  // Derived Logic
  const isDirect = !referenceId; // True if using direct recordId/fieldKey without DB reference task
  const currentMode = isDirect ? mode : (resolvedRef?.mode ?? mode ?? 'dynamic');
  
  // Resolve Value
  const resolvedValue = useMemo(() => {
    if (isDirect) {
      if (currentMode === 'static') return snapshot;
      if (sourceRecord && fieldKey) return sourceRecord.data?.[fieldKey];
      return undefined;
    } else {
      return resolvedRef?.value;
    }
  }, [isDirect, currentMode, snapshot, sourceRecord, fieldKey, resolvedRef]);

  // Drift Detection
  const hasDrift = useMemo(() => {
    if (isDirect) {
      if (currentMode !== 'static') return false;
      const liveValue = sourceRecord?.data?.[fieldKey];
      // Simple equality check (convert to string for safety)
      return JSON.stringify(liveValue) !== JSON.stringify(snapshot);
    } else {
      return resolvedRef?.drift ?? false;
    }
  }, [isDirect, currentMode, snapshot, sourceRecord, fieldKey, resolvedRef]);

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
    if (!effectiveSourceId) return;

    const val = resolvedValue;
    setEditValue(
      typeof val === 'object'
        ? JSON.stringify(val)
        : String(val ?? '')
    );
    setIsEditing(true);
    setShowMenu(false);
  }, [effectiveSourceId, resolvedValue]);

  // Save edited value to source record
  const handleSaveEdit = useCallback(async () => {
    const targetKey = isDirect ? fieldKey : resolvedRef?.targetFieldKey;
    
    if (!effectiveSourceId || !targetKey) {
      setIsEditing(false);
      return;
    }

    try {
      if (sourceRecord) {
        const currentData = sourceRecord.data || {};
        await updateRecord.mutateAsync({
          id: effectiveSourceId,
          data: { ...currentData, [targetKey]: editValue },
        });
        if (!isDirect) await refetchRef();
      }
    } catch (err) {
      console.error('Failed to update source record:', err);
    }

    setIsEditing(false);
  }, [effectiveSourceId, fieldKey, resolvedRef, isDirect, sourceRecord, editValue, updateRecord, refetchRef]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  // Context menu actions
  const handleToggleMode = async () => {
    const newMode = currentMode === 'static' ? 'dynamic' : 'static';
    
    if (isDirect) {
      // Direct mode: update attributes
      const attrs: any = { mode: newMode };
      if (newMode === 'static') {
        // Snapshot current value
        attrs.snapshot = sourceRecord?.data?.[fieldKey];
      }
      updateAttributes(attrs);
    } else if (referenceId) {
      // DB mode: call API
      try {
        await updateMode.mutateAsync({ id: referenceId, mode: newMode });
        updateAttributes({ mode: newMode });
        refetchRef();
      } catch (err) {
        console.error('Failed to update reference mode:', err);
      }
    }
    setShowMenu(false);
  };

  const handleSyncToLive = async () => {
    if (isDirect) {
      if (hasDrift) {
        updateAttributes({ snapshot: sourceRecord?.data?.[fieldKey] });
      }
    } else if (referenceId && hasDrift) {
      try {
        await updateMode.mutateAsync({ id: referenceId, mode: 'dynamic' });
        updateAttributes({ mode: 'dynamic' });
        refetchRef();
      } catch (err) {
        console.error('Failed to sync reference:', err);
      }
    }
    setShowMenu(false);
  };

  const handleInspectRecord = useCallback(() => {
    if (effectiveSourceId) {
      openDrawer('view-record', { recordId: effectiveSourceId });
    }
    setShowMenu(false);
  }, [effectiveSourceId, openDrawer]);

  const handleViewDefinition = useCallback(() => {
    if (effectiveSourceId) {
      openDrawer('view-definition', { recordId: effectiveSourceId });
    }
    setShowMenu(false);
  }, [effectiveSourceId, openDrawer]);

  const handleUnlink = useCallback(async () => {
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

      // Get the display text to replace with
      const displayText = getDisplayText();

      // Delete the mention node and insert plain text
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .insertContentAt(pos, displayText)
        .run();

      // Delete the reference from database only if it exists
      if (referenceId) {
        await deleteReference.mutateAsync(referenceId);
      }
    } catch (err) {
      console.error('Failed to unlink value:', err);
    }

    setShowMenu(false);
  }, [editor, getPos, node, referenceId, deleteReference, getDisplayText]);

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
          className="text-sm border border-blue-400 rounded px-1.5 py-0.5 min-w-[80px] max-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      ref={chipRef}
      className={clsx(
        'token inline-flex items-center gap-1 cursor-pointer select-none',
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
      <PortalMenu
        isOpen={showMenu}
        anchorRef={chipRef}
        onClose={() => setShowMenu(false)}
        className="min-w-[200px] py-1"
      >
        <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
          Reference Actions
        </div>

        {/* Inspect Record */}
        <button
          onClick={handleInspectRecord}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
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
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
        >
          {displayMode === 'label' ? (
            <FileCode size={14} className="text-slate-500" />
          ) : (
            <Type size={14} className="text-slate-500" />
          )}
          <span>Show {displayMode === 'label' ? 'Value' : 'Label'}</span>
        </button>

        {/* View Definition */}
        <button
          onClick={handleViewDefinition}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
        >
          <FileCode size={14} className="text-purple-500" />
          <span>View Definition</span>
        </button>

        <div className="border-t border-slate-100 my-1" />

        {/* Unlink Value */}
        <button
          onClick={handleUnlink}
          disabled={!isDirect && deleteReference.isPending}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
        >
          <Type size={14} className="text-orange-500" />
          <span>Unlink Value</span>
          <span className="text-[10px] text-slate-400 ml-auto">→ text</span>
        </button>

        <div className="border-t border-slate-100 my-1" />

        {/* Mode Toggle */}
        <button
          onClick={handleToggleMode}
          disabled={!isDirect && updateMode.isPending}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
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
            disabled={!isDirect && updateMode.isPending}
            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 text-amber-600"
          >
            <RefreshCw size={14} />
            <span>Sync to Live Value</span>
          </button>
        )}

        {/* Mode info footer */}
        <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 mt-1">
          {currentMode === 'static' ? (
            <span>Snapshot: won't update when source changes</span>
          ) : (
            <span>Live: updates when source changes</span>
          )}
        </div>
      </PortalMenu>
    </NodeViewWrapper>
  );
}