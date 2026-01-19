/**
 * CollectorPanel
 * 
 * UI for triggering AutoHelper's Collector workflow.
 * User inputs a URL, clicks "Start Collection", and sees progress.
 */

import { useState, useCallback } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle, Globe } from 'lucide-react';

import { Card, Stack, Text, Inline, Button } from '@autoart/ui';

// =============================================================================
// TYPES
// =============================================================================

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
    const [url, setUrl] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<CollectorProgress | null>(null);
    const [result, setResult] = useState<CollectorResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleStartCollection = useCallback(async () => {
        if (!url.trim()) return;

        setIsRunning(true);
        setProgress({ stage: 'starting', message: 'Connecting to AutoHelper...', percent: 0 });
        setResult(null);
        setError(null);

        try {
            // TODO: Replace with actual API call to AutoArt backend proxy
            // which forwards to AutoHelper
            const response = await fetch('/api/runner/invoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    runner_id: 'autocollector',
                    config: { url: url.trim() },
                    output_folder: '_collected',  // Relative to allowed roots
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed: ${response.statusText}`);
            }

            const data: CollectorResult = await response.json();
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

    return (
        <Card className="p-4">
            <Stack gap="md">
                <Inline gap="sm">
                    <Globe size={20} className="text-blue-500" />
                    <Text size="md" weight="medium">Collector</Text>
                </Inline>

                <Text size="sm" color="dimmed">
                    Enter a website URL to collect artist bio and images.
                </Text>

                {/* URL Input */}
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://artistwebsite.com"
                        disabled={isRunning}
                        className="flex-1 px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <Button
                        variant="primary"
                        size="sm"
                        disabled={!url.trim() || isRunning}
                        onClick={handleStartCollection}
                    >
                        {isRunning ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Play size={16} />
                        )}
                        <span className="ml-1">Collect</span>
                    </Button>
                </div>

                {/* Progress */}
                {progress && (
                    <div className="bg-slate-50 rounded-lg p-3">
                        <Inline justify="between" className="mb-2">
                            <Text size="sm" weight="medium" className="capitalize">
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
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Success */}
                {result?.success && (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                        <CheckCircle2 size={16} />
                        <Text size="sm">
                            Collected {result.artifacts.length} artifacts
                        </Text>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                        <AlertCircle size={16} />
                        <Text size="sm">{error}</Text>
                    </div>
                )}
            </Stack>
        </Card>
    );
}

export default CollectorPanel;
