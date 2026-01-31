/**
 * ExportOutputPanel
 *
 * Renders after export completes. Handles:
 * - Binary formats (pdf, docx, rtf): Download button
 * - PDF: Inline preview via react-pdf (lazy loaded)
 * - Text formats (markdown, plaintext, csv): Inline <pre> with copy
 * - Cloud formats (google-*): "Open" link
 * - Error state: Iron Red text, no banners
 */

import { clsx } from 'clsx';
import { Download, ExternalLink, Copy, Check, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useCallback, lazy, Suspense } from 'react';

const PdfPreview = lazy(() => import('./PdfPreview'));

import { useExportSession } from '../../../api/hooks/exports';
import { useDownloadExportOutput } from '../../../api/hooks/exports';
import { API_BASE } from '../../../api/client';
import type { ExportResult } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface ExportOutputPanelProps {
    sessionId: string;
    exportResult?: ExportResult;
    onBack: () => void;
}

// Formats where we show a download button
const BINARY_FORMATS = new Set(['pdf', 'docx', 'rtf']);
// Formats where we show inline text
const TEXT_FORMATS = new Set(['markdown', 'plaintext', 'csv']);
// Formats where we show an external link
const CLOUD_FORMATS = new Set(['google-doc', 'google-sheets', 'google-slides']);

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportOutputPanel({ sessionId, exportResult, onBack }: ExportOutputPanelProps) {
    const { data: session } = useExportSession(sessionId);
    const download = useDownloadExportOutput();
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API may be unavailable in insecure contexts
        }
    }, []);

    if (!session) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <span className="text-sm" style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                    Loading session...
                </span>
            </div>
        );
    }

    const isError = session.status === 'failed';
    const isCompleted = session.status === 'completed';
    const isPending = !isError && !isCompleted;

    return (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--ws-bg, #F5F2ED)' }}>
            {/* Header */}
            <div
                className="flex items-center gap-4 h-12 px-4 border-b"
                style={{ borderColor: 'var(--ws-text-disabled, #D6D2CB)', background: 'var(--ws-bg, #F5F2ED)' }}
            >
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm transition-opacity duration-100 hover:opacity-80"
                    style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                >
                    <ArrowLeft size={14} />
                    Configure
                </button>

                <div className="ml-auto flex items-center gap-3">
                    {/* Format badge */}
                    <span
                        className="px-2 py-0.5 rounded text-xs font-medium uppercase"
                        style={{
                            background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 10%, transparent)',
                            color: 'var(--ws-accent, #3F5C6E)',
                            fontFamily: 'var(--ws-font-mono, "IBM Plex Mono", monospace)',
                        }}
                    >
                        {session.format}
                    </span>

                    {/* Timestamp */}
                    {session.executedAt && (
                        <span
                            className="text-xs"
                            style={{
                                color: 'var(--ws-text-secondary, #5A5A57)',
                                fontFamily: 'var(--ws-font-mono, "IBM Plex Mono", monospace)',
                            }}
                        >
                            {new Date(session.executedAt).toLocaleString('en-CA')}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {isPending && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2
                            size={24}
                            className="animate-spin"
                            style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                        />
                        <span
                            className="text-sm"
                            style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                        >
                            {session.status === 'executing' ? 'Generating export...' : 'Preparing...'}
                        </span>
                    </div>
                )}

                {isError && (
                    <div className="max-w-lg mx-auto mt-12 text-center">
                        <AlertCircle
                            size={32}
                            className="mx-auto mb-4"
                            style={{ color: 'var(--ws-color-error, #8C4A4A)' }}
                        />
                        <p
                            className="text-sm mb-2"
                            style={{ color: 'var(--ws-color-error, #8C4A4A)' }}
                        >
                            Export failed
                        </p>
                        <p
                            className="text-xs"
                            style={{
                                color: 'var(--ws-text-secondary, #5A5A57)',
                                fontFamily: 'var(--ws-font-mono, "IBM Plex Mono", monospace)',
                            }}
                        >
                            {session.error || 'Unknown error'}
                        </p>
                    </div>
                )}

                {isCompleted && BINARY_FORMATS.has(session.format) && (
                    <BinaryOutput
                        sessionId={sessionId}
                        format={session.format}
                        onDownload={() => download.mutate(sessionId)}
                        isDownloading={download.isPending}
                    />
                )}

                {isCompleted && TEXT_FORMATS.has(session.format) && (
                    <TextOutput
                        content={exportResult?.content}
                        onCopy={handleCopy}
                        copied={copied}
                    />
                )}

                {isCompleted && CLOUD_FORMATS.has(session.format) && (
                    <CloudOutput
                        format={session.format}
                        externalUrl={exportResult?.externalUrl}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function BinaryOutput({
    sessionId,
    format,
    onDownload,
    isDownloading,
}: {
    sessionId: string;
    format: string;
    onDownload: () => void;
    isDownloading: boolean;
}) {
    const outputUrl = `${API_BASE}/exports/sessions/${sessionId}/output?disposition=inline`;

    return (
        <div className="flex flex-col items-center gap-6">
            {format === 'pdf' && (
                <Suspense fallback={null}>
                    <PdfPreview url={outputUrl} />
                </Suspense>
            )}

            <button
                onClick={onDownload}
                disabled={isDownloading}
                className={clsx(
                    'flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-opacity duration-100',
                    isDownloading && 'opacity-60 cursor-not-allowed',
                )}
                style={{
                    background: 'var(--ws-accent, #3F5C6E)',
                    color: 'var(--ws-accent-fg, #FFFFFF)',
                }}
            >
                <Download size={16} />
                {isDownloading ? 'Downloading...' : `Download .${format}`}
            </button>
        </div>
    );
}

function TextOutput({
    content,
    onCopy,
    copied,
}: {
    content?: string;
    onCopy: (text: string) => void;
    copied: boolean;
}) {

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-end mb-2">
                <button
                    onClick={() => content && onCopy(content)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-opacity duration-100 hover:opacity-80"
                    style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre
                className="p-4 rounded text-sm overflow-auto whitespace-pre-wrap"
                style={{
                    background: 'var(--ws-mono-bg, rgba(63, 92, 110, 0.035))',
                    color: 'var(--ws-mono-fg, #3A3A38)',
                    fontFamily: 'var(--ws-font-mono, "IBM Plex Mono", monospace)',
                    fontSize: '13px',
                    lineHeight: 1.4,
                    maxHeight: '70vh',
                }}
            >
                {content || 'No content available. Download the file instead.'}
            </pre>
        </div>
    );
}

function CloudOutput({ format, externalUrl }: { format: string; externalUrl?: string }) {
    const labelMap: Record<string, string> = {
        'google-doc': 'Open in Google Docs',
        'google-sheets': 'Open in Google Sheets',
        'google-slides': 'Open in Google Slides',
    };
    const label = labelMap[format] || 'Open';

    return (
        <div className="flex flex-col items-center gap-4 mt-12">
            {externalUrl ? (
                <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-opacity duration-100 hover:opacity-80"
                    style={{
                        background: 'var(--ws-accent, #3F5C6E)',
                        color: 'var(--ws-accent-fg, #FFFFFF)',
                    }}
                >
                    <ExternalLink size={16} />
                    {label}
                </a>
            ) : (
                <p
                    className="text-sm"
                    style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                >
                    Export completed. Check your cloud account.
                </p>
            )}
        </div>
    );
}
