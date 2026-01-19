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

import { CollectionPanel } from './CollectionPanel';
import { CollectionPreview } from './CollectionPreview';
import { GenerationPanel } from './GenerationPanel';
import { CollectionModeProvider } from './CollectionModeProvider';
import { Card, Inline, Text, Button } from '@autoart/ui';
import { useCollectionStore } from '../../stores';
import { generateArtistPage, type ArtistData } from './generators/GeneratorService';

// ============================================================================
// TYPES
// ============================================================================

export interface ExportWorkbenchProps {
    onExportComplete?: () => void;
    onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportWorkbench({ onExportComplete, onClose }: ExportWorkbenchProps) {
    const { activeCollection, isCollecting } = useCollectionStore();

    const handleExport = async () => {
        if (!activeCollection || activeCollection.selections.length === 0) return;

        console.log('Exporting collection:', activeCollection);

        // Check if this is artist data from Collector
        const artistSelection = activeCollection.selections.find(
            sel => sel.type === 'artist'
        );

        let content: string;
        let filename: string;
        let mimeType: string;

        if (artistSelection?.value && typeof artistSelection.value === 'object') {
            // Use GeneratorService for artist data
            const artistData = artistSelection.value as ArtistData;
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
            <div className="flex flex-col h-full bg-slate-50">
                {/* Header */}
                <Card className="border-b border-slate-200 rounded-none shadow-none">
                    <Inline justify="between" className="h-14 px-4">
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
                    <div className="w-80 border-r border-slate-200">
                        <CollectionPanel />
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 overflow-hidden bg-white">
                        <CollectionPreview />
                    </div>

                    {/* Right Sidebar - Generation */}
                    <div className="w-80 border-l border-slate-200 bg-slate-50">
                        <GenerationPanel />
                    </div>
                </div>

                {/* Footer: Export Controls */}
                <Card className="border-t border-slate-200 rounded-none shadow-none">
                    <Inline justify="between" className="px-4 py-3">
                        <Text size="sm" color="dimmed">
                            {activeCollection
                                ? `${activeCollection.selections.length} item${activeCollection.selections.length !== 1 ? 's' : ''} in "${activeCollection.name}"`
                                : 'No collection selected'
                            }
                        </Text>
                        <Inline gap="sm">
                            <Button variant="secondary" onClick={onClose}>
                                Cancel
                            </Button>
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
