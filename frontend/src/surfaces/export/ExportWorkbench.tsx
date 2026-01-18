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
import { CollectionModeProvider } from './CollectionModeProvider';
import { Card, Inline, Text, Button } from '@autoart/ui';
import { useCollectionStore } from '../../stores';

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

        // TODO: Implement actual export based on template preset
        // For now, just log the collection
        console.log('Exporting collection:', activeCollection);

        // Create export content based on selections
        const lines = activeCollection.selections.map(sel =>
            `${sel.type.toUpperCase()}: ${sel.displayLabel}${sel.value ? ` = ${JSON.stringify(sel.value)}` : ''}`
        );
        const content = lines.join('\n');

        // Download as text file
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeCollection.name.toLowerCase().replace(/\s+/g, '-')}-export.txt`;
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
