/**
 * MainLayout
 *
 * Root layout component.
 * - Header (fixed)
 * - Sidebar (HierarchySidebar with resize handle)
 * - DockviewWorkspace (unified grid for center, right, bottom panels)
 */

import { useCallback } from 'react';

import { Header } from './Header';
import { useUIStore, useUIPanels } from '../../stores/uiStore';
import { ResizeHandle } from '../common/ResizeHandle';
import { HierarchySidebar } from '../hierarchy/HierarchySidebar';
import { DockviewWorkspace } from '../workspace/DockviewWorkspace';
import { ModalRegistry } from '../registry/ModalRegistry';

export function MainLayout() {
  const { sidebarWidth, setSidebarWidth } = useUIStore();
  const panels = useUIPanels();

  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth(sidebarWidth + delta);
    },
    [sidebarWidth, setSidebarWidth]
  );

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Slot */}
        {panels.sidebar === 'projectTree' && (
          <>
            <HierarchySidebar />
            <ResizeHandle direction="right" onResize={handleSidebarResize} />
          </>
        )}

        {/* Unified Dockview Workspace */}
        <DockviewWorkspace />

        {/* Global Modals */}
        <ModalRegistry />
      </div>
    </div>
  );
}
