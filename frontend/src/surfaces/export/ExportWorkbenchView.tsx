/**
 * ExportWorkbenchView
 *
 * Center workspace content for Export Workbench.
 * Shows format selector and preview of selected project.
 *
 * This is the WORKSPACE slot content - receives state from ExportPage.
 */

import { Eye, FileText } from 'lucide-react';

import { ExportPreview } from './ExportPreview';
import { EXPORT_FORMATS, type ExportFormat, type ExportOptions, type BfaProjectExportModel } from './types';
import { Text, Stack } from '../../ui/atoms';

// ============================================================================
// TYPES
// ============================================================================

interface ExportWorkbenchViewProps {
    selectedProjectIds: Set<string>;
    format: ExportFormat;
    onFormatChange: (format: ExportFormat) => void;
    options: ExportOptions;
    previewProjectId: string | null;
    projectionCache: Map<string, BfaProjectExportModel>;
    onProjectionLoaded: (projectId: string, model: BfaProjectExportModel) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportWorkbenchView({
    selectedProjectIds,
    format,
    onFormatChange,
    options,
    previewProjectId,
    projectionCache: _projectionCache,
    onProjectionLoaded: _onProjectionLoaded,
}: ExportWorkbenchViewProps) {
    const selectedCount = selectedProjectIds.size;

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Format Selector Bar */}
            <div className="border-b border-slate-200 bg-white px-4">
                <div className="flex items-center gap-4 h-12">
                    <Text size="xs" weight="semibold" color="muted" className="uppercase">
                        Format
                    </Text>
                    <div className="flex items-center gap-2">
                        {EXPORT_FORMATS.map((fmt) => (
                            <button
                                key={fmt.id}
                                onClick={() => onFormatChange(fmt.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    format === fmt.id
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                                }`}
                            >
                                {fmt.label}
                            </button>
                        ))}
                    </div>

                    {/* Selection indicator */}
                    <div className="ml-auto flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <Text size="sm" color="muted">
                            {selectedCount} project{selectedCount !== 1 ? 's' : ''} selected
                        </Text>
                    </div>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-auto p-4">
                {previewProjectId ? (
                    <ExportPreview
                        projectId={previewProjectId}
                        format={format}
                        options={options}
                        sessionId={null}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <Stack gap="md" className="text-center max-w-md">
                            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
                                <Eye size={24} className="text-slate-400" />
                            </div>
                            <Text size="lg" weight="medium" color="dimmed">
                                Select a project to preview
                            </Text>
                            <Text size="sm" color="muted">
                                Click the eye icon next to any project to see how it will
                                appear in the exported document.
                            </Text>
                        </Stack>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExportWorkbenchView;
