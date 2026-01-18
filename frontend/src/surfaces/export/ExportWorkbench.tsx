/**
 * Export Workbench Surface
 *
 * Interface for exporting autoart data back to original document formats.
 * Supports BFA To-Do RTF format as primary target with round-trip fidelity.
 *
 * Features:
 * - Project scope selector (by category, stage, client)
 * - Format selector (RTF, plain text, markdown, CSV)
 * - Per-project preview with change highlighting
 * - Export options customization
 */

import { Download, FileText, Eye, Settings, Filter, Loader2 } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';

import { ExportPreview } from './ExportPreview';
import { ExportProjectList } from './ExportProjectList';
import {
    type ExportFormat,
    type ExportOptions,
    EXPORT_FORMATS,
    DEFAULT_EXPORT_OPTIONS,
} from './types';
import { useProjects } from '../../api/hooks';
import {
    useCreateExportSession,
    useGenerateExportProjection,
    useExecuteExport,
    type ExportFormat as ApiExportFormat,
} from '../../api/hooks/exports';
import { Card, Inline, Text, Stack, Button, Checkbox, Badge } from '@autoart/ui';

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
    // Data
    const { data: projects } = useProjects();

    // API Mutations
    const createSession = useCreateExportSession();
    const generateProjection = useGenerateExportProjection();
    const executeExport = useExecuteExport();

    // State
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
    const [format, setFormat] = useState<ExportFormat>('rtf');
    const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
    const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);
    const [showOptions, setShowOptions] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    // Computed
    const selectedCount = selectedProjectIds.size;
    const hasSelection = selectedCount > 0;
    const isExporting = createSession.isPending || generateProjection.isPending || executeExport.isPending;

    // Handlers
    const handleToggleProject = useCallback((projectId: string) => {
        setSelectedProjectIds((prev) => {
            const next = new Set(prev);
            if (next.has(projectId)) {
                next.delete(projectId);
            } else {
                next.add(projectId);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (projects) {
            setSelectedProjectIds(new Set(projects.map((p) => p.id)));
        }
    }, [projects]);

    const handleSelectNone = useCallback(() => {
        setSelectedProjectIds(new Set());
    }, []);

    const handleOptionChange = useCallback((key: keyof ExportOptions, value: boolean) => {
        setOptions((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleExport = useCallback(async () => {
        if (!hasSelection) return;
        setExportError(null);

        try {
            // 1. Create export session
            const session = await createSession.mutateAsync({
                format: format as ApiExportFormat,
                projectIds: Array.from(selectedProjectIds),
                options,
            });
            setSessionId(session.id);

            // 2. Generate projection
            await generateProjection.mutateAsync(session.id);

            // 3. Execute export
            const result = await executeExport.mutateAsync(session.id);

            if (!result.success) {
                setExportError(result.error || 'Export failed');
                return;
            }

            // 4. Handle result based on format
            if (result.content) {
                // Download as file
                const mimeTypes: Record<string, string> = {
                    rtf: 'application/rtf',
                    plaintext: 'text/plain',
                    markdown: 'text/markdown',
                    csv: 'text/csv',
                };
                const extensions: Record<string, string> = {
                    rtf: '.rtf',
                    plaintext: '.txt',
                    markdown: '.md',
                    csv: '.csv',
                };

                const blob = new Blob([result.content], { type: mimeTypes[format] || 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export-${new Date().toISOString().slice(0, 10)}${extensions[format] || '.txt'}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else if (result.downloadUrl) {
                // Open download URL
                window.open(result.downloadUrl, '_blank');
            } else if (result.externalUrl) {
                // Open external URL (e.g., Google Docs)
                window.open(result.externalUrl, '_blank');
            }

            onExportComplete?.();
        } catch (error) {
            console.error('Export failed:', error);
            setExportError(error instanceof Error ? error.message : 'Export failed');
        }
    }, [hasSelection, selectedProjectIds, format, options, createSession, generateProjection, executeExport, onExportComplete]);

    const formatInfo = useMemo(
        () => EXPORT_FORMATS.find((f) => f.id === format) || EXPORT_FORMATS[0],
        [format]
    );

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <Card className="border-b border-slate-200 rounded-none shadow-none">
                <Inline justify="between" className="h-14 px-4">
                    <Inline gap="sm">
                        <Download size={20} className="text-emerald-600" />
                        <Text size="lg" weight="bold">Export Workbench</Text>
                        {hasSelection && (
                            <Badge variant="default" className="font-mono">
                                {selectedCount} selected
                            </Badge>
                        )}
                    </Inline>
                    <Inline gap="sm">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowOptions(!showOptions)}
                        >
                            <Settings size={16} className="mr-1" />
                            Options
                        </Button>
                    </Inline>
                </Inline>
            </Card>

            {/* Main Content */}
            <div className="flex flex-row flex-1 overflow-hidden items-stretch">
                {/* Left Panel: Project Selection */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                    {/* Selection Header */}
                    <div className="p-3 border-b border-slate-100">
                        <Inline justify="between" className="mb-2">
                            <Text size="sm" weight="semibold">Projects</Text>
                            <Inline gap="xs">
                                <button
                                    className="text-xs text-blue-600 hover:underline"
                                    onClick={handleSelectAll}
                                >
                                    All
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    className="text-xs text-blue-600 hover:underline"
                                    onClick={handleSelectNone}
                                >
                                    None
                                </button>
                            </Inline>
                        </Inline>

                        {/* Filter placeholder */}
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-sm text-slate-500">
                            <Filter size={14} />
                            <span>Filter by category, stage, client...</span>
                        </div>
                    </div>

                    {/* Project List */}
                    <div className="flex-1 overflow-auto">
                        <ExportProjectList
                            projects={projects || []}
                            selectedIds={selectedProjectIds}
                            onToggle={handleToggleProject}
                            onPreview={setPreviewProjectId}
                            previewingId={previewProjectId}
                        />
                    </div>
                </div>

                {/* Center Panel: Preview */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Format Selector */}
                    <div className="p-3 border-b border-slate-200 bg-white">
                        <Text size="xs" weight="semibold" color="dimmed" className="mb-2 uppercase tracking-wide">
                            Export Format
                        </Text>
                        <div className="flex flex-row flex-wrap gap-2">
                            {EXPORT_FORMATS.map((fmt) => (
                                <button
                                    key={fmt.id}
                                    onClick={() => setFormat(fmt.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${format === fmt.id
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                                        }`}
                                >
                                    {fmt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 overflow-auto p-4">
                        {previewProjectId ? (
                            <ExportPreview
                                projectId={previewProjectId}
                                format={format}
                                options={options}
                                sessionId={sessionId}
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

                {/* Right Panel: Options (conditional) */}
                {showOptions && (
                    <div className="w-72 bg-white border-l border-slate-200 p-4 overflow-auto">
                        <Text size="sm" weight="semibold" className="mb-4">Export Options</Text>

                        <Stack gap="md">
                            <Text size="xs" weight="semibold" color="dimmed" className="uppercase tracking-wide">
                                Include Sections
                            </Text>

                            <Checkbox
                                label="Contacts block"
                                checked={options.includeContacts}
                                onChange={(checked) => handleOptionChange('includeContacts', checked)}
                            />
                            <Checkbox
                                label="Budget information"
                                checked={options.includeBudgets}
                                onChange={(checked) => handleOptionChange('includeBudgets', checked)}
                            />
                            <Checkbox
                                label="Milestones & timeline"
                                checked={options.includeMilestones}
                                onChange={(checked) => handleOptionChange('includeMilestones', checked)}
                            />
                            <Checkbox
                                label="Selection panel data"
                                checked={options.includeSelectionPanel}
                                onChange={(checked) => handleOptionChange('includeSelectionPanel', checked)}
                            />
                            <Checkbox
                                label="Status notes"
                                checked={options.includeStatusNotes}
                                onChange={(checked) => handleOptionChange('includeStatusNotes', checked)}
                            />

                            <div className="border-t border-slate-200 pt-4 mt-2">
                                <Text size="xs" weight="semibold" color="dimmed" className="uppercase tracking-wide mb-3">
                                    Next Steps
                                </Text>
                                <Checkbox
                                    label="Only open items"
                                    description="Exclude done next steps from export"
                                    checked={options.includeOnlyOpenNextSteps}
                                    onChange={(checked) => handleOptionChange('includeOnlyOpenNextSteps', checked)}
                                />
                            </div>
                        </Stack>
                    </div>
                )}
            </div>

            {/* Footer: Export Controls */}
            <Card className="border-t border-slate-200 rounded-none shadow-none">
                <Stack gap="sm" className="px-4 py-3">
                    {/* Error Display */}
                    {exportError && (
                        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                            <Text size="sm" className="text-red-700">{exportError}</Text>
                        </div>
                    )}

                    {/* Progress Indicator */}
                    {isExporting && (
                        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <Inline gap="sm">
                                <Loader2 size={14} className="text-blue-600 animate-spin" />
                                <Text size="sm" className="text-blue-700">
                                    {createSession.isPending && 'Creating export session...'}
                                    {generateProjection.isPending && 'Generating projection...'}
                                    {executeExport.isPending && 'Executing export...'}
                                </Text>
                            </Inline>
                        </div>
                    )}

                    <Inline justify="between">
                        <Inline gap="md">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                                <FileText size={16} className="text-slate-500" />
                                <Text size="sm" color="dimmed">{formatInfo.label}</Text>
                                {formatInfo.extension && (
                                    <Text size="xs" color="muted">({formatInfo.extension})</Text>
                                )}
                            </div>
                            {hasSelection && (
                                <Text size="sm" color="dimmed">
                                    {selectedCount} project{selectedCount !== 1 ? 's' : ''} will be exported
                                </Text>
                            )}
                        </Inline>

                        <Inline gap="sm">
                            <Button variant="secondary" onClick={onClose} disabled={isExporting}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                disabled={!hasSelection || isExporting}
                                onClick={handleExport}
                            >
                                {isExporting ? (
                                    <>
                                        <Loader2 size={16} className="mr-1 animate-spin" />
                                        Exporting...
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} className="mr-1" />
                                        Export
                                    </>
                                )}
                            </Button>
                        </Inline>
                    </Inline>
                </Stack>
            </Card>
        </div>
    );
}

export default ExportWorkbench;
