import { Selection, InspectorMode, UIPanels, DrawerConfig } from '../types/ui';

type CompositionState = {
    selection: Selection;
    viewMode: string;
    activeDrawer: DrawerConfig | null;
    inspectorCollapsed: boolean;
    sidebarCollapsed: boolean;
    inspectorTabMode: string; // 'record', 'schema', etc.
};

export function deriveUIPanels(state: CompositionState): UIPanels {
    const {
        selection,
        viewMode,
        activeDrawer,
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

    // 2. Workspace Logic
    let workspace: UIPanels['workspace'] = 'grid'; // Fallback
    switch (viewMode) {
        case 'columns':
            workspace = 'millerColumns';
            break;
        case 'workflow':
            // Portmanteau view: merges left navigation + main workflow task table.
            // Keep inspector behavior unchanged.
            workspace = 'projectWorkflow';
            sidebar = null;
            break;
        case 'calendar':
            workspace = 'calendar';
            break;
        case 'grid':
        default:
            workspace = 'grid';
            break;
    }

    // 3. Inspector Logic
    // Don't show inspector for Miller Columns or Calendar - they use their own navigation
    let inspector: InspectorMode = null;
    const hideInspector = viewMode === 'columns' || viewMode === 'calendar';

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
        drawer: activeDrawer
    };
}
