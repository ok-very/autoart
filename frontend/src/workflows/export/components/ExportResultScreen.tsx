/**
 * ExportResultScreen
 *
 * Success/failure confirmation after export completes.
 * Handles binary (download), text (display), and cloud (external link) results.
 */

import { CheckCircle, Download, ExternalLink, AlertCircle, RotateCcw } from 'lucide-react';

import type { ExportResult } from '@autoart/shared';

// ============================================================================
// Component
// ============================================================================

interface ExportResultScreenProps {
    result: ExportResult;
    onReset: () => void;
    onRetry?: () => void;
}

export function ExportResultScreen({ result, onReset, onRetry }: ExportResultScreenProps) {
    if (!result.success) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
                        style={{ background: 'color-mix(in srgb, var(--ws-color-error, #8C4A4A) 10%, transparent)' }}>
                        <AlertCircle size={24} style={{ color: 'var(--ws-color-error, #8C4A4A)' }} />
                    </div>
                    <p className="text-sm font-medium mb-1"
                        style={{ color: 'var(--ws-fg, #2E2E2C)' }}>
                        Export failed
                    </p>
                    {result.error && (
                        <p className="text-xs mb-4"
                            style={{
                                fontFamily: '"IBM Plex Mono", monospace',
                                color: 'var(--ws-text-disabled, #8C8C88)',
                            }}>
                            {result.error}
                        </p>
                    )}
                    <div className="flex items-center justify-center gap-3">
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                                style={{
                                    background: 'var(--ws-accent, #3F5C6E)',
                                    color: 'var(--ws-accent-fg, #FFFFFF)',
                                }}>
                                <RotateCcw size={14} />
                                Retry
                            </button>
                        )}
                        <button
                            onClick={onReset}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity border"
                            style={{
                                borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                                color: 'var(--ws-text-secondary, #5A5A57)',
                            }}>
                            Start Over
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Success states
    return (
        <div className="h-full flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
                    style={{ background: 'color-mix(in srgb, var(--ws-color-success, #6F7F5C) 10%, transparent)' }}>
                    <CheckCircle size={24} style={{ color: 'var(--ws-color-success, #6F7F5C)' }} />
                </div>
                <p className="text-sm font-medium mb-1"
                    style={{ color: 'var(--ws-fg, #2E2E2C)' }}>
                    Export complete
                </p>
                <p className="text-xs mb-4"
                    style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                    {result.format.toUpperCase()} format
                </p>

                <div className="flex flex-col items-center gap-2">
                    {/* Download link (binary formats) */}
                    {result.downloadUrl && (
                        <a
                            href={result.downloadUrl}
                            download
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                            style={{
                                background: 'var(--ws-accent, #3F5C6E)',
                                color: 'var(--ws-accent-fg, #FFFFFF)',
                            }}>
                            <Download size={14} />
                            Download File
                        </a>
                    )}

                    {/* External link (cloud formats) */}
                    {result.externalUrl && (
                        <a
                            href={result.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                            style={{
                                background: 'var(--ws-accent, #3F5C6E)',
                                color: 'var(--ws-accent-fg, #FFFFFF)',
                            }}>
                            <ExternalLink size={14} />
                            Open Document
                        </a>
                    )}

                    {/* Text content (JSON, CSV, markdown, plaintext) */}
                    {result.content && (
                        <div className="w-full mt-2 max-h-48 overflow-auto rounded-lg p-3 text-left"
                            style={{
                                fontFamily: '"IBM Plex Mono", monospace',
                                fontSize: '12px',
                                background: 'var(--ws-mono-bg, rgba(63, 92, 110, 0.035))',
                                color: 'var(--ws-mono-fg, #3A3A38)',
                            }}>
                            <pre className="whitespace-pre-wrap">{result.content}</pre>
                        </div>
                    )}

                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity border mt-2"
                        style={{
                            borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                            color: 'var(--ws-text-secondary, #5A5A57)',
                        }}>
                        Start New Export
                    </button>
                </div>
            </div>
        </div>
    );
}
