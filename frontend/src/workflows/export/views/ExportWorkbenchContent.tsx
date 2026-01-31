/**
 * ExportWorkbenchContent
 *
 * Center workspace content for Export Workbench.
 * Step-based flow: configure → output.
 *
 * Design system: Oxide Blue accent, Source Serif 4 content,
 * IBM Plex Mono for metadata. No emerald.
 */

import { clsx } from 'clsx';
import { Eye, FileText, Download, Loader2 } from 'lucide-react';

import { ExportOutputPanel } from '../components/ExportOutputPanel';
import { ExportPreview } from '../components/ExportPreview';
import { ExportStepIndicator } from '../components/ExportStepIndicator';
import { EXPORT_FORMATS } from '../types';
import {
    useCreateExportSession,
    useGenerateExportProjection,
    useExecuteExport,
} from '../../../api/hooks/exports';
import { useExportWorkbenchStore } from '../../../stores/exportWorkbenchStore';

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportWorkbenchContent() {
    const {
        selectedProjectIds,
        format,
        options,
        previewProjectId,
        step,
        activeSessionId,
        setFormat,
        setStep,
        setActiveSession,
    } = useExportWorkbenchStore();

    const createSession = useCreateExportSession();
    const generateProjection = useGenerateExportProjection();
    const executeExport = useExecuteExport();

    const isExporting = createSession.isPending || generateProjection.isPending || executeExport.isPending;
    const selectedCount = selectedProjectIds.size;

    const handleExport = async () => {
        if (selectedCount === 0) return;

        try {
            const session = await createSession.mutateAsync({
                format,
                projectIds: Array.from(selectedProjectIds),
                options,
            });

            await generateProjection.mutateAsync(session.id);

            const result = await executeExport.mutateAsync(session.id);

            // Transition to output step
            setActiveSession(session.id);
            setStep('output');

            // Cloud formats open directly (no downloadable output)
            if (result.externalUrl) {
                window.open(result.externalUrl, '_blank');
            }
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    const handleBack = () => {
        setStep('configure');
        setActiveSession(null);
    };

    // ── Output step ──────────────────────────────────────────────────
    if (step === 'output' && activeSessionId) {
        return <ExportOutputPanel sessionId={activeSessionId} onBack={handleBack} />;
    }

    // ── Configure step ───────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--ws-bg, #F5F2ED)' }}>
            {/* Format Selector & Actions Bar */}
            <div
                className="border-b px-4"
                style={{ borderColor: 'var(--ws-text-disabled, #D6D2CB)', background: 'var(--ws-bg, #F5F2ED)' }}
            >
                <div className="flex items-center gap-4 h-12">
                    <ExportStepIndicator currentStep="configure" />

                    <div className="flex items-center gap-1.5 ml-4">
                        {EXPORT_FORMATS.map((fmt) => (
                            <button
                                key={fmt.id}
                                onClick={() => setFormat(fmt.id)}
                                className={clsx(
                                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-100 border',
                                )}
                                style={
                                    format === fmt.id
                                        ? {
                                              background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 12%, transparent)',
                                              color: 'var(--ws-accent, #3F5C6E)',
                                              borderColor: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 30%, transparent)',
                                          }
                                        : {
                                              background: 'transparent',
                                              color: 'var(--ws-text-secondary, #5A5A57)',
                                              borderColor: 'transparent',
                                          }
                                }
                            >
                                {fmt.label}
                            </button>
                        ))}
                    </div>

                    {/* Selection indicator + Export button */}
                    <div className="ml-auto flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FileText size={14} style={{ color: 'var(--ws-text-disabled, #8C8C88)' }} />
                            <span
                                className="text-sm"
                                style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                            >
                                {selectedCount} project{selectedCount !== 1 ? 's' : ''} selected
                            </span>
                        </div>

                        <button
                            onClick={handleExport}
                            disabled={selectedCount === 0 || isExporting}
                            className={clsx(
                                'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-opacity duration-100',
                                (selectedCount === 0 || isExporting) && 'opacity-40 cursor-not-allowed',
                            )}
                            style={{
                                background: selectedCount > 0 && !isExporting
                                    ? 'var(--ws-accent, #3F5C6E)'
                                    : 'var(--ws-text-disabled, #8C8C88)',
                                color: 'var(--ws-accent-fg, #FFFFFF)',
                            }}
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
                            <div
                                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
                                style={{ background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 8%, transparent)' }}
                            >
                                <Eye size={24} style={{ color: 'var(--ws-text-disabled, #8C8C88)' }} />
                            </div>
                            <p
                                className="text-base font-medium mb-2"
                                style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                            >
                                Select a project to preview
                            </p>
                            <p
                                className="text-sm"
                                style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                            >
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
