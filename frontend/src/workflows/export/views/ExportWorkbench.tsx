/**
 * Export Workbench Surface
 *
 * Collection-based interface for exporting autoart data to document formats.
 * Users create collections by clicking items across panels, then export with templates.
 * 
 * @deprecated The old project-selection based ExportWorkbench has been replaced
 * with this collection-based workflow. See ExportWorkbenchLegacy for old implementation.
 */

import { Download, X } from 'lucide-react';

import { CollectionPanel } from '../panels/CollectionPanel';
import { CollectionPreview } from '../components/CollectionPreview';
import { GenerationPanel } from '../panels/GenerationPanel';
import { CollectionModeProvider } from '../context/CollectionModeProvider';
import { Card, Inline, Text, Button } from '@autoart/ui';
import { useCollectionStore } from '../../../stores';
import { generateArtistPage, type ArtistData } from '../generators/GeneratorService';

// ============================================================================
// TYPES
// ============================================================================

export interface ExportWorkbenchProps {
    onExportComplete?: () => void;
    onClose?: () => void;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Runtime validation for ArtistData to prevent casting invalid payloads
 */
function isArtistData(value: unknown): value is ArtistData {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.name === 'string' &&
        typeof v.bio === 'string' &&
        Array.isArray(v.works)
    );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportWorkbench({ onExportComplete, onClose }: ExportWorkbenchProps) {
    const activeCollection = useCollectionStore(s =>
        s.activeCollectionId ? s.collections.get(s.activeCollectionId) ?? null : null
    );
    const { isCollecting } = useCollectionStore();

    const handleExport = async () => {
        if (!activeCollection || activeCollection.selections.length === 0) return;

        console.log('Exporting collection:', activeCollection);

        // Find artist selections and validate
        const artistSelections = activeCollection.selections.filter(
            sel => sel.type === 'artist'
        );

        if (artistSelections.length > 1) {
            console.warn('Multiple artist selections found; using first valid one');
        }

        // Find first valid artist data
        const validArtistSelection = artistSelections.find(sel => isArtistData(sel.value));
        const artistData = validArtistSelection?.value as ArtistData | undefined;

        let content: string;
        let filename: string;
        let mimeType: string;

        if (artistData) {
            // Use GeneratorService for validated artist data
            content = generateArtistPage(artistData, { format: 'html', includeImages: true });
            filename = `${artistData.name.toLowerCase().replace(/\s+/g, '-')}-export.html`;
            mimeType = 'text/html';
        } else {
            // Fallback to simple text export
            const lines = activeCollection.selections.map(sel =>
                `${sel.type.toUpperCase()}: ${sel.displayLabel}${sel.value ? ` = ${JSON.stringify(sel.value)}` : ''}`
            );
            content = lines.join('\n');
            filename = `${activeCollection.name.toLowerCase().replace(/\s+/g, '-')}-export.txt`;
            mimeType = 'text/plain';
        }

        // Download file
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onExportComplete?.();
    };

    const canExport = activeCollection && activeCollection.selections.length > 0 && !isCollecting;

    return (
        <CollectionModeProvider>
            <div className="flex flex-col h-full bg-ws-bg">
                {/* Header */}
                <Card className="border-b border-ws-panel-border rounded-none shadow-sm z-10 relative">
                    <Inline justify="between" className="h-10 px-3">
                        <Inline gap="sm">
                            <Download size={20} className="text-emerald-600" />
                            <Text size="lg" weight="bold">Export Workbench</Text>
                            {isCollecting && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full animate-pulse">
                                    Collecting...
                                </span>
                            )}
                        </Inline>
                        <Inline gap="sm">
                            {onClose && (
                                <Button variant="ghost" size="sm" onClick={onClose}>
                                    <X size={16} />
                                </Button>
                            )}
                        </Inline>
                    </Inline>
                </Card>

                {/* Main Content - Collection Panel */}
                <div className="flex-1 overflow-hidden flex">
                    <div className="w-80 border-r border-ws-panel-border shadow-[inset_0_-8px_12px_-8px_rgba(0,0,0,0.08)]">
                        <CollectionPanel />
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 overflow-hidden bg-ws-panel-bg shadow-[inset_0_-8px_12px_-8px_rgba(0,0,0,0.08)]">
                        <CollectionPreview />
                    </div>

                    {/* Right Sidebar - Output */}
                    <div className="w-80 border-l border-ws-panel-border bg-ws-bg shadow-[inset_0_-8px_12px_-8px_rgba(0,0,0,0.08)]">
                        <GenerationPanel />
                    </div>
                </div>

                {/* Footer: Export Controls */}
                <Card className="border-t border-slate-300 rounded-none shadow-none">
                    <Inline justify="between" className="px-4 py-3">
                        <Text size="sm" color="dimmed">
                            {activeCollection
                                ? `${activeCollection.selections.length} item${activeCollection.selections.length !== 1 ? 's' : ''} in "${activeCollection.name}"`
                                : 'No collection selected'
                            }
                        </Text>
                        <Inline gap="sm">
                            {onClose && (
                                <Button variant="secondary" onClick={onClose}>
                                    Cancel
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                disabled={!canExport}
                                onClick={handleExport}
                            >
                                <Download size={16} className="mr-1" />
                                Export
                            </Button>
                        </Inline>
                    </Inline>
                </Card>
            </div>
        </CollectionModeProvider>
    );
}

export default ExportWorkbench;
