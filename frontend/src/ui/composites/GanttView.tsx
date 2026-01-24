/**
 * GanttView
 * 
 * Interactive container for the Gantt chart.
 * Manages zoom level, selection state, and print actions.
 */

import { useState, useMemo } from 'react';
import { Printer, ZoomIn, ZoomOut, Maximize, Calendar } from 'lucide-react';
import { GanttCanvas } from '../components/GanttCanvas';
import { GanttProjectionOutput, GanttSelection, generateGanttHtml } from '@autoart/shared';
import { Button, IconButton, Stack, Inline, Card, Text } from '@autoart/ui';

interface GanttViewProps {
    projection: GanttProjectionOutput;
    projectId: string;
}

export function GanttView({ projection, projectId }: GanttViewProps) {
    const [scale, setScale] = useState(1.0);
    const [selection, setSelection] = useState<GanttSelection>({});

    const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 3.0));
    const handleZoomOut = () => setScale(s => Math.max(s / 1.2, 0.5));
    const handleFit = () => setScale(1.0);

    const handlePrint = () => {
        // Generate the static HTML using the shared formatter
        const html = generateGanttHtml(projection, {
            title: `Gantt Chart - ${projectId}`
        });

        // Open in new window
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            // Trigger print dialog after load
            win.onload = () => {
                win.focus();
                win.print();
            };
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Toolbar */}
            <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0">
                <Inline gap="sm">
                    <Calendar size={16} className="text-slate-400" />
                    <Text size="sm" weight="medium">Timeline</Text>
                    <div className="h-4 w-px bg-slate-200 mx-2" />
                    <Stack gap="xs" className="flex-row">
                        <IconButton
                            icon={<ZoomOut size={16} />}
                            label="Zoom Out"
                            onClick={handleZoomOut}
                            variant="ghost"
                            size="sm"
                        />
                        <Text size="xs" color="muted" className="w-12 text-center">
                            {Math.round(scale * 100)}%
                        </Text>
                        <IconButton
                            icon={<ZoomIn size={16} />}
                            label="Zoom In"
                            onClick={handleZoomIn}
                            variant="ghost"
                            size="sm"
                        />
                        <IconButton
                            icon={<Maximize size={16} />}
                            label="Fit"
                            onClick={handleFit}
                            variant="ghost"
                            size="sm"
                        />
                    </Stack>
                </Inline>

                <Button
                    variant="secondary"
                    size="sm"
                    leftSection={<Printer size={16} />}
                    onClick={handlePrint}
                >
                    Print / PDF
                </Button>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-hidden relative">
                <GanttCanvas
                    projection={projection}
                    selection={selection}
                    onSelect={setSelection}
                    scale={scale}
                    className="h-full w-full"
                />

                {/* Selection Info Overlay */}
                {(selection.selectedItemIds?.length ?? 0) > 0 && (
                    <div className="absolute bottom-4 right-4 z-50">
                        <Card padding="sm" className="shadow-lg animate-in slide-in-from-bottom-2">
                            <Text size="xs" weight="medium">
                                {selection.selectedItemIds!.length} item(s) selected
                            </Text>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
