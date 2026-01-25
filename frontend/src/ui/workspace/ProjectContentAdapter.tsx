/**
 * ProjectContentAdapter
 *
 * Renders project-specific views based on projectViewMode.
 * Extracted from CentralAreaAdapter for content type routing.
 *
 * This component displays:
 * - A header with view mode toggle (SegmentedControl)
 * - The appropriate project view (workflow, log, columns, list, cards)
 */

import { SegmentedControl } from '@autoart/ui';
import { useUIStore, useUIPanels, PROJECT_VIEW_MODE_LABELS } from '../../stores/uiStore';
import type { ProjectViewMode } from '@autoart/shared';

import { ActionListView } from '../layout/ActionListView';
import { ActionCardsView } from '../layout/ActionCardsView';
import { MillerColumnsView } from '../layout/MillerColumnsView';
import { ProjectWorkflowView } from '../layout/ProjectWorkflowView';
import { ProjectLogSurface } from '../projectLog';

// View mode options for the toggle
const VIEW_MODE_DATA = Object.entries(PROJECT_VIEW_MODE_LABELS).map(([value, label]) => ({
    value,
    label,
}));

export function ProjectContentAdapter() {
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
            case 'list':
                return <ActionListView />;
            case 'cards':
                return <ActionCardsView />;
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
