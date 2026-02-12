/**
 * Output Panel
 *
 * Right sidebar for Export Workbench.
 * Combines output format selection, section toggles, and generation actions.
 * Executes exports through the backend session pipeline.
 */

import { useState } from 'react';
import { FileText, Table, Loader2, AlertCircle, Check, ChevronDown, ChevronRight, Settings, Download, ExternalLink } from 'lucide-react';
import { GoogleLogo } from '@phosphor-icons/react';
import { useCollectionStore, type TemplatePreset } from '../../../stores';
import { useExportWorkbenchStore } from '../../../stores/exportWorkbenchStore';
import { useExportWorkflow, useDownloadExportOutput } from '../../../api/hooks/exports';
import { useResolvedProjectIds } from '../utils/resolveProjectIds';
import { Text } from '@autoart/ui';

import { SECTION_DEFINITIONS, type ExportFormat, type ExportResult } from '@autoart/shared';

// ============================================================================
// TemplatePreset → ExportFormat mapping
// ============================================================================

const PRESET_TO_FORMAT: Record<TemplatePreset, ExportFormat> = {
    bfa_rtf: 'rtf',
    csv: 'csv',
    google_docs: 'google-doc',
    custom: 'json',
};

// ============================================================================
// Format-capability matrix
// ============================================================================

/** Sections that are NOT applicable per format. Unlisted formats support all sections. */
const FORMAT_DISABLED_SECTIONS: Partial<Record<ExportFormat, Set<string>>> = {
    csv: new Set(['includeArtworkImagery', 'includeSelectionPanel', 'includeRiskRegister']),
    json: new Set([]),
    plaintext: new Set(['includeArtworkImagery']),
};

function isSectionDisabledForFormat(sectionId: string, format: ExportFormat): boolean {
    return FORMAT_DISABLED_SECTIONS[format]?.has(sectionId) ?? false;
}

// ============================================================================
// Output Module Configuration
// ============================================================================

interface OutputModuleConfig {
    id: TemplatePreset;
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    hasSettings: boolean;
}

const OUTPUT_MODULES: OutputModuleConfig[] = [
    {
        id: 'bfa_rtf',
        label: 'BFA Document',
        description: 'Rich text format for BFA To-Do',
        icon: FileText,
        hasSettings: true,
    },
    {
        id: 'csv',
        label: 'CSV Export',
        description: 'Comma-separated spreadsheet',
        icon: Table,
        hasSettings: true,
    },
    {
        id: 'google_docs',
        label: 'Google Docs',
        description: 'Create document in Google Drive',
        icon: GoogleLogo,
        hasSettings: true,
    },
];

// ============================================================================
// Component
// ============================================================================

interface ExportResultEntry {
    id: string;
    sessionId: string;
    format: ExportFormat;
    result: ExportResult;
    timestamp: string;
}

