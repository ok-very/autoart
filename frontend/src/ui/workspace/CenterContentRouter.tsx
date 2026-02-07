/**
 * CenterContentRouter
 *
 * Routes center-workspace content based on centerContentType.
 * This is the permanent center anchor that can display different content types.
 *
 * GUARDRAIL: This component's identity never changes.
 * Only the internal renderer switches based on uiStore.centerContentType.
 *
 * When a workspace declares ownedContentTypes, the router validates and
 * redirects to the workspace's default content type on mismatch.
 */

import { useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useWorkspaceContextOptional } from '../../workspace/WorkspaceContext';
import { ProjectContentAdapter } from './ProjectContentAdapter';
import {
    ArtCollectorContent,
    IntakeContent,
    ExportContent,
    MailContent,
    CalendarContent,
    FinanceContent,
    PollsContent,
} from './content';

export function CenterContentRouter() {
    const centerContentType = useUIStore((s) => s.centerContentType);
    const setCenterContentType = useUIStore((s) => s.setCenterContentType);
    const wsCtx = useWorkspaceContextOptional();

    // Validate content type against workspace's owned types
    useEffect(() => {
        if (!wsCtx?.ownedContentTypes) return;
        if (!wsCtx.ownedContentTypes.includes(centerContentType)) {
            // Redirect to workspace's default content type (first in list)
            setCenterContentType(wsCtx.ownedContentTypes[0]);
        }
    }, [centerContentType, wsCtx?.ownedContentTypes, setCenterContentType]);

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
        case 'polls':
            return <PollsContent />;
        default:
            // Fallback to projects (default behavior)
            return <ProjectContentAdapter />;
    }
}

// Re-export for backward compatibility during migration
export { CenterContentRouter as CentralAreaAdapter };
