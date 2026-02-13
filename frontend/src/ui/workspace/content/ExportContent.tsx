/**
 * ExportContent
 *
 * Workspace content for the Export surface.
 * Three-panel layout mounting the Collection System:
 *   Left   — CollectionPanel   (collection list + CRUD)
 *   Center — Tabbed: Items (CollectionPreview) | Preview (ExportDocumentPreview)
 *   Right  — GenerationPanel   (output format selection + generate)
 */

import { List, FileText } from 'lucide-react';
import { useState } from 'react';

import { CollectionPanel } from '../../../workflows/export/panels/CollectionPanel';
import { CollectionPreview } from '../../../workflows/export/components/CollectionPreview';
import { ExportDocumentPreview } from '../../../workflows/export/components/ExportDocumentPreview';
import { GenerationPanel } from '../../../workflows/export/panels/GenerationPanel';

type CenterTab = 'items' | 'preview';

export function ExportContent() {
    const [centerTab, setCenterTab] = useState<CenterTab>('items');

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

            {/* Center: Tabbed — Items | Preview */}
            <div
                className="flex-1 min-w-0 overflow-hidden flex flex-col"
                style={{ background: 'var(--ws-bg, #F5F2ED)' }}
            >
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-3 pt-2 pb-0">
                    <TabButton
                        active={centerTab === 'items'}
                        onClick={() => setCenterTab('items')}
                        icon={<List size={13} />}
                        label="Items"
                    />
                    <TabButton
                        active={centerTab === 'preview'}
                        onClick={() => setCenterTab('preview')}
                        icon={<FileText size={13} />}
                        label="Preview"
                    />
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {centerTab === 'items' ? (
                        <CollectionPreview />
                    ) : (
                        <ExportDocumentPreview />
                    )}
                </div>
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

// ============================================================================
// Tab Button
// ============================================================================

function TabButton({ active, onClick, icon, label }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors"
            style={active
                ? {
                    color: 'var(--ws-accent, #3F5C6E)',
                    background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 8%, transparent)',
                    borderBottom: '2px solid var(--ws-accent, #3F5C6E)',
                }
                : {
                    color: 'var(--ws-text-disabled, #8C8C88)',
                    borderBottom: '2px solid transparent',
                }
            }
        >
            {icon}
            {label}
        </button>
    );
}
