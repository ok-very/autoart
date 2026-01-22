/**
 * Output Panel
 * 
 * Right sidebar for Export Workbench.
 * Combines output format selection with generation actions.
 * Settings fold out based on selected output module.
 */

import { useState } from 'react';
import { FileText, Table, Loader2, AlertCircle, Check, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { GoogleLogo } from '@phosphor-icons/react';
import { generateReport, type ArtifactResponse } from '../../api/generate';
import { useCollectionStore, type TemplatePreset } from '../../stores';
import { Text } from '@autoart/ui';

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

export function GenerationPanel() {
    const activeCollection = useCollectionStore(s =>
        s.activeCollectionId ? s.collections.get(s.activeCollectionId) ?? null : null
    );
    const { setTemplatePreset } = useCollectionStore();

    const [isLoading, setIsLoading] = useState(false);
    const [artifacts, setArtifacts] = useState<ArtifactResponse[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [expandedModule, setExpandedModule] = useState<TemplatePreset | null>(null);

    const selectedPreset = activeCollection?.templatePreset ?? 'bfa_rtf';

    const handleSelectModule = (moduleId: TemplatePreset) => {
        if (!activeCollection) return;
        setTemplatePreset(activeCollection.id, moduleId);
        // Expand settings if selecting
        setExpandedModule(moduleId === expandedModule ? null : moduleId);
    };

    const handleGenerate = async () => {
        if (!activeCollection) return;

        const defaultPath = '';
        const outputFolder = window.prompt("Enter output folder:", defaultPath);
        if (!outputFolder) return;

        const template = `# Report: {{name}}\n\n**Collection ID:** {{id}}\n**Items:** {{count}}\n\n## Selections\n\n{{selections}}\n\nGenerated via AutoHelper.`;

        const selectionsList = activeCollection.selections
            .map(s => `- [${s.type}] ${s.displayLabel}`)
            .join('\n');

        setIsLoading(true);
        setError(null);
        try {
            const result = await generateReport({
                context_id: activeCollection.id,
                template: template,
                payload: {
                    name: activeCollection.name,
                    id: activeCollection.id,
                    count: activeCollection.selections.length,
                    selections: selectionsList
                },
                options: { output_folder: outputFolder, overwrite: true }
            });
            setArtifacts(prev => [result, ...prev]);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to generate';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!activeCollection) {
        return (
            <div className="h-full flex items-center justify-center p-4 text-slate-400 text-sm text-center">
                Select a collection to configure output
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]">
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
                                            : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded ${isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>
                                                {module.label}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate">
                                                {module.description}
                                            </div>
                                        </div>
                                        {module.hasSettings && (
                                            <div className="text-slate-400">
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* Settings Panel (fold-out) */}
                                {isExpanded && module.hasSettings && (
                                    <div className="mt-1 ml-4 p-3 bg-white border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                                            <Settings size={12} />
                                            <span className="text-[10px] font-medium uppercase tracking-wider">Settings</span>
                                        </div>

                                        {/* Module-specific settings */}
                                        {module.id === 'bfa_rtf' && (
                                            <div className="space-y-3 text-xs">
                                                {/* Document ID Input */}
                                                <div>
                                                    <label className="block text-slate-600 font-medium mb-1">
                                                        Target Document
                                                    </label>
                                                    <select className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white">
                                                        <option value="">Select document...</option>
                                                        <option value="doc-001">Project Alpha - To-Do List</option>
                                                        <option value="doc-002">Client Deliverables</option>
                                                        <option value="doc-003">Weekly Report</option>
                                                        <option value="new">+ Create new document</option>
                                                    </select>
                                                </div>

                                                {/* Document ID Manual Entry */}
                                                <div>
                                                    <label className="block text-slate-600 font-medium mb-1">
                                                        Or enter Document ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. DOC-12345"
                                                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm placeholder:text-slate-300"
                                                    />
                                                </div>

                                                {/* Options */}
                                                <div className="pt-2 border-t border-slate-100 space-y-2">
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
                <div className="p-3 border-t border-slate-200">
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || activeCollection.selections.length === 0}
                        className={`
                            w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
                            ${activeCollection.selections.length > 0 && !isLoading
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }
                        `}
                    >
                        {isLoading ? 'Generating...' : 'Generate Output'}
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-3 mb-3 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-start gap-2">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Artifacts List */}
                {artifacts.length > 0 && (
                    <div className="p-3 border-t border-slate-200">
                        <Text size="xs" weight="bold" color="dimmed" className="mb-2 uppercase tracking-wider">
                            Generated ({artifacts.length})
                        </Text>
                        <div className="space-y-2">
                            {artifacts.map((art) => (
                                <div key={art.ref_id} className="p-2 bg-white border border-slate-200 rounded shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <FileText size={12} className="text-emerald-500" />
                                        <span className="text-xs font-medium text-slate-700 flex-1 truncate">
                                            {art.artifact_type.replace(/_/g, ' ')}
                                        </span>
                                        <Check size={12} className="text-green-500" />
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate mt-1" title={art.path}>
                                        {art.path}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
            )}
        </div>
    );
}
