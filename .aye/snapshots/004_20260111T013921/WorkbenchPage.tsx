/**
 * WorkbenchPage - Unified page for Import and Export workbenches
 *
 * Layout: WorkbenchSidebar | WorkbenchContent | SelectionInspector + BottomDrawer
 *
 * Switches between Import and Export modes via tabs or route param.
 * Uses flexible drawer system for all panels.
 */

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { Header } from '../ui/layout/Header';
import { SelectionInspector } from '../ui/composites/SelectionInspector';
import { BottomDrawer } from '../ui/drawer/BottomDrawer';
import { ResizeHandle } from '../ui/common/ResizeHandle';
import { useUIStore } from '../stores/uiStore';

// Import workbench components
import { ImportWorkbenchSidebar } from '../surfaces/import/ImportWorkbenchSidebar';
import { ImportWorkbenchContent } from '../surfaces/import/ImportWorkbenchContent';

// Export workbench components
import { ExportWorkbenchSidebar } from '../surfaces/export/ExportWorkbenchSidebar';
import { ExportWorkbenchContent } from '../surfaces/export/ExportWorkbenchContent';

// ============================================================================
// TYPES
// ============================================================================

export type WorkbenchMode = 'import' | 'export';

// ============================================================================
// MODE TABS
// ============================================================================

interface ModeTabsProps {
    mode: WorkbenchMode;
    onModeChange: (mode: WorkbenchMode) => void;
}

function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
    return (
        <div className="flex items-center gap-1 px-2">
            <button
                onClick={() => onModeChange('import')}
                className={clsx(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2',
                    mode === 'import'
                        ? 'bg-white text-blue-600 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-100'
                )}
            >
                <Upload size={16} />
                Import
            </button>
            <button
                onClick={() => onModeChange('export')}
                className={clsx(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2',
                    mode === 'export'
                        ? 'bg-white text-emerald-600 border-emerald-600'
                        : 'text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-100'
                )}
            >
                <Download size={16} />
                Export
            </button>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WorkbenchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { inspectorWidth, setInspectorWidth } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(300);

    // Get mode from URL or default to import
    const mode = (searchParams.get('mode') as WorkbenchMode) || 'import';

    const handleModeChange = useCallback((newMode: WorkbenchMode) => {
        setSearchParams({ mode: newMode });
    }, [setSearchParams]);

    const handleSidebarResize = useCallback(
        (delta: number) => {
            setSidebarWidth((w) => Math.max(240, Math.min(480, w + delta)));
        },
        []
    );

    const handleInspectorResize = useCallback(
        (delta: number) => {
            setInspectorWidth(Math.max(280, Math.min(600, inspectorWidth - delta)));
        },
        [inspectorWidth, setInspectorWidth]
    );

    return (
        <div className="flex flex-col h-full">
            <Header />

            {/* Mode Tabs Bar */}
            <div className="h-11 bg-slate-100 border-b border-slate-200 flex items-end">
                <ModeTabs mode={mode} onModeChange={handleModeChange} />
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar Drawer */}
                <aside
                    className="bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden"
                    style={{ width: sidebarWidth }}
                >
                    {mode === 'import' ? (
                        <ImportWorkbenchSidebar />
                    ) : (
                        <ExportWorkbenchSidebar />
                    )}
                </aside>
                <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />

                {/* Center Workspace */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {mode === 'import' ? (
                        <ImportWorkbenchContent />
                    ) : (
                        <ExportWorkbenchContent />
                    )}
                    <BottomDrawer />
                </div>

                {/* Right Inspector */}
                <ResizeHandle direction="horizontal" onResize={handleInspectorResize} />
                <SelectionInspector />
            </div>
        </div>
    );
}

export default WorkbenchPage;
