/**
 * ComposerPopout
 *
 * Lightweight draggable popout for quick action declaration.
 * Modeless — no backdrop, user can interact with panels behind it.
 * Escape closes (with confirmation if dirty). Ctrl+Shift+N toggles.
 */

import { createPortal } from 'react-dom';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useWorkspaceContextOptional } from '../../workspace/WorkspaceContext';
import { ComposerPopoutContent } from './ComposerPopoutContent';

const WIDTH = 480;
const HEIGHT = 520;

/** Gate component — renders nothing when hidden, mounts inner when visible. */
export function ComposerPopout() {
  const composerPopoutVisible = useUIStore((s) => s.composerPopoutVisible);
  if (!composerPopoutVisible) return null;
  return <ComposerPopoutInner />;
}

/** Inner popout — mounts fresh each open so useState initializer re-centers. */
function ComposerPopoutInner() {
  const { composerPopoutContext, closeComposerPopout } = useUIStore();
  const wsContext = useWorkspaceContextOptional();

  // Merge explicit context with workspace fallback
  const effectiveContext = useMemo(() => {
    if (!composerPopoutContext && !wsContext?.boundProjectId) return null;
    return {
      ...composerPopoutContext,
      projectId: composerPopoutContext?.projectId ?? wsContext?.boundProjectId ?? undefined,
    };
  }, [composerPopoutContext, wsContext?.boundProjectId]);

  const [position, setPosition] = useState(() => ({
    x: Math.max(0, (window.innerWidth - WIDTH) / 2),
    y: Math.max(0, (window.innerHeight - HEIGHT) / 3),
  }));
  const [hasContent, setHasContent] = useState(false);
  const dragRef = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);

  // Drag
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { mx: e.clientX, my: e.clientY, sx: position.x, sy: position.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = dragRef.current.sx + (ev.clientX - dragRef.current.mx);
      const ny = dragRef.current.sy + (ev.clientY - dragRef.current.my);
      setPosition({
        x: Math.max(0, Math.min(nx, window.innerWidth - WIDTH)),
        y: Math.max(0, Math.min(ny, window.innerHeight - 40)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [position]);

  const handleClose = useCallback(() => {
    if (hasContent) {
      const confirmed = window.confirm('Discard unsaved changes?');
      if (!confirmed) return;
    }
    closeComposerPopout();
  }, [hasContent, closeComposerPopout]);

  // Global Escape — works regardless of focus
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [handleClose]);

  return createPortal(
    <div
      className="fixed z-50 flex flex-col bg-ws-panel-bg border border-ws-panel-border rounded-lg shadow-2xl"
      style={{ left: position.x, top: position.y, width: WIDTH, height: HEIGHT }}
    >
      <div className="flex-1 overflow-hidden rounded-t-lg">
        <ComposerPopoutContent
          context={effectiveContext}
          onHasContentChange={setHasContent}
          onClose={handleClose}
          onDragStart={onDragStart}
        />
      </div>
    </div>,
    document.body
  );
}
