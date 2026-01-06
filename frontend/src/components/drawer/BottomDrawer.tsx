import { useCallback } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { ResizeHandle } from '../common/ResizeHandle';
import { DrawerRegistry } from './DrawerRegistry';

export function BottomDrawer() {
  const { activeDrawer, drawerHeight, drawerCollapsed, setDrawerHeight, toggleDrawer, closeDrawer } = useUIStore();

  const handleResize = useCallback(
    (delta: number) => {
      // Delta is negative when dragging up (reducing Y), so we add -delta to height
      // If we drag UP, Y decreases, so delta is negative.
      // We want height to INCREASE when dragging UP.
      // So newHeight = currentHeight - delta
      setDrawerHeight(drawerHeight - delta);
    },
    [drawerHeight, setDrawerHeight]
  );

  if (!activeDrawer) return null;

  // Collapsed state: show slim header only
  const effectiveHeight = drawerCollapsed ? 40 : drawerHeight;

  return (
    <div
      className="border-t border-slate-200 bg-white flex flex-col shrink-0 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 transition-all duration-200"
      style={{ height: effectiveHeight }}
    >
      {!drawerCollapsed && <ResizeHandle direction="top" onResize={handleResize} />}

      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          {activeDrawer.type.replace(/-/g, ' ')}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDrawer}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors"
            title={drawerCollapsed ? 'Expand drawer' : 'Collapse drawer'}
          >
            {drawerCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={closeDrawer}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors"
            title="Close drawer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!drawerCollapsed && (
        <div className="flex-1 overflow-auto p-4 custom-scroll">
          <DrawerRegistry type={activeDrawer.type} context={activeDrawer.props} onClose={closeDrawer} />
        </div>
      )}
    </div>
  );
}

