/**
 * DockviewWorkspace
 *
 * Unified Dockview grid managing the entire workspace.
 * Replaces separate RightPanelGroup and BottomPanelGroup.
 *
 * Layout:
 * - Center: CentralAreaAdapter (permanent)
 * - Right: SelectionInspector (default, context-aware)
 * - Bottom: Classification, Search Results (on-demand, context-driven)
 */

import { useCallback, useEffect, useRef } from 'react';
import {
    DockviewReact,
    type DockviewReadyEvent,
    type DockviewApi,
    type IDockviewPanelProps,
} from 'dockview';

import { useWorkspaceStore, useOpenPanelIds, useLayout } from '../../stores/workspaceStore';
import { useVisiblePanels } from '../../stores/contextStore';
import {
    PANEL_DEFINITIONS,
    isPermanentPanel,
    type PanelId,
} from '../../workspace/panelRegistry';
import { CentralAreaAdapter } from './CentralAreaAdapter';
import { SelectionInspector } from '../composites/SelectionInspector';
import { ClassificationPanel } from '../../surfaces/import/ClassificationPanel';

// ============================================================================
// PANEL COMPONENTS
// ============================================================================

/** Center workspace - wraps existing views */
function CenterWorkspacePanel(_props: IDockviewPanelProps) {
    return (
        <div className="h-full overflow-hidden bg-white">
            <CentralAreaAdapter />
        </div>
    );
}

/** Selection inspector - context-aware */
function SelectionInspectorPanel(_props: IDockviewPanelProps) {
    return (
        <div className="h-full overflow-auto bg-white">
            <SelectionInspector />
        </div>
    );
}

/** Classification panel - requires import session context */
function ClassificationPanelWrapper(_props: IDockviewPanelProps) {
    // TODO: Connect to import session context
    // For now, render placeholder that explains context requirement
    return (
        <div className="h-full overflow-auto bg-white">
            <ClassificationPanel
                sessionId={null}
                plan={null}
                onResolutionsSaved={() => { }}
            />
        </div>
    );
}

/** Search results - requires search context */
function SearchResultsPanel(_props: IDockviewPanelProps) {
    return (
        <div className="h-full overflow-auto bg-white p-4">
            <div className="text-sm text-slate-500">
                Search for records, definitions, or actions...
            </div>
        </div>
    );
}

// Component registry for Dockview
const COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
    'center-workspace': CenterWorkspacePanel,
    'selection-inspector': SelectionInspectorPanel,
    'classification': ClassificationPanelWrapper,
    'search-results': SearchResultsPanel,
};

// ============================================================================
// DOCKVIEW WORKSPACE
// ============================================================================

export function DockviewWorkspace() {
    const apiRef = useRef<DockviewApi | null>(null);

    const openPanelIds = useOpenPanelIds();
    const savedLayout = useLayout();
    const visiblePanels = useVisiblePanels();
    const { openPanel, saveLayout } = useWorkspaceStore();

    // Build default layout programmatically
    const buildDefaultLayout = useCallback((api: DockviewApi) => {
        // Always add center workspace first
        const centerPanel = api.addPanel({
            id: 'center-workspace',
            component: 'center-workspace',
            title: PANEL_DEFINITIONS['center-workspace'].title,
        });

        // Add selection inspector to the right
        if (openPanelIds.includes('selection-inspector')) {
            api.addPanel({
                id: 'selection-inspector',
                component: 'selection-inspector',
                title: PANEL_DEFINITIONS['selection-inspector'].title,
                position: {
                    referencePanel: centerPanel,
                    direction: 'right',
                },
            });
        }

        // Add any bottom panels
        const bottomPanels = openPanelIds.filter(
            (id) => PANEL_DEFINITIONS[id]?.defaultPlacement.area === 'bottom'
        );

        if (bottomPanels.length > 0) {
            const firstBottom = bottomPanels[0];
            const firstBottomPanel = api.addPanel({
                id: firstBottom,
                component: firstBottom,
                title: PANEL_DEFINITIONS[firstBottom].title,
                position: {
                    referencePanel: centerPanel,
                    direction: 'below',
                },
            });

            // Add remaining bottom panels as tabs
            bottomPanels.slice(1).forEach((id) => {
                api.addPanel({
                    id,
                    component: id,
                    title: PANEL_DEFINITIONS[id].title,
                    position: {
                        referencePanel: firstBottomPanel,
                        direction: 'within',
                    },
                });
            });
        }
    }, [openPanelIds]);

    // Handle Dockview ready
    const onReady = useCallback((event: DockviewReadyEvent) => {
        apiRef.current = event.api;

        // Try to restore saved layout, otherwise build default
        if (savedLayout) {
            try {
                event.api.fromJSON(savedLayout as Parameters<DockviewApi['fromJSON']>[0]);
            } catch (err) {
                console.warn('Failed to restore layout, building default:', err);
                buildDefaultLayout(event.api);
            }
        } else {
            buildDefaultLayout(event.api);
        }

        // Subscribe to layout changes for persistence
        event.api.onDidLayoutChange(() => {
            const state = event.api.toJSON();
            saveLayout(state as unknown as Parameters<typeof saveLayout>[0]);
        });
    }, [savedLayout, buildDefaultLayout, saveLayout]);

    // Sync panels when openPanelIds changes
    useEffect(() => {
        const api = apiRef.current;
        if (!api) return;

        // Add panels that should be open but aren't
        openPanelIds.forEach((id) => {
            if (!api.getPanel(id)) {
                const def = PANEL_DEFINITIONS[id];
                if (!def) return;

                // Find reference panel for positioning
                const centerPanel = api.getPanel('center-workspace');
                if (!centerPanel) return;

                api.addPanel({
                    id,
                    component: id,
                    title: def.title,
                    position: {
                        referencePanel: centerPanel,
                        direction: def.defaultPlacement.area === 'right' ? 'right' : 'below',
                    },
                });
            }
        });

        // Remove panels that should be closed
        api.panels.forEach((panel) => {
            const panelId = panel.id as PanelId;
            if (!openPanelIds.includes(panelId) && !isPermanentPanel(panelId)) {
                panel.api.close();
            }
        });
    }, [openPanelIds]);

    // Auto-show/hide panels based on context visibility
    useEffect(() => {
        visiblePanels.forEach((id) => {
            if (!openPanelIds.includes(id)) {
                openPanel(id);
            }
        });
    }, [visiblePanels, openPanelIds, openPanel]);

    return (
        <div className="flex-1 overflow-hidden">
            <DockviewReact
                className="dockview-theme-light"
                onReady={onReady}
                components={COMPONENTS}
            />
        </div>
    );
}
