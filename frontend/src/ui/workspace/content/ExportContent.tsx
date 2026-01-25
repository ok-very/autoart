/**
 * ExportContent
 *
 * Thin wrapper for embedding Export workbench as center content.
 */

import { ExportWorkbench } from '../../../workflows/export/views/ExportWorkbench';

export function ExportContent() {
    // When embedded as center content, closing just resets to projects
    // (handled by workspace preset switching, not panel close)
    return <ExportWorkbench />;
}
