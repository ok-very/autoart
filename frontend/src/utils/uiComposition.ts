import type { ProjectViewMode } from '@autoart/shared';
import { Selection, InspectorMode, UIPanels, OverlayConfig } from '../types/ui';

type CompositionState = {
    selection: Selection;
    projectViewMode: ProjectViewMode;
    activeOverlay: OverlayConfig | null;
    inspectorCollapsed: boolean;
    sidebarCollapsed: boolean;
    inspectorTabMode: string; // 'record', 'schema', etc.
};

export function deriveUIPanels(state: CompositionState): UIPanels {
    const {
        selection,
        projectViewMode,
        activeOverlay,
        inspectorCollapsed,
        sidebarCollapsed,
        inspectorTabMode
    } = state;

    // 1. Sidebar Logic
    let sidebar: UIPanels['sidebar'] = 'projectTree';
    if (sidebarCollapsed) {
        sidebar = null;
    }
    // Future: if (viewMode === 'zen') sidebar = null;

    // 2. Workspace Logic - driven only by projectViewMode
    let workspace: UIPanels['workspace'] = 'projectWorkflow'; // Fallback
    switch (projectViewMode) {
        case 'log':
            workspace = 'projectLog';
            sidebar = null;
            break;
        case 'columns':
            workspace = 'millerColumns';
            sidebar = null;
            break;
        case 'workflow':
            workspace = 'projectWorkflow';
            sidebar = null;
            break;
        case 'list':
            workspace = 'list';
            sidebar = null;
            break;
        case 'cards':
            workspace = 'cards';
            sidebar = null;
            break;
        default:
            workspace = 'projectWorkflow';
            break;
    }

    // 3. Inspector Logic
    // Don't show inspector for Miller Columns - they use their own navigation
    let inspector: InspectorMode = null;
    const hideInspector = projectViewMode === 'columns';

    if (!inspectorCollapsed && selection && !hideInspector) {
        // If we have a selection, we show the inspector unless explicitly collapsed
        if (selection.type === 'record') {
            inspector = { view: 'record', id: selection.id, tab: inspectorTabMode };
        } else if (selection.type === 'node') {
            // Nodes usually inspected as records or just node properties
            inspector = { view: 'record', id: selection.id, tab: inspectorTabMode };
        } else if (selection.type === 'definition') {
            inspector = { view: 'schema', id: selection.id };
        }
    }

    return {
        sidebar,
        workspace,
        inspector,
        overlay: activeOverlay
    };
}
