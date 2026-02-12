/**
 * ExportContent
 *
 * Workspace content for the Export surface.
 * Three-panel layout mounting the Collection System:
 *   Left   — CollectionPanel   (collection list + CRUD)
 *   Center — CollectionPreview (items display + collecting controls)
 *   Right  — GenerationPanel   (output format selection + generate)
 */

import { CollectionPanel } from '../../../workflows/export/panels/CollectionPanel';
import { CollectionPreview } from '../../../workflows/export/components/CollectionPreview';
import { GenerationPanel } from '../../../workflows/export/panels/GenerationPanel';

export function ExportContent() {
    return (
        <div className="flex h-full overflow-hidden">
            {/* Left: Collection list */}
            <div
                className="w-56 flex-shrink-0 border-r overflow-y-auto"
                style={{
                    borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                    background: 'var(--ws-bg, #F5F2ED)',
                }}
            >
                <CollectionPanel />
            </div>

            {/* Center: Collection items */}
            <div
                className="flex-1 min-w-0 overflow-hidden"
                style={{ background: 'var(--ws-bg, #F5F2ED)' }}
            >
                <CollectionPreview />
            </div>

            {/* Right: Output config + generation */}
            <div
                className="w-72 flex-shrink-0 border-l overflow-y-auto"
                style={{
                    borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                    background: 'var(--ws-bg, #F5F2ED)',
                }}
            >
                <GenerationPanel />
            </div>
        </div>
    );
}
