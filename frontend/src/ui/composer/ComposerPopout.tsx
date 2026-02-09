/**
 * ComposerPopout
 *
 * Floating overlay for declaring Actions from anywhere in the workspace.
 * Uses position: fixed via React Portal, NOT Dockview.
 * Modeless (no backdrop, no focus trap) - user can interact with panels behind it.
 *
 * Features:
 * - Draggable title bar
 * - Resizable from bottom-right corner
 * - Escape key closes (with confirmation if hasContent)
 * - Global keyboard shortcut: Ctrl+Shift+N (Cmd+Shift+N on Mac)
 */

import { createPortal } from 'react-dom';
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, GripHorizontal } from 'lucide-react';

import { useUIStore } from '../../stores/uiStore';
import { ComposerPopoutContent } from './ComposerPopoutContent';

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 600;

export function ComposerPopout() {
  const { composerPopoutVisible, composerPopoutContext, closeComposerPopout } = useUIStore();

  // Position and size state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startWidth: number; startHeight: number } | null>(null);

  // Center on mount
  useEffect(() => {
    if (composerPopoutVisible && position.x === 0 && position.y === 0) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPosition({
        x: Math.max(0, (vw - DEFAULT_WIDTH) / 2),
        y: Math.max(0, (vh - DEFAULT_HEIGHT) / 3),
      });
    }
  }, [composerPopoutVisible, position]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  }, [position]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    const newX = dragStartRef.current.startX + dx;
    const newY = dragStartRef.current.startY + dy;

    // Clamp to viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampedX = Math.max(0, Math.min(newX, vw - size.width));
    const clampedY = Math.max(0, Math.min(newY, vh - size.height));

    setPosition({ x: clampedX, y: clampedY });
  }, [isDragging, size]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStartRef.current) return;

    const dx = e.clientX - resizeStartRef.current.mouseX;
    const dy = e.clientY - resizeStartRef.current.mouseY;

    const newWidth = Math.max(MIN_WIDTH, resizeStartRef.current.startWidth + dx);
    const newHeight = Math.max(MIN_HEIGHT, resizeStartRef.current.startHeight + dy);

    setSize({ width: newWidth, height: newHeight });
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeStartRef.current = null;
  }, []);

  // Global mouse handlers
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Close with confirmation if has content
  const handleClose = useCallback(() => {
    if (hasContent) {
      const confirmed = window.confirm('Discard unsaved changes?');
      if (!confirmed) return;
    }
    closeComposerPopout();
  }, [hasContent, closeComposerPopout]);

  // Escape key handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  }, [handleClose]);

  if (!composerPopoutVisible) return null;

  return createPortal(
    <div
      className="fixed z-50 flex flex-col bg-ws-panel-bg border border-ws-panel-border rounded-lg shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Title bar (draggable) */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-ws-panel-border bg-ws-bg rounded-t-lg cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 text-ws-text-secondary">
          <GripHorizontal size={16} className="text-ws-muted" />
          <span className="text-sm font-medium">Composer</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-ws-panel-bg rounded transition-colors text-ws-muted hover:text-ws-text-secondary"
          aria-label="Close composer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ComposerPopoutContent
          context={composerPopoutContext}
          onHasContentChange={setHasContent}
        />
      </div>

      {/* Resize handle (bottom-right corner) */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={handleResizeStart}
        aria-label="Resize composer"
      >
        <svg
          className="absolute bottom-0 right-0 w-4 h-4 text-ws-muted"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M14 14L14 10L16 10L16 16L10 16L10 14L14 14Z" />
          <path d="M8 14L8 12L10 12L10 14L8 14Z" />
          <path d="M12 8L12 10L14 10L14 8L12 8Z" />
        </svg>
      </div>
    </div>,
    document.body
  );
}
