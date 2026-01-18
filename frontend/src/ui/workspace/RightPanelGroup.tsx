/**
 * RightPanelGroup
 *
 * Right sidebar panel group managed by Dockview.
 * Contains the SelectionInspector which is context-aware.
 */

import { useCallback, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';

import { useWorkspaceStore } from '../../stores/workspaceStore';
import { PANEL_DEFINITIONS } from '../../workspace/panelRegistry';

// Import the SelectionInspector component
import { SelectionInspector } from '../composites';

// Resize handle width
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;

export function RightPanelGroup() {
    const widthRef = useRef(DEFAULT_WIDTH);
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        rightPanelVisible,
        rightPanelIds,
        rightActivePanel,
        closePanel,
        togglePanelGroup,
    } = useWorkspaceStore();

    // Handle resize
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = widthRef.current;

        const onMouseMove = (e: MouseEvent) => {
            const delta = startX - e.clientX;
            const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
            widthRef.current = newWidth;
            if (containerRef.current) {
                containerRef.current.style.width = `${newWidth}px`;
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    // Don't render if not visible
    if (!rightPanelVisible || rightPanelIds.length === 0) {
        return null;
    }

    // For now, just render SelectionInspector directly
    // In future, could add tabs for multiple right panels
    return (
        <>
            {/* Resize handle */}
            <div
                className="w-1 bg-slate-100 hover:bg-blue-200 cursor-col-resize shrink-0"
                onMouseDown={handleResizeStart}
            />

            <aside
                ref={containerRef}
                className="bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden"
                style={{ width: DEFAULT_WIDTH }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-2">
                        {rightPanelIds.map((panelId) => {
                            const definition = PANEL_DEFINITIONS[panelId];
                            const Icon = definition?.icon;
                            const isActive = panelId === rightActivePanel;

                            return (
                                <div
                                    key={panelId}
                                    className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded ${isActive
                                        ? 'bg-white border border-slate-200 text-slate-800'
                                        : 'text-slate-500 hover:bg-slate-100'
                                        }`}
                                >
                                    {Icon && <Icon size={14} />}
                                    <span>{definition?.title ?? panelId}</span>
                                    <button
                                        onClick={() => closePanel(panelId)}
                                        className="ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => togglePanelGroup('right')}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* Content - SelectionInspector */}
                <div className="flex-1 overflow-hidden">
                    <SelectionInspector />
                </div>
            </aside>
        </>
    );
}
