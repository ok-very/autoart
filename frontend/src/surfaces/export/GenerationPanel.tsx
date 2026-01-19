/**
 * Generation Panel
 * 
 * Side panel for executing artifact generation actions.
 */

import { useState } from 'react';
import { FileText, FolderInput, Loader2, AlertCircle, Check } from 'lucide-react';
import { generateIntakeManifest, generateReport, type ArtifactResponse } from '../../api/generate';
import { useCollectionStore } from '../../stores';
import { Button, Text } from '@autoart/ui';

export function GenerationPanel() {
    const { activeCollection } = useCollectionStore();
    const [isLoading, setIsLoading] = useState(false);
    const [artifacts, setArtifacts] = useState<ArtifactResponse[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateManifest = async () => {
        if (!activeCollection) return;

        const defaultPath = '';
        const folder = window.prompt("Enter absolute intake folder path (e.g. C:/Users/USERNAME/Documents/automatiq/Intake):", defaultPath);
        if (!folder) return;

        setIsLoading(true);
        setError(null);
        try {
            const result = await generateIntakeManifest({
                context_id: activeCollection.id,
                intake_folder: folder,
                options: { overwrite: true }
            });
            setArtifacts(prev => [result, ...prev]);
        } catch (e: any) {
            setError(e.message || "Failed to generate manifest");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!activeCollection) return;

        const defaultPath = '';
        const outputFolder = window.prompt("Enter output folder for report (e.g. C:/Users/USERNAME/Documents/automatiq/Reports):", defaultPath);
        if (!outputFolder) return;

        // Simple template for MVP
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
        } catch (e: any) {
            setError(e.message || "Failed to generate report");
        } finally {
            setIsLoading(false);
        }
    };

    if (!activeCollection) {
        return <div className="p-4 text-slate-400 text-sm">Select a collection to enable generation actions.</div>;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="p-4 border-b border-slate-200 bg-white">
                <Text weight="bold" size="sm">Generation Actions</Text>
            </div>

            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                {/* Actions */}
                <div className="space-y-3">
                    <Button onClick={handleGenerateManifest} disabled={isLoading} className="w-full justify-start h-auto py-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded">
                                <FolderInput size={18} />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-medium text-sm">Intake Manifest</span>
                                <span className="text-[10px] text-slate-500">Scan folder & register files</span>
                            </div>
                        </div>
                    </Button>

                    <Button onClick={handleGenerateReport} disabled={isLoading} className="w-full justify-start h-auto py-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
                                <FileText size={18} />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-medium text-sm">Project Report</span>
                                <span className="text-[10px] text-slate-500">Generate summary markdown</span>
                            </div>
                        </div>
                    </Button>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-start gap-2 break-all">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Artifacts List */}
                {artifacts.length > 0 && (
                    <div>
                        <Text size="xs" weight="bold" color="dimmed" className="mb-2 uppercase tracking-wider">
                            Artifacts ({artifacts.length})
                        </Text>
                        <div className="space-y-2">
                            {artifacts.map((art) => (
                                <div key={art.ref_id} className="p-3 bg-white border border-slate-200 rounded shadow-sm hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-1">
                                        {art.artifact_type === 'intake_manifest'
                                            ? <FolderInput size={14} className="text-blue-500" />
                                            : <FileText size={14} className="text-emerald-500" />
                                        }
                                        <span className="text-xs font-medium text-slate-700 capitalize">
                                            {art.artifact_type.replace(/_/g, ' ')}
                                        </span>
                                        <Check size={12} className="ml-auto text-green-500" />
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate break-all" title={art.path}>
                                        {art.path}
                                    </div>
                                    <div className="text-[10px] text-slate-300 font-mono mt-1 flex items-center gap-1">
                                        <span className="bg-slate-100 px-1 rounded">REF</span>
                                        {art.ref_id.slice(0, 8)}...
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isLoading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
            )}
        </div>
    );
}
