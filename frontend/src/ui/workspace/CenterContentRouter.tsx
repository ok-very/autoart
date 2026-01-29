/**
 * CenterContentRouter
 *
 * Routes center-workspace content based on centerContentType.
 * This is the permanent center anchor that can display different content types.
 *
 * GUARDRAIL: This component's identity never changes.
 * Only the internal renderer switches based on uiStore.centerContentType.
 */

import { useUIStore } from '../../stores/uiStore';
import { ProjectContentAdapter } from './ProjectContentAdapter';
import {
    ArtCollectorContent,
    IntakeContent,
    ExportContent,
    MailContent,
    CalendarContent,
    FinanceContent,
} from './content';

export function CenterContentRouter() {
    const centerContentType = useUIStore((s) => s.centerContentType);

    switch (centerContentType) {
        case 'projects':
            return <ProjectContentAdapter />;
        case 'artcollector':
            return <ArtCollectorContent />;
        case 'intake':
            return <IntakeContent />;
        case 'export':
            return <ExportContent />;
        case 'mail':
            return <MailContent />;
        case 'calendar':
            return <CalendarContent />;
        case 'finance':
            return <FinanceContent />;
        default:
            // Fallback to projects (default behavior)
            return <ProjectContentAdapter />;
    }
}

// Re-export for backward compatibility during migration
export { CenterContentRouter as CentralAreaAdapter };
