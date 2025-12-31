import { useCallback } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { ResizeHandle } from '../common/ResizeHandle';
import { DrawerRegistry } from './DrawerRegistry';

export function BottomDrawer() {
  const { activeDrawer, drawerHeight, setDrawerHeight, closeDrawer } = useUIStore();

  const handleResize = useCallback(
    (delta: number) => {
      // Delta is negative when dragging up (reducing Y), so we add -delta to height
      // Wait, ResizeHandle usually gives delta in pixels.
      // If we drag UP, Y decreases, so delta is negative.
      // We want height to INCREASE when dragging UP.
      // So newHeight = currentHeight - delta
      setDrawerHeight(drawerHeight - delta);
    },
    [drawerHeight, setDrawerHeight]
  );

  if (!activeDrawer) return null;

  return (
    <div
      className="border-t border-slate-200 bg-white flex flex-col shrink-0 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40"
      style={{ height: drawerHeight }}
    >
      <ResizeHandle direction="top" onResize={handleResize} />
      
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          {activeDrawer.type.replace(/_/g, ' ')}
        </h3>
        <button
          onClick={closeDrawer}
          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scroll">
        <DrawerRegistry type={activeDrawer.type} props={activeDrawer.props} />
      </div>
    </div>
  );
}
