/**
 * CollectorPanel
 * 
 * UI for triggering external collection workflows:
 * 1. Web Collector: Scrapes a URL for artist data.
 * 2. Local Intake: Scans a local folder to generate an intake manifest.
 */

import { useState, useCallback } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle, Globe, FolderInput, FolderOpen } from 'lucide-react';

import { Card, Stack, Text, Inline, Button } from '@autoart/ui';
import { api } from '../../../api/client';
import { useCollectionStore } from '../../../stores';
import { generateIntakeManifest } from '../../../api/generate';

// =============================================================================
// TYPES
// =============================================================================

type CollectorMode = 'web' | 'intake';

interface CollectorProgress {
    stage: string;
    message: string;
    percent?: number;
}

interface CollectorResult {
    success: boolean;
    artifacts: Array<{
        ref_id: string;
        path: string;
        artifact_type: string;
    }>;
    error?: string;
}

interface CollectorPanelProps {
    onComplete?: (result: CollectorResult) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CollectorPanel({ onComplete }: CollectorPanelProps) {
    const [mode, setMode] = useState<CollectorMode>('web');

    // Web State
    const [url, setUrl] = useState('');

    // Intake State
    const [folderPath, setFolderPath] = useState('');
    const activeCollection = useCollectionStore(s =>
        s.activeCollectionId ? s.collections.get(s.activeCollectionId) ?? null : null
    );

    // Common State
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<CollectorProgress | null>(null);
    const [result, setResult] = useState<CollectorResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    const handleWebCollection = useCallback(async () => {
        if (!url.trim()) return;

        setIsRunning(true);
        setProgress({ stage: 'starting', message: 'Connecting to AutoHelper...', percent: 0 });
        setResult(null);
        setError(null);

        try {
            // Use api client for consistent auth headers and error handling
            const data = await api.post<CollectorResult>('/runner/invoke', {
                runner_id: 'autocollector',
                config: { url: url.trim() },
                output_folder: '_collected',  // Relative to allowed roots
            });

            setResult(data);

            if (data.success) {
                setProgress({ stage: 'complete', message: 'Collection complete!', percent: 100 });
                onComplete?.(data);
            } else {
                setError(data.error || 'Unknown error');
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Collection failed');
        } finally {
            setIsRunning(false);
        }
    }, [url, onComplete]);

    const handleIntakeGeneration = useCallback(async () => {
        if (!activeCollection) {
            setError("Active collection required for Intake");
            return;
        }

        // Use user input or prompt (fallback for now, ideally browse button)
        let targetFolder = folderPath.trim();
        if (!targetFolder) {
            const promptPath = window.prompt("Enter absolute intake folder path:", "");
            if (!promptPath) return;
            targetFolder = promptPath;
            setFolderPath(targetFolder);
        }

        setIsRunning(true);
        setProgress({ stage: 'scanning', message: 'Scanning local folder...', percent: 0 });
        setResult(null);
        setError(null);

        try {
            const artifact = await generateIntakeManifest({
                context_id: activeCollection.id,
                intake_folder: targetFolder,
                options: { overwrite: true }
            });

            const successResult: CollectorResult = {
                success: true,
                artifacts: [{
                    ref_id: artifact.ref_id,
                    path: artifact.path,
                    artifact_type: artifact.artifact_type
                }]
            };

            setResult(successResult);
            setProgress({ stage: 'complete', message: 'Manifest generated!', percent: 100 });
            onComplete?.(successResult);

        } catch (err: any) {
            setError(err.message || "Failed to generate manifest");
        } finally {
            setIsRunning(false);
        }
    }, [activeCollection, folderPath, onComplete]);

    const handleAction = mode === 'web' ? handleWebCollection : handleIntakeGeneration;
    const canRun = mode === 'web' ? !!url.trim() : (!!activeCollection); // Folder can be prompted

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    return (
        <Card className="p-4 bg-white/50">
            <Stack gap="md">
                {/* Header / Mode Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('web')}
                        className={`
                            flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-all
                            ${mode === 'web' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}
                        `}
                    >
                        <Globe size={14} />
                        Web
                    </button>
                    <button
                        onClick={() => setMode('intake')}
                        className={`
                            flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-all
                            ${mode === 'intake' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}
                        `}
                    >
                        <FolderInput size={14} />
                        Intake
                    </button>
                </div>

                {/* Web Mode Content */}
                {mode === 'web' && (
                    <div className="space-y-3">
                        <Text size="sm" color="dimmed">
                            Enter a website URL to collect artist bio and images.
                        </Text>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://artistwebsite.com"
                            disabled={isRunning}
                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                        />
                    </div>
                )}

                {/* Intake Mode Content */}
                {mode === 'intake' && (
                    <div className="space-y-3">
                        <Text size="sm" color="dimmed">
                            Scan a local folder to register files into the active collection.
                        </Text>

                        {!activeCollection ? (
                            <div className="p-3 bg-amber-50 text-amber-700 text-xs rounded-lg flex items-center gap-2">
                                <AlertCircle size={14} />
                                Please create/select a collection first.
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    value={folderPath}
                                    onChange={(e) => setFolderPath(e.target.value)}
                                    placeholder="C:/Path/To/Files"
                                    disabled={isRunning}
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono disabled:opacity-50"
                                />
                                <FolderOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        )}
                    </div>
                )}

                {/* Action Button */}
                <Button
                    variant="primary"
                    disabled={!canRun || isRunning}
                    onClick={handleAction}
                    className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                    {isRunning ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                        <Play size={16} className="mr-2 fill-current" />
                    )}
                    {mode === 'web' ? 'Start Web Collection' : 'Generate Manifest'}
                </Button>


                {/* Progress */}
                {progress && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <Inline justify="between" className="mb-2">
                            <Text size="sm" weight="medium" className="capitalize text-slate-700">
                                {progress.stage}
                            </Text>
                            {progress.percent !== undefined && (
                                <Text size="xs" color="dimmed">{progress.percent}%</Text>
                            )}
                        </Inline>
                        <Text size="xs" color="dimmed">{progress.message}</Text>
                        {progress.percent !== undefined && (
                            <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Success */}
                {result?.success && (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                        <CheckCircle2 size={16} />
                        <Text size="sm">
                            {mode === 'web'
                                ? `Collected ${result.artifacts.length} artifacts`
                                : `Manifest generated successfully`
                            }
                        </Text>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                        <AlertCircle size={16} />
                        <Text size="sm">{error}</Text>
                    </div>
                )}
            </Stack>
        </Card>
    );
}

export default CollectorPanel;
