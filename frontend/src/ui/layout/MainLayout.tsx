/**
 * MainLayout
 *
 * Root layout component.
 * - Header (fixed)
 * - Sidebar (HierarchySidebar with resize handle)
 * - DockviewWorkspace (unified grid for center, right, bottom panels)
 */

// import { useCallback } from 'react';

import { Header } from './Header';
import { useUIPanels } from '../../stores/uiStore';
// import { ResizeHandle } from '../common/ResizeHandle';
// import { HierarchySidebar } from '../hierarchy/HierarchySidebar';
import { DockviewWorkspace } from '../workspace/DockviewWorkspace';
import { ModalRegistry } from '../registry/ModalRegistry';

return (
  <div className="flex flex-col h-full">
    <Header />
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar Slot - Removed, now integrated into ProjectWorkflowView */}
      {/*
        {panels.sidebar === 'projectTree' && (
          <>
            <HierarchySidebar />
            <ResizeHandle direction="right" onResize={handleSidebarResize} />
          </>
        )}
        */}

      {/* Unified Dockview Workspace */}
      <DockviewWorkspace />

      {/* Global Modals */}
      <ModalRegistry />
    </div>
  </div>
);
}
