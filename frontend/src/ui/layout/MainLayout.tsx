import { AlertTriangle } from 'lucide-react';
import { useCallback, Component, ReactNode, ErrorInfo } from 'react';

import { CalendarView } from './CalendarView';
import { Header } from './Header';
import { MillerColumnsView } from './MillerColumnsView';
import { ProjectWorkflowView } from './ProjectWorkflowView';
import { Workspace } from './Workspace';
import { useUIStore, useUIPanels } from '../../stores/uiStore';
import { SelectionInspector } from '../../ui/composites';
import { ResizeHandle } from '../common/ResizeHandle';
import { BottomDrawer } from '../drawer/BottomDrawer';
import { Sidebar } from '../hierarchy/Sidebar';
import { ProjectLogSurface } from '../projectLog';

// Local error boundary for inspector to prevent full app crash
interface InspectorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class InspectorErrorBoundary extends Component<{ children: ReactNode; width: number }, InspectorErrorBoundaryState> {
  state: InspectorErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): InspectorErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Inspector Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <aside
          className="bg-white border-l border-slate-200 flex flex-col shrink-0 p-4"
          style={{ width: this.props.width }}
        >
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">Inspector Error</span>
          </div>
          <p className="text-xs text-slate-600 mb-3 font-mono break-all">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded"
          >
            Try Again
          </button>
        </aside>
      );
    }
    return this.props.children;
  }
}

export function MainLayout() {
  const { sidebarWidth, inspectorWidth, setSidebarWidth, setInspectorWidth } = useUIStore();
  const panels = useUIPanels();

  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth(sidebarWidth + delta);
    },
    [sidebarWidth, setSidebarWidth]
  );

  const handleInspectorResize = useCallback(
    (delta: number) => {
      setInspectorWidth(inspectorWidth + delta);
    },
    [inspectorWidth, setInspectorWidth]
  );

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Slot */}
        {panels.sidebar === 'projectTree' && (
          <>
            <Sidebar />
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

          {/* Drawer Slot - positioned at bottom of workspace container for now or fixed */}
          <BottomDrawer />
        </div>

        {/* Inspector Slot */}
        {panels.inspector && (
          <>
            <ResizeHandle direction="left" onResize={handleInspectorResize} />
            <InspectorErrorBoundary width={inspectorWidth}>
              <SelectionInspector />
            </InspectorErrorBoundary>
          </>
        )}
      </div>
    </div>
  );
}
