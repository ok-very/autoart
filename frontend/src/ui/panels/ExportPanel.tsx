/**
 * ExportPanel
 *
 * Docker-compatible version of ExportPage.
 * Layout: ExportSidebar | ExportWorkbenchView | ExportInspector
 */

import { useCallback, useState } from 'react';

import { DEFAULT_EXPORT_OPTIONS, type ExportFormat, type ExportOptions, type BfaProjectExportModel } from '@autoart/shared';
import { useUIStore } from '../../stores/uiStore';
import { ExportInspector } from '../../surfaces/export/ExportInspector';
import { ExportSidebar } from '../../surfaces/export/ExportSidebar';
import { ExportWorkbenchView } from '../../surfaces/export/ExportWorkbenchView';
import { ResizeHandle } from '../common/ResizeHandle';


export function ExportPanel() {
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
            // We reuse inspectorWidth from uiStore even though it is shared with global inspector.
            // This might be desired behavior (consistent sidebar), or we might want local state.
            // For now, keeping as is.
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
        <div className="flex flex-col h-full bg-white overflow-hidden">
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
                </div>

                {/* Right Inspector: Export options & actions */}
                {/* Kept internal because ExportInspector is specific to export */}
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
