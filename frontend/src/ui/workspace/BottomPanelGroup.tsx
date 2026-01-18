/**
 * BottomPanelGroup
 *
 * Dockview-managed bottom panel area for supplementary panels.
 * Hidden when no panels are open. Includes "+" menu to add panels.
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import {
    DockviewReact,
    type DockviewReadyEvent,
    type IDockviewPanelProps,
    type DockviewApi,
} from 'dockview';
import { Plus, X, ChevronDown } from 'lucide-react';

import { useWorkspaceStore } from '../../stores/workspaceStore';
import {
    PANEL_DEFINITIONS,
    getPanelsByArea,
    type BottomPanelId,
} from '../../workspace/panelRegistry';

// Panel content renderer
function PanelContent({ params }: IDockviewPanelProps<{ panelId: BottomPanelId }>) {
    const { panelId } = params;

    switch (panelId) {
        case 'classification':
            // ClassificationPanel needs props - render placeholder for now
            return (
                <div className="h-full overflow-auto bg-white">
                    <div className="p-4 text-sm text-slate-500">
                        Classification panel (requires import session context)
                    </div>
                </div>
            );
        case 'search-results':
            return (
                <div className="h-full overflow-auto bg-white p-4">
                    <div className="text-sm text-slate-500">Search results will appear here</div>
                </div>
            );
        default:
            return (
                <div className="h-full overflow-auto bg-white p-4">
                    <div className="text-sm text-slate-400">Unknown panel: {panelId}</div>
                </div>
            );
    }
}

// Tab title component with close button
function TabTitle({ panelId, onClose }: { panelId: BottomPanelId; onClose: () => void }) {
    const definition = PANEL_DEFINITIONS[panelId];
    const Icon = definition?.icon;

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium">
            {Icon && <Icon size={14} className="text-slate-500" />}
            <span>{definition?.title ?? panelId}</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                className="ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
            >
                <X size={12} />
            </button>
        </div>
    );
}

export function BottomPanelGroup() {
    const apiRef = useRef<DockviewApi | null>(null);

    const {
        bottomPanelVisible,
        bottomPanelIds,
        bottomActivePanel,
        bottomPanelHeight,
        openPanel,
        closePanel,
        setBottomPanelHeight,
        togglePanelGroup,
    } = useWorkspaceStore();

    // Available panels to add
    const availablePanels = useMemo(() => {
        const bottomPanels = getPanelsByArea('bottom');
        return bottomPanels.filter((p) => !bottomPanelIds.includes(p.id as BottomPanelId));
    }, [bottomPanelIds]);

    // Handle Dockview ready
    const onReady = useCallback((event: DockviewReadyEvent) => {
        apiRef.current = event.api;

        // Add existing panels
        bottomPanelIds.forEach((panelId) => {
            event.api.addPanel({
                id: panelId,
                component: 'panelContent',
                params: { panelId },
                title: PANEL_DEFINITIONS[panelId]?.title ?? panelId,
            });
        });

        // Set active panel
        if (bottomActivePanel) {
            const panel = event.api.getPanel(bottomActivePanel);
            if (panel) {
                panel.api.setActive();
            }
        }
    }, [bottomPanelIds, bottomActivePanel]);

    // Sync panels when store changes
    useEffect(() => {
        const api = apiRef.current;
        if (!api) return;

        // Add new panels
        bottomPanelIds.forEach((panelId) => {
            if (!api.getPanel(panelId)) {
                api.addPanel({
                    id: panelId,
                    component: 'panelContent',
                    params: { panelId },
                    title: PANEL_DEFINITIONS[panelId]?.title ?? panelId,
                });
            }
        });

        // Remove closed panels
        api.panels.forEach((panel) => {
            if (!bottomPanelIds.includes(panel.id as BottomPanelId)) {
                panel.api.close();
            }
        });
    }, [bottomPanelIds]);

    // Handle add panel
    const handleAddPanel = useCallback((panelId: BottomPanelId) => {
        openPanel(panelId);
    }, [openPanel]);

    // Handle close panel
    const handleClosePanel = useCallback((panelId: BottomPanelId) => {
        closePanel(panelId);
    }, [closePanel]);

    // Don't render if not visible or no panels
    if (!bottomPanelVisible || bottomPanelIds.length === 0) {
        // Just show the add button bar
        return (
            <div className="border-t border-slate-200 bg-slate-50 px-2 py-1 flex items-center gap-2">
                <div className="relative group">
                    <button
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                    >
                        <Plus size={14} />
                        <span>Add Panel</span>
                    </button>
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px] z-50">
                        {getPanelsByArea('bottom').map((panel) => {
                            const Icon = panel.icon;
                            return (
                                <button
                                    key={panel.id}
                                    onClick={() => handleAddPanel(panel.id as BottomPanelId)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                    <Icon size={14} className="text-slate-400" />
                                    {panel.title}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Components registry for Dockview
    const components = {
        panelContent: PanelContent,
    };

    return (
        <div
            className="border-t border-slate-200 bg-white flex flex-col"
            style={{ height: bottomPanelHeight }}
        >
            {/* Resize handle */}
            <div
                className="h-1 bg-slate-100 hover:bg-blue-200 cursor-row-resize shrink-0"
                onMouseDown={(e) => {
                    const startY = e.clientY;
                    const startHeight = bottomPanelHeight;

                    const onMouseMove = (e: MouseEvent) => {
                        const delta = startY - e.clientY;
                        setBottomPanelHeight(startHeight + delta);
                    };

                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                }}
            />

            {/* Header bar with tabs placeholder and add button */}
            <div className="flex items-center justify-between px-2 py-1 bg-slate-50 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-1">
                    {bottomPanelIds.map((panelId) => (
                        <TabTitle
                            key={panelId}
                            panelId={panelId}
                            onClose={() => handleClosePanel(panelId)}
                        />
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    {availablePanels.length > 0 && (
                        <div className="relative group">
                            <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                                <Plus size={14} />
                            </button>
                            <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px] z-50">
                                {availablePanels.map((panel) => {
                                    const Icon = panel.icon;
                                    return (
                                        <button
                                            key={panel.id}
                                            onClick={() => handleAddPanel(panel.id as BottomPanelId)}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            <Icon size={14} className="text-slate-400" />
                                            {panel.title}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => togglePanelGroup('bottom')}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            {/* Panel content area */}
            <div className="flex-1 overflow-hidden">
                <DockviewReact
                    className="dockview-theme-light"
                    onReady={onReady}
                    components={components}
                />
            </div>
        </div>
    );
}
