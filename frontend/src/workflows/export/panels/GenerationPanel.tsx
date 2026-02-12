/**
 * Output Panel
 *
 * Right sidebar for Export Workbench.
 * Combines output format selection with generation actions.
 * Settings fold out based on selected output module.
 *
 * Executes exports through the backend session pipeline
 * (create session → generate projection → execute export).
 */

import { useState } from 'react';
import { FileText, Table, Loader2, AlertCircle, Check, ChevronDown, ChevronRight, Settings, Download, ExternalLink } from 'lucide-react';
import { GoogleLogo } from '@phosphor-icons/react';
import { useCollectionStore, type TemplatePreset } from '../../../stores';
import { useExportWorkflow, useDownloadExportOutput } from '../../../api/hooks/exports';
import { Text } from '@autoart/ui';

import type { ExportFormat, ExportResult } from '@autoart/shared';

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
// Helpers
// ============================================================================

/**
 * Extract project IDs from collection selections.
 * Phase 1: node-type selections use sourceId directly as project ID.
 * Phase 2 will add record/field → root_project_id resolution.
 */
function resolveProjectIds(selections: { type: string; sourceId: string }[]): string[] {
    const ids = new Set<string>();
    for (const sel of selections) {
        if (sel.type === 'node' || sel.type === 'record') {
            ids.add(sel.sourceId);
        }
    }
    return Array.from(ids);
}

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

    const workflow = useExportWorkflow();
    const downloadOutput = useDownloadExportOutput();
    const [results, setResults] = useState<ExportResultEntry[]>([]);
    const [expandedModule, setExpandedModule] = useState<TemplatePreset | null>(null);

    const selectedPreset = activeCollection?.templatePreset ?? 'bfa_rtf';

    const handleSelectModule = (moduleId: TemplatePreset) => {
        if (!activeCollection) return;
        setTemplatePreset(activeCollection.id, moduleId);
        setExpandedModule(moduleId === expandedModule ? null : moduleId);
    };

    const handleGenerate = async () => {
        if (!activeCollection || activeCollection.selections.length === 0) return;

        const format = PRESET_TO_FORMAT[selectedPreset];
        const projectIds = resolveProjectIds(activeCollection.selections);

        if (projectIds.length === 0) return;

        try {
            const session = await workflow.startExport({ format, projectIds });
            const result = await workflow.finishExport(session.id);

            setResults(prev => [{
                id: crypto.randomUUID(),
                sessionId: session.id,
                format,
                result,
                timestamp: new Date().toISOString(),
            }, ...prev]);

            // Cloud formats open directly
            if (result.externalUrl) {
                window.open(result.externalUrl, '_blank');
            }
        } catch {
            // Error is surfaced via workflow.error
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

    return (
        <div className="flex flex-col h-full bg-ws-bg relative">
            {/* Header */}
            <div className="p-4 border-b border-ws-panel-border bg-ws-panel-bg shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]">
                <Text weight="bold" size="sm">Output</Text>
            </div>

            {/* Output Modules */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-2">
                    {OUTPUT_MODULES.map((module) => {
                        const Icon = module.icon;
                        const isSelected = selectedPreset === module.id;
                        const isExpanded = expandedModule === module.id;

                        return (
                            <div key={module.id}>
                                {/* Module Card */}
                                <button
                                    onClick={() => handleSelectModule(module.id)}
                                    className={`
                                        w-full p-3 rounded-lg text-left transition-all
                                        ${isSelected
                                            ? 'bg-emerald-50 border-2 border-emerald-400 shadow-sm'
                                            : 'bg-ws-panel-bg border border-ws-panel-border hover:border-slate-300 hover:shadow-sm'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded ${isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-ws-text-secondary'}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium ${isSelected ? 'text-emerald-800' : 'text-ws-text-secondary'}`}>
                                                {module.label}
                                            </div>
                                            <div className="text-[10px] text-ws-text-secondary truncate">
                                                {module.description}
                                            </div>
                                        </div>
                                        {module.hasSettings && (
                                            <div className="text-ws-muted">
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* Settings Panel (fold-out) */}
                                {isExpanded && module.hasSettings && (
                                    <div className="mt-1 ml-4 p-3 bg-ws-panel-bg border border-ws-panel-border rounded-lg">
                                        <div className="flex items-center gap-2 mb-2 text-ws-text-secondary">
                                            <Settings size={12} />
                                            <span className="text-[10px] font-medium uppercase tracking-wider">Settings</span>
                                        </div>

                                        {/* Module-specific settings */}
                                        {module.id === 'bfa_rtf' && (
                                            <div className="space-y-3 text-xs">
                                                <div>
                                                    <label className="block text-ws-text-secondary font-medium mb-1">
                                                        Target Document
                                                    </label>
                                                    <select className="w-full px-2 py-1.5 border border-ws-panel-border rounded text-sm bg-ws-panel-bg">
                                                        <option value="">Select document...</option>
                                                        <option value="doc-001">Project Alpha - To-Do List</option>
                                                        <option value="doc-002">Client Deliverables</option>
                                                        <option value="doc-003">Weekly Report</option>
                                                        <option value="new">+ Create new document</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-ws-text-secondary font-medium mb-1">
                                                        Or enter Document ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. DOC-12345"
                                                        className="w-full px-2 py-1.5 border border-ws-panel-border rounded text-sm placeholder:text-ws-muted"
                                                    />
                                                </div>
                                                <div className="pt-2 border-t border-ws-panel-border space-y-2">
                                                    <label className="flex items-center gap-2">
                                                        <input type="checkbox" defaultChecked className="rounded" />
                                                        <span>Include project metadata</span>
                                                    </label>
                                                    <label className="flex items-center gap-2">
                                                        <input type="checkbox" className="rounded" />
                                                        <span>Append to existing content</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                        {module.id === 'csv' && (
                                            <div className="space-y-2 text-xs">
                                                <label className="flex items-center gap-2">
                                                    <input type="checkbox" defaultChecked className="rounded" />
                                                    <span>Include headers</span>
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input type="checkbox" className="rounded" />
                                                    <span>Quote all values</span>
                                                </label>
                                            </div>
                                        )}
                                        {module.id === 'google_docs' && (
                                            <div className="space-y-2 text-xs">
                                                <label className="flex items-center gap-2">
                                                    <input type="checkbox" defaultChecked className="rounded" />
                                                    <span>Create in shared folder</span>
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input type="checkbox" className="rounded" />
                                                    <span>Open after creation</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Generate Button */}
                <div className="p-3 border-t border-ws-panel-border">
                    <button
                        onClick={handleGenerate}
                        disabled={workflow.isLoading || activeCollection.selections.length === 0}
                        className={`
                            w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
                            ${activeCollection.selections.length > 0 && !workflow.isLoading
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-slate-200 text-ws-muted cursor-not-allowed'
                            }
                        `}
                    >
                        {workflow.isCreating && 'Creating session...'}
                        {workflow.isProjecting && 'Generating projection...'}
                        {workflow.isExecuting && 'Exporting...'}
                        {!workflow.isLoading && 'Generate Output'}
                    </button>
                </div>

                {/* Error */}
                {errorMessage && (
                    <div className="mx-3 mb-3 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-start gap-2">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        {errorMessage}
                    </div>
                )}

                {/* Results List */}
                {results.length > 0 && (
                    <div className="p-3 border-t border-ws-panel-border">
                        <Text size="xs" weight="bold" color="dimmed" className="mb-2 uppercase tracking-wider">
                            Generated ({results.length})
                        </Text>
                        <div className="space-y-2">
                            {results.map((entry) => (
                                <div key={entry.id} className="p-2 bg-ws-panel-bg border border-ws-panel-border rounded shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <FileText size={12} className="text-emerald-500" />
                                        <span className="text-xs font-medium text-ws-text-secondary flex-1 truncate">
                                            {entry.format.toUpperCase()}
                                        </span>
                                        {entry.result.success && <Check size={12} className="text-green-500" />}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {entry.result.downloadUrl && (
                                            <button
                                                onClick={() => downloadOutput.mutate(entry.sessionId)}
                                                className="text-[10px] text-ws-accent flex items-center gap-0.5 hover:underline"
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
                                                className="text-[10px] text-ws-accent flex items-center gap-0.5 hover:underline"
                                            >
                                                <ExternalLink size={10} />
                                                Open
                                            </a>
                                        )}
                                        {entry.result.content && (
                                            <span className="text-[10px] text-ws-muted">
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
                <div className="absolute inset-0 bg-ws-panel-bg/70 flex items-center justify-center z-10 backdrop-blur-sm">
                    <div className="text-center">
                        <Loader2 className="animate-spin text-emerald-500 mx-auto" size={32} />
                        <p className="text-xs text-ws-text-secondary mt-2">
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
