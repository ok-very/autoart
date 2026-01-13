/**
 * ExportInspector
 *
 * Right inspector panel for Export Workbench.
 * Shows export options and execute button.
 */

import { Download, Settings, Loader2 } from 'lucide-react';
import { useState } from 'react';

import type { ExportFormat, ExportOptions } from './types';
import { FontSelector } from './components/FontSelector';
import { getDefaultFont } from './utils/fonts';
import {
    useCreateExportSession,
    useGenerateExportProjection,
    useExecuteExport,
} from '../../api/hooks/exports';
import { Text, Stack, Inline, Checkbox, Button, Card } from '../../ui/atoms';

// ============================================================================
// TYPES
// ============================================================================

interface ExportInspectorProps {
    width: number;
    format: ExportFormat;
    options: ExportOptions;
    onOptionChange: (key: keyof ExportOptions, value: boolean) => void;
    selectedCount: number;
    onExport: () => void;
    font?: string;
    onFontChange?: (font: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportInspector({
    width,
    format,
    options,
    onOptionChange,
    selectedCount,
    onExport,
    font,
    onFontChange,
}: ExportInspectorProps) {
    const [exportError, _setExportError] = useState<string | null>(null);

    // API mutations
    const createSession = useCreateExportSession();
    const generateProjection = useGenerateExportProjection();
    const executeExport = useExecuteExport();

    const isExporting = createSession.isPending || generateProjection.isPending || executeExport.isPending;
    const hasSelection = selectedCount > 0;

    return (
        <aside
            className="bg-white border-l border-slate-200 flex flex-col shrink-0"
            style={{ width }}
        >
            {/* Header */}
            <div className="h-12 border-b border-slate-100 flex items-center px-4">
                <Inline gap="sm">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <Text size="sm" weight="semibold">Export Options</Text>
                </Inline>
            </div>

            {/* Options */}
            <div className="flex-1 overflow-auto p-4">
                <Stack gap="md">
                    {/* Include Sections */}
                    <div>
                        <Text size="xs" weight="semibold" color="muted" className="uppercase mb-3">
                            Include Sections
                        </Text>
                        <Stack gap="sm">
                            <Checkbox
                                label="Contacts block"
                                checked={options.includeContacts}
                                onChange={(checked) => onOptionChange('includeContacts', checked)}
                            />
                            <Checkbox
                                label="Budget information"
                                checked={options.includeBudgets}
                                onChange={(checked) => onOptionChange('includeBudgets', checked)}
                            />
                            <Checkbox
                                label="Milestones & timeline"
                                checked={options.includeMilestones}
                                onChange={(checked) => onOptionChange('includeMilestones', checked)}
                            />
                            <Checkbox
                                label="Selection panel data"
                                checked={options.includeSelectionPanel}
                                onChange={(checked) => onOptionChange('includeSelectionPanel', checked)}
                            />
                            <Checkbox
                                label="Status notes"
                                checked={options.includeStatusNotes}
                                onChange={(checked) => onOptionChange('includeStatusNotes', checked)}
                            />
                        </Stack>
                    </div>

                    {/* Next Steps Options */}
                    <div className="pt-4 border-t border-slate-200">
                        <Text size="xs" weight="semibold" color="muted" className="uppercase mb-3">
                            Next Steps
                        </Text>
                        <Checkbox
                            label="Only open items"
                            description="Exclude done next steps from export"
                            checked={options.includeOnlyOpenNextSteps}
                            onChange={(checked) => onOptionChange('includeOnlyOpenNextSteps', checked)}
                        />
                    </div>

                    {/* Format Info */}
                    <Card className="bg-slate-50 mt-4">
                        <div className="p-3">
                            <Text size="xs" weight="semibold" color="muted" className="uppercase mb-2">
                                Output Format
                            </Text>
                            <Text size="sm" weight="medium">{format.toUpperCase()}</Text>
                            {format === 'google-doc' && (
                                <Text size="xs" color="muted" className="mt-1">
                                    Will create a new Google Doc in your Drive
                                </Text>
                            )}
                        </div>
                    </Card>

                    {/* Font Selection */}
                    {onFontChange && (
                        <div className="pt-4 border-t border-slate-200">
                            <FontSelector
                                selectedFont={font || getDefaultFont(format)}
                                onChange={onFontChange}
                            />
                        </div>
                    )}
                </Stack>
            </div>

            {/* Export Button */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
                {/* Error Display */}
                {exportError && (
                    <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <Text size="xs" className="text-red-700">{exportError}</Text>
                    </div>
                )}

                {/* Progress Indicator */}
                {isExporting && (
                    <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <Inline gap="sm">
                            <Loader2 size={14} className="text-blue-600 animate-spin" />
                            <Text size="xs" className="text-blue-700">
                                {createSession.isPending && 'Creating session...'}
                                {generateProjection.isPending && 'Generating projection...'}
                                {executeExport.isPending && 'Executing export...'}
                            </Text>
                        </Inline>
                    </div>
                )}

                <Button
                    variant="primary"
                    className="w-full"
                    disabled={!hasSelection || isExporting}
                    onClick={onExport}
                >
                    {isExporting ? (
                        <>
                            <Loader2 size={16} className="mr-2 animate-spin" />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <Download size={16} className="mr-2" />
                            Export {selectedCount} Project{selectedCount !== 1 ? 's' : ''}
                        </>
                    )}
                </Button>

                {!hasSelection && (
                    <Text size="xs" color="muted" className="text-center mt-2">
                        Select projects to export
                    </Text>
                )}
            </div>
        </aside>
    );
}

export default ExportInspector;
