/**
 * GanttCanvas
 * 
 * Renders a Gantt chart projection using SVG and DOM elements.
 * Designed to visually match the backend PDF export output.
 * 
 * Props:
 * - projection: The calculated layout (BfaGanttProjectionOutput)
 * - selection: Current selection state
 * - onSelect: Handler for selection events
 */

import React, { useRef } from 'react';
import { clsx } from 'clsx';
import { GanttProjectionOutput, GanttSelection } from '@autoart/shared';

export interface GanttCanvasProps {
    projection: GanttProjectionOutput;
    selection?: GanttSelection;
    onSelect?: (selection: GanttSelection) => void;
    className?: string;
    /** Scale factor for zooming (1.0 = 100%) */
    scale?: number;
}

export function GanttCanvas({
    projection,
    selection,
    onSelect,
    className,
    scale = 1.0
}: GanttCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { totalWidth, totalHeight, lanes, ticks } = projection;

    // Handle background click to clear selection
    const handleBgClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && onSelect) {
            onSelect({});
        }
    };

    return (
        <div
            ref={containerRef}
            className={clsx("relative overflow-auto bg-ws-panel-bg select-none", className)}
            onClick={handleBgClick}
        >
            <div
                className="relative origin-top-left transition-transform duration-100 ease-out"
                style={{
                    width: totalWidth,
                    height: totalHeight + 40, // + header height
                    transform: `scale(${scale})`
                }}
            >
                {/* Header / Time Axis */}
                <div className="absolute top-0 left-0 right-0 h-10 border-b border-ws-panel-border bg-ws-bg z-10 sticky">
                    {ticks.map((tick, i) => (
                        <div
                            key={`tick-${i}`}
                            className={clsx(
                                "absolute top-0 bottom-0 border-l px-1 py-1 text-[10px] text-ws-text-secondary",
                                tick.type === 'major' ? "border-slate-300 font-medium" : "border-ws-panel-border"
                            )}
                            style={{ left: tick.x }}
                        >
                            {tick.label}
                        </div>
                    ))}
                </div>

                {/* Grid Lines (Background) */}
                <div className="absolute top-10 bottom-0 left-0 right-0 pointer-events-none">
                    {ticks.map((tick, i) => (
                        <div
                            key={`grid-${i}`}
                            className={clsx(
                                "absolute top-0 bottom-0 border-l",
                                tick.type === 'major' ? "border-ws-panel-border" : "border-slate-50"
                            )}
                            style={{ left: tick.x }}
                        />
                    ))}
                </div>

                {/* Lanes & Items */}
                <div className="absolute top-10 left-0 right-0">
                    {lanes.map((lane) => (
                        <div
                            key={lane.id}
                            className={clsx(
                                "absolute w-full border-b border-ws-panel-border hover:bg-ws-bg/50 transition-colors group",
                                selection?.selectedLaneIds?.includes(lane.id) && "bg-blue-50/30"
                            )}
                            style={{ top: lane.y, height: lane.height }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect?.({ selectedLaneIds: [lane.id] });
                            }}
                        >
                            {/* Lane Label */}
                            <div
                                className="absolute top-0 bottom-0 flex items-center text-xs text-ws-text-secondary whitespace-nowrap overflow-hidden text-ellipsis z-20 pointer-events-none"
                                style={{
                                    left: 0,
                                    paddingLeft: (lane.depth * 20) + 8,
                                    width: 250 // sticky-ish width
                                }}
                            >
                                <span className="bg-ws-panel-bg/80 px-1 rounded group-hover:bg-transparent">
                                    {lane.label}
                                </span>
                            </div>

                            {/* Items */}
                            {lane.items.map((item) => {
                                const isSelected = selection?.selectedItemIds?.includes(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        className={clsx(
                                            "absolute rounded text-[10px] text-white px-1 flex items-center overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-110 shadow-sm transition-all",
                                            isSelected ? "ring-2 ring-blue-500 ring-offset-1 z-30" : "z-20"
                                        )}
                                        style={{
                                            left: item.x,
                                            top: item.y,
                                            width: item.width,
                                            height: item.height,
                                            backgroundColor: item.color || '#3b82f6'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect?.({ selectedItemIds: [item.id] });
                                        }}
                                        title={item.label}
                                    >
                                        {item.label}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
