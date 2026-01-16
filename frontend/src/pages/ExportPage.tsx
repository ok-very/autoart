/**
 * ExportPage - Page wrapper for Export Workbench
 *
 * Layout: ExportSidebar | ExportWorkbenchView | ExportInspector + BottomDrawer
 *
 * Follows the same pattern as ProjectPage and RecordsPage.
 */

import { useCallback, useState } from 'react';

import { DEFAULT_EXPORT_OPTIONS, type ExportFormat, type ExportOptions, type BfaProjectExportModel } from '@autoart/shared';
import { useUIStore } from '../stores/uiStore';
import { ExportInspector } from '../surfaces/export/ExportInspector';
import { ExportSidebar } from '../surfaces/export/ExportSidebar';
import { ExportWorkbenchView } from '../surfaces/export/ExportWorkbenchView';
import { ResizeHandle } from '../ui/common/ResizeHandle';
import { BottomDrawer } from '../ui/drawer/BottomDrawer';
import { Header } from '../ui/layout/Header';


export function ExportPage() {
    const { inspectorWidth, setInspectorWidth } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(280);

    // Export state (lifted to page level for cross-component access)
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
    const [format, setFormat] = useState<ExportFormat>('rtf');
    const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
    const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);
    const [projectionCache, setProjectionCache] = useState<Map<string, BfaProjectExportModel>>(new Map());

    const handleSidebarResize = useCallback(
        (delta: number) => {
            setSidebarWidth((w) => Math.max(200, Math.min(400, w + delta)));
        },
        []
    );

    const handleInspectorResize = useCallback(
        (delta: number) => {
            setInspectorWidth(inspectorWidth + delta);
        },
        [inspectorWidth, setInspectorWidth]
    );

    const handleToggleProject = useCallback((projectId: string) => {
        setSelectedProjectIds((prev) => {
            const next = new Set(prev);
            if (next.has(projectId)) {
                next.delete(projectId);
            } else {
                next.add(projectId);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((projectIds: string[]) => {
        setSelectedProjectIds(new Set(projectIds));
    }, []);

    const handleSelectNone = useCallback(() => {
        setSelectedProjectIds(new Set());
    }, []);

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Project selection */}
                <ExportSidebar
                    width={sidebarWidth}
                    selectedProjectIds={selectedProjectIds}
                    onToggleProject={handleToggleProject}
                    onSelectAll={handleSelectAll}
                    onSelectNone={handleSelectNone}
                    onPreviewProject={setPreviewProjectId}
                    previewingProjectId={previewProjectId}
                />
                <ResizeHandle direction="right" onResize={handleSidebarResize} />

                {/* Center: Preview workspace */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <ExportWorkbenchView
                        selectedProjectIds={selectedProjectIds}
                        format={format}
                        onFormatChange={setFormat}
                        options={options}
                        previewProjectId={previewProjectId}
                        projectionCache={projectionCache}
                        onProjectionLoaded={(id, model) => {
                            setProjectionCache((prev) => new Map(prev).set(id, model));
                        }}
                    />
                    <BottomDrawer />
                </div>

                {/* Right Inspector: Export options & actions */}
                <ResizeHandle direction="left" onResize={handleInspectorResize} />
                <ExportInspector
                    width={inspectorWidth}
                    format={format}
                    options={options}
                    onOptionChange={(key, value) => setOptions((prev: ExportOptions) => ({ ...prev, [key]: value }))}
                    selectedCount={selectedProjectIds.size}
                    onExport={() => {
                        // Trigger export flow - will be wired to API
                        console.log('Export triggered', { format, options, projectIds: Array.from(selectedProjectIds) });
                    }}
                />
            </div>
        </div>
    );
}

export default ExportPage;
