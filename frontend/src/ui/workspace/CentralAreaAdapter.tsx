/**
 * CentralAreaAdapter
 *
 * Wraps existing project views with a header containing view toggle.
 * The view toggle (SegmentedControl) appears at top-right.
 *
 * GUARDRAIL: This component's identity never changes.
 * Only the internal renderer switches based on uiStore.workspace mode.
 */

import { SegmentedControl } from '@autoart/ui';
import { useUIStore, useUIPanels, PROJECT_VIEW_MODE_LABELS } from '../../stores/uiStore';
import type { ProjectViewMode } from '@autoart/shared';

import { CalendarView } from '../layout/CalendarView';
import { DataGridView } from '../layout/DataGridView';
import { MillerColumnsView } from '../layout/MillerColumnsView';
import { ProjectWorkflowView } from '../layout/ProjectWorkflowView';
import { ProjectLogSurface } from '../projectLog';

// View mode options for the toggle
const VIEW_MODE_DATA = Object.entries(PROJECT_VIEW_MODE_LABELS).map(([value, label]) => ({
    value,
    label,
}));

export function CentralAreaAdapter() {
    const panels = useUIPanels();
    const { projectViewMode, setProjectViewMode } = useUIStore();

    // Render the active subview based on workspace mode
    const renderContent = () => {
        switch (panels.workspace) {
            case 'millerColumns':
                return <MillerColumnsView />;
            case 'projectWorkflow':
                return <ProjectWorkflowView />;
            case 'projectLog':
                return <ProjectLogSurface />;
            case 'calendar':
                return <CalendarView />;
            case 'grid':
            case 'details':
                return <DataGridView />;
            default:
                // Fallback to Project Workflow (main view)
                return <ProjectWorkflowView />;
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* View Toggle Header - Top Right */}
            <div className="flex items-center justify-end px-4 py-2 border-b border-slate-200 bg-white">
                <SegmentedControl
                    size="xs"
                    value={projectViewMode}
                    onChange={(v) => setProjectViewMode(v as ProjectViewMode)}
                    data={VIEW_MODE_DATA}
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>
        </div>
    );
}
