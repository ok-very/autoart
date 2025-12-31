import { useCallback, useRef } from 'react';

interface InteractionConfig {
  /** Handler for single click (with delay to distinguish from double-click) */
  onSingleClick?: () => void;
  /** Handler for double click */
  onDoubleClick?: () => void;
  /** Handler for right click (context menu) */
  onRightClick?: () => void;
  /** Handler for long press */
  onLongPress?: () => void;
  /** Delay in ms before long press triggers. Default: 500 */
  longPressDelay?: number;
  /** Delay in ms to wait before confirming single click. Default: 200 */
  doubleClickDelay?: number;
}

interface InteractionHandlers {
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}

/**
 * Hook to cleanly separate different click interaction types.
 * Properly handles single-click vs double-click detection,
 * right-click context menu, and long-press without timer conflicts.
 *
 * Key behaviors:
 * - Single-click: Delayed execution (200ms), cancelled if double-click fires
 * - Double-click: Native onDoubleClick, cancels single-click timer
 * - Right-click: Native onContextMenu, NO timer interference
 * - Long-press: onMouseDown starts timer, onMouseUp/onMouseLeave cancels
 */
export function useInteractionHandlers(config: InteractionConfig): InteractionHandlers {
  const {
    onSingleClick,
    onDoubleClick,
    onRightClick,
    onLongPress,
    longPressDelay = 500,
    doubleClickDelay = 200,
  } = config;

  const clickTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  // Clear single-click timer
  const clearClickTimer = useCallback(() => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  // Clear long-press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle click (potentially single-click with delay)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // If long press already fired, don't handle as click
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        return;
      }

      // Clear any existing single-click timer
      clearClickTimer();

      // Set timer for single-click (will be cancelled if double-click fires)
      if (onSingleClick) {
        clickTimerRef.current = window.setTimeout(() => {
          onSingleClick();
          clickTimerRef.current = null;
        }, doubleClickDelay);
      }
    },
    [onSingleClick, doubleClickDelay, clearClickTimer]
  );

  // Handle double-click
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Cancel single-click timer
      clearClickTimer();

      if (onDoubleClick) {
        onDoubleClick();
      }
    },
    [onDoubleClick, clearClickTimer]
  );

  // Handle right-click (context menu) - native event, no timer interference
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel any pending timers
      clearClickTimer();
      clearLongPressTimer();

      if (onRightClick) {
        onRightClick();
      }
    },
    [onRightClick, clearClickTimer, clearLongPressTimer]
  );

  // Handle mouse down (start long-press timer)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start long-press on left mouse button
      if (e.button !== 0) return;

      longPressFiredRef.current = false;

      if (onLongPress) {
        longPressTimerRef.current = window.setTimeout(() => {
          longPressFiredRef.current = true;
          onLongPress();
          longPressTimerRef.current = null;
        }, longPressDelay);
      }
    },
    [onLongPress, longPressDelay]
  );

  // Handle mouse up (cancel long-press timer)
  const handleMouseUp = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  // Handle mouse leave (cancel long-press timer)
  const handleMouseLeave = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  return {
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    onContextMenu: handleContextMenu,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
  };
}
