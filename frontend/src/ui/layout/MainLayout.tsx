import { useCallback } from 'react';

import { CalendarView } from './CalendarView';
import { Header } from './Header';
import { MillerColumnsView } from './MillerColumnsView';
import { ProjectWorkflowView } from './ProjectWorkflowView';
import { Workspace } from './Workspace';
import { useUIStore, useUIPanels } from '../../stores/uiStore';
import { ResizeHandle } from '../common/ResizeHandle';
import { HierarchySidebar } from '../hierarchy/HierarchySidebar';
import { ProjectLogSurface } from '../projectLog';
import { RightPanelGroup } from '../workspace/RightPanelGroup';
import { BottomPanelGroup } from '../workspace/BottomPanelGroup';



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

        {/* Workspace Slot */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {panels.workspace === 'millerColumns' && <MillerColumnsView />}
          {panels.workspace === 'projectWorkflow' && <ProjectWorkflowView />}
          {panels.workspace === 'projectLog' && <ProjectLogSurface />}
          {panels.workspace === 'calendar' && <CalendarView />}
          {(panels.workspace === 'grid' || panels.workspace === 'details') && <Workspace />}

          {/* Bottom Panel Group - Dockview managed */}
          <BottomPanelGroup />
        </div>

        {/* Right Panel Group - Dockview managed */}
        <RightPanelGroup />
      </div>
    </div>
  );
}
