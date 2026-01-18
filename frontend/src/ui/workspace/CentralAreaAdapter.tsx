/**
 * CentralAreaAdapter
 *
 * Wraps existing workspace views (MillerColumns, ProjectWorkflow, etc.)
 * into a single stable component for Dockview.
 *
 * GUARDRAIL: This component's identity never changes.
 * Only the internal renderer switches based on uiStore.workspace mode.
 */

import { useUIPanels } from '../../stores/uiStore';
import { CalendarView } from '../layout/CalendarView';
import { MillerColumnsView } from '../layout/MillerColumnsView';
import { ProjectWorkflowView } from '../layout/ProjectWorkflowView';
import { Workspace } from '../layout/Workspace';
import { ProjectLogSurface } from '../projectLog';

export function CentralAreaAdapter() {
    const panels = useUIPanels();

    // Switch based on workspace mode
    // Component is stable, content switches internally
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
            return <Workspace />;
        default:
            // Fallback to Miller Columns
            return <MillerColumnsView />;
    }
}
