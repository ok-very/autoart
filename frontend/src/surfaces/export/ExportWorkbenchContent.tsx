/**
 * ExportWorkbenchContent
 *
 * Center workspace content for Export Workbench.
 * Shows format selector and preview of selected project.
 *
 * This is the WORKSPACE slot content.
 */

import { clsx } from 'clsx';
import { Eye, FileText, Download, Loader2 } from 'lucide-react';

import { ExportPreview } from './ExportPreview';
import { EXPORT_FORMATS } from './types';
import {
    useCreateExportSession,
    useGenerateExportProjection,
    useExecuteExport,
} from '../../api/hooks/exports';
import { useExportWorkbenchStore } from '../../stores/exportWorkbenchStore';

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportWorkbenchContent() {
    const {
        selectedProjectIds,
        format,
        options,
        previewProjectId,
        setFormat,
        setOption: _setOption,
    } = useExportWorkbenchStore();

    const createSession = useCreateExportSession();
    const generateProjection = useGenerateExportProjection();
    const executeExport = useExecuteExport();

    const isExporting = createSession.isPending || generateProjection.isPending || executeExport.isPending;
    const selectedCount = selectedProjectIds.size;

    const handleExport = async () => {
        if (selectedCount === 0) return;

        try {
            // 1. Create session
            const session = await createSession.mutateAsync({
                format,
                projectIds: Array.from(selectedProjectIds),
                options,
            });

            // 2. Generate projection
            await generateProjection.mutateAsync(session.id);

            // 3. Execute export
            const result = await executeExport.mutateAsync(session.id);

            // 4. Handle result (download or open Google Doc)
            if (result.downloadUrl) {
                window.open(result.downloadUrl, '_blank');
            } else if (result.googleDocUrl) {
                window.open(result.googleDocUrl, '_blank');
            }
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Format Selector & Actions Bar */}
            <div className="border-b border-slate-200 bg-white px-4">
                <div className="flex items-center gap-4 h-12">
                    <span className="text-xs font-semibold text-slate-400 uppercase">
                        Format
                    </span>
                    <div className="flex items-center gap-2">
                        {EXPORT_FORMATS.map((fmt) => (
                            <button
                                key={fmt.id}
                                onClick={() => setFormat(fmt.id)}
                                className={clsx(
                                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                                    format === fmt.id
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent'
                                )}
                            >
                                {fmt.label}
                            </button>
                        ))}
                    </div>

                    {/* Selection indicator */}
                    <div className="ml-auto flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-500">
                                {selectedCount} project{selectedCount !== 1 ? 's' : ''} selected
                            </span>
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            disabled={selectedCount === 0 || isExporting}
                            className={clsx(
                                'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors',
                                selectedCount > 0 && !isExporting
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            )}
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    Export
                                </>
                            )}
                        </button>
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
                        <div className="text-center max-w-md">
                            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Eye size={24} className="text-slate-400" />
                            </div>
                            <p className="text-lg font-medium text-slate-500 mb-2">
                                Select a project to preview
                            </p>
                            <p className="text-sm text-slate-400">
                                Click the eye icon next to any project to see how it will
                                appear in the exported document.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExportWorkbenchContent;
