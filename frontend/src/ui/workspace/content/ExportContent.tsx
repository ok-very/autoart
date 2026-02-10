/**
 * ExportContent
 *
 * Thin wrapper for embedding Export workbench as center content.
 * Composes sidebar (project selection) + center (session-based export flow).
 */

import { ExportWorkbenchContent } from '../../../workflows/export/views/ExportWorkbenchContent';
import { ExportWorkbenchSidebar } from '../../../workflows/export/panels/ExportWorkbenchSidebar';

export function ExportContent() {
    return (
        <div className="flex h-full overflow-hidden">
            <div
                className="w-72 flex-shrink-0 border-r overflow-y-auto"
                style={{
                    borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                    background: 'var(--ws-bg, #F5F2ED)',
                }}
            >
                <ExportWorkbenchSidebar />
            </div>
            <ExportWorkbenchContent />
        </div>
    );
}