export function GenerationPanel() {
    const activeCollection = useCollectionStore(s =>
        s.activeCollectionId ? s.collections.get(s.activeCollectionId) ?? null : null
    );
    const { setTemplatePreset } = useCollectionStore();

    const { sectionConfig, toggleSection, getMergedOptions } = useExportWorkbenchStore();

    const workflow = useExportWorkflow();
    const downloadOutput = useDownloadExportOutput();
    const [results, setResults] = useState<ExportResultEntry[]>([]);
    const [expandedModule, setExpandedModule] = useState<TemplatePreset | null>(null);

    const selectedPreset = activeCollection?.templatePreset ?? 'bfa_rtf';
    const currentFormat = PRESET_TO_FORMAT[selectedPreset];

    // Resolve project IDs from collection via hierarchy store
    const resolved = useResolvedProjectIds(activeCollection?.selections ?? []);

    const handleSelectModule = (moduleId: TemplatePreset) => {
        if (!activeCollection) return;
        setTemplatePreset(activeCollection.id, moduleId);
        setExpandedModule(moduleId === expandedModule ? null : moduleId);
    };

    const handleGenerate = async () => {
        if (!activeCollection || resolved.projectIds.length === 0) return;

        const format = currentFormat;
        const options = getMergedOptions();

        try {
            const session = await workflow.startExport({
                format,
                projectIds: resolved.projectIds,
                options,
            });
            const result = await workflow.finishExport(session.id);

            setResults(prev => [{
                id: crypto.randomUUID(),
                sessionId: session.id,
                format,
                result,
                timestamp: new Date().toISOString(),
            }, ...prev]);

            if (result.externalUrl) {
                window.open(result.externalUrl, '_blank');
            }
        } catch {
            // Error surfaced via workflow.error
        }
    };

    if (!activeCollection) {
        return (
            <div className="h-full flex items-center justify-center p-4 text-ws-muted text-sm text-center">
                Select a collection to configure output
            </div>
        );
    }

    const errorMessage = workflow.error instanceof Error
        ? workflow.error.message
        : workflow.error ? String(workflow.error) : null;

    const selectionCount = activeCollection.selections.length;
    const canGenerate = resolved.projectIds.length > 0 && !workflow.isLoading;

    return (
        <div className="flex flex-col h-full bg-ws-bg relative">
            {/* Header */}
            <div
                className="px-3 py-2.5 border-b"
                style={{
                    borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                    background: 'var(--ws-bg, #F5F2ED)',
                }}
            >
                <Text weight="bold" size="sm">Output</Text>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                    {selectionCount} selection{selectionCount !== 1 ? 's' : ''}
                    {resolved.projectIds.length > 0 && (
                        <> across {resolved.projectIds.length} project{resolved.projectIds.length !== 1 ? 's' : ''}</>
                    )}
                </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                {/* Output Modules */}
                <div className="p-3 space-y-2">
                    {OUTPUT_MODULES.map((module) => {
                        const Icon = module.icon;
                        const isSelected = selectedPreset === module.id;
                        const isExpanded = expandedModule === module.id;

                        return (
                            <div key={module.id}>
                                <button
                                    onClick={() => handleSelectModule(module.id)}
                                    className="w-full p-3 rounded-lg text-left transition-all"
                                    style={isSelected ? {
                                        background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 8%, transparent)',
                                        border: '2px solid color-mix(in srgb, var(--ws-accent, #3F5C6E) 40%, transparent)',
                                    } : {
                                        background: 'var(--ws-bg, #F5F2ED)',
                                        border: '1px solid var(--ws-panel-border, #D6D2CB)',
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-2 rounded"
                                            style={isSelected ? {
                                                background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 15%, transparent)',
                                                color: 'var(--ws-accent, #3F5C6E)',
                                            } : {
                                                background: 'color-mix(in srgb, var(--ws-text-disabled, #8C8C88) 10%, transparent)',
                                                color: 'var(--ws-text-secondary, #5A5A57)',
                                            }}
                                        >
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div
                                                className="text-sm font-medium"
                                                style={{ color: isSelected ? 'var(--ws-accent, #3F5C6E)' : 'var(--ws-text-secondary, #5A5A57)' }}
                                            >
                                                {module.label}
                                            </div>
                                            <div className="text-[10px]" style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                                                {module.description}
                                            </div>
                                        </div>
                                        {module.hasSettings && (
                                            <div style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {isExpanded && module.hasSettings && (
                                    <div
                                        className="mt-1 ml-4 p-3 rounded-lg"
                                        style={{
                                            background: 'var(--ws-bg, #F5F2ED)',
                                            border: '1px solid var(--ws-panel-border, #D6D2CB)',
                                        }}
                                    >
                                        <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                                            <Settings size={12} />
                                            <span className="text-[10px] font-medium uppercase tracking-wider">Settings</span>
                                        </div>
                                        {module.id === 'bfa_rtf' && (
                                            <div className="space-y-3 text-xs">
                                                <div>
                                                    <label className="block font-medium mb-1" style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                                                        Target Document
                                                    </label>
                                                    <select
                                                        className="w-full px-2 py-1.5 rounded text-sm"
                                                        style={{
                                                            border: '1px solid var(--ws-panel-border, #D6D2CB)',
                                                            background: 'var(--ws-bg, #F5F2ED)',
                                                        }}
                                                    >
                                                        <option value="">Select document...</option>
                                                        <option value="new">+ Create new document</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                        {module.id === 'csv' && (
                                            <div className="space-y-2 text-xs">
                                                <label className="flex items-center gap-2">
                                                    <input type="checkbox" defaultChecked className="rounded" />
                                                    <span>Include headers</span>
                                                </label>
                                            </div>
                                        )}
                                        {module.id === 'google_docs' && (
                                            <div className="space-y-2 text-xs">
                                                <label className="flex items-center gap-2">
                                                    <input type="checkbox" defaultChecked className="rounded" />
                                                    <span>Create in shared folder</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Section Toggles */}
                <div
                    className="mx-3 mb-3 p-3 rounded-lg"
                    style={{
                        background: 'var(--ws-bg, #F5F2ED)',
                        border: '1px solid var(--ws-panel-border, #D6D2CB)',
                    }}
                >
                    <span
                        className="text-[10px] font-medium uppercase tracking-wider block mb-2"
                        style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                    >
                        Sections
                    </span>
                    <div className="space-y-1.5">
                        {SECTION_DEFINITIONS.map((section) => {
                            const isEnabled = sectionConfig[section.id] ?? section.defaultEnabled;
                            const isDisabled = isSectionDisabledForFormat(section.id, currentFormat);

                            return (
                                <label
                                    key={section.id}
                                    className="flex items-center gap-2 py-0.5"
                                    style={{
                                        opacity: isDisabled ? 0.4 : 1,
                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isEnabled && !isDisabled}
                                        disabled={isDisabled}
                                        onChange={() => !isDisabled && toggleSection(section.id)}
                                        className="rounded"
                                        style={{ accentColor: 'var(--ws-accent, #3F5C6E)' }}
                                    />
                                    <span
                                        className="text-xs"
                                        style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                                    >
                                        {section.label}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Generate Button */}
                <div
                    className="p-3 border-t"
                    style={{ borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))' }}
                >
                    <button
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-opacity duration-100"
                        style={{
                            background: canGenerate
                                ? 'var(--ws-accent, #3F5C6E)'
                                : 'var(--ws-text-disabled, #8C8C88)',
                            color: 'var(--ws-accent-fg, #FFFFFF)',
                            opacity: canGenerate ? 1 : 0.4,
                            cursor: canGenerate ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {workflow.isCreating && 'Creating session...'}
                        {workflow.isProjecting && 'Generating projection...'}
                        {workflow.isExecuting && 'Exporting...'}
                        {!workflow.isLoading && 'Generate Output'}
                    </button>
                </div>

                {/* Error */}
                {errorMessage && (
                    <div
                        className="mx-3 mb-3 p-3 text-xs rounded flex items-start gap-2"
                        style={{
                            background: 'color-mix(in srgb, var(--ws-color-error, #8C4A4A) 8%, transparent)',
                            color: 'var(--ws-color-error, #8C4A4A)',
                            border: '1px solid color-mix(in srgb, var(--ws-color-error, #8C4A4A) 20%, transparent)',
                        }}
                    >
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        {errorMessage}
                    </div>
                )}

                {/* Results List */}
                {results.length > 0 && (
                    <div
                        className="p-3 border-t"
                        style={{ borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))' }}
                    >
                        <Text size="xs" weight="bold" color="dimmed" className="mb-2 uppercase tracking-wider">
                            Generated ({results.length})
                        </Text>
                        <div className="space-y-2">
                            {results.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="p-2 rounded"
                                    style={{
                                        background: 'var(--ws-bg, #F5F2ED)',
                                        border: '1px solid var(--ws-panel-border, #D6D2CB)',
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText size={12} style={{ color: 'var(--ws-color-success, #6F7F5C)' }} />
                                        <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                                            {entry.format.toUpperCase()}
                                        </span>
                                        {entry.result.success && <Check size={12} style={{ color: 'var(--ws-color-success, #6F7F5C)' }} />}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {entry.result.downloadUrl && (
                                            <button
                                                onClick={() => downloadOutput.mutate(entry.sessionId)}
                                                className="text-[10px] flex items-center gap-0.5 hover:underline"
                                                style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                                            >
                                                <Download size={10} />
                                                Download
                                            </button>
                                        )}
                                        {entry.result.externalUrl && (
                                            <a
                                                href={entry.result.externalUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] flex items-center gap-0.5 hover:underline"
                                                style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                                            >
                                                <ExternalLink size={10} />
                                                Open
                                            </a>
                                        )}
                                        {entry.result.content && (
                                            <span className="text-[10px]" style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                                                {entry.result.content.length} chars
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Loading Overlay */}
            {workflow.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm"
                    style={{ background: 'color-mix(in srgb, var(--ws-bg, #F5F2ED) 80%, transparent)' }}
                >
                    <div className="text-center">
                        <Loader2 className="animate-spin mx-auto" size={32} style={{ color: 'var(--ws-accent, #3F5C6E)' }} />
                        <p className="text-xs mt-2" style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                            {workflow.isCreating && 'Creating session...'}
                            {workflow.isProjecting && 'Building projection...'}
                            {workflow.isExecuting && 'Formatting output...'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
