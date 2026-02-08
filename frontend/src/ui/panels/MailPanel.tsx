import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Mail,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Loader2,
    Circle,
    Sparkles,
    Paperclip,
} from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview';

import { Table } from '@autoart/ui';

import {
    useInbox,
    useEnrichedInbox,
    useMailStatus,
} from '../../api/hooks/mail';
import { usePromotedIds } from '../../api/hooks/mailMessages';
import type { ProcessedEmail, Priority, TriageStatus as TriageStatusType } from '../../api/types/mail';
import { EmailActionsMenu } from '../mail/EmailActionsMenu';
import { useWorkspaceContextOptional } from '../../workspace/WorkspaceContext';

const ITEMS_PER_PAGE = 25;

function PriorityBadge({ priority }: { priority: Priority }) {
    const colors: Record<Priority, string> = {
        urgent: 'bg-red-200 text-red-800',
        high: 'bg-red-100 text-red-700',
        medium: 'bg-amber-100 text-amber-700',
        low: 'bg-slate-100 text-ws-text-secondary',
    };

    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority]}`}>
            {priority}
        </span>
    );
}

function TriageStatusIndicator({ status, confidence }: { status: TriageStatusType; confidence?: number }) {
    const config: Record<TriageStatusType, { color: string; label: string }> = {
        pending: { color: 'text-ws-muted', label: 'Pending' },
        action_required: { color: 'text-red-500', label: 'Action Required' },
        informational: { color: 'text-blue-500', label: 'Info' },
        archived: { color: 'text-ws-muted', label: 'Archived' },
    };

    const { color, label } = config[status] || config.pending;
    const showConfidence = confidence !== undefined && confidence > 0;

    return (
        <div className="flex items-center gap-1.5" title={`${label}${showConfidence ? ` (${Math.round(confidence * 100)}%)` : ''}`}>
            <Circle size={8} className={`${color} fill-current`} />
            {showConfidence && (
                <span className="text-[10px] text-ws-muted">{Math.round(confidence * 100)}%</span>
            )}
        </div>
    );
}

function EmailRow({ email, isPromoted, onAction }: { email: ProcessedEmail; isPromoted?: boolean; onAction?: () => void }) {
    const formattedDate = email.receivedAt
        ? new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date(email.receivedAt))
        : '—';

    return (
        <Table.Row>
            <Table.Cell className="w-12">
                <TriageStatusIndicator
                    status={email.triage.status}
                    confidence={email.triage.confidence}
                />
            </Table.Cell>
            <Table.Cell className="w-48">
                <div className="font-medium text-[var(--ws-fg)] truncate">{email.senderName}</div>
                <div className="text-xs text-[var(--ws-text-secondary)] truncate">{email.sender}</div>
            </Table.Cell>
            <Table.Cell>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--ws-fg)] truncate">{email.subject}</span>
                    {isPromoted && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded" title="Saved to system">
                            saved
                        </span>
                    )}
                    {email.hasAttachments && <Paperclip size={14} className="text-ws-muted flex-shrink-0" />}
                </div>
                <div className="text-sm text-[var(--ws-text-secondary)] truncate">{email.bodyPreview}</div>
                {email.extractedKeywords.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                        {email.extractedKeywords.slice(0, 3).map((keyword) => (
                            <span key={keyword} className="px-1.5 py-0.5 bg-slate-100 text-[var(--ws-text-secondary)] text-[10px] rounded">
                                {keyword}
                            </span>
                        ))}
                    </div>
                )}
            </Table.Cell>
            <Table.Cell className="w-20">
                <PriorityBadge priority={email.priority} />
            </Table.Cell>
            <Table.Cell className="w-32 text-[var(--ws-text-secondary)]">{formattedDate}</Table.Cell>
            <Table.Cell className="w-12">
                <EmailActionsMenu email={email} onAction={onAction} />
            </Table.Cell>
        </Table.Row>
    );
}

function StatusIndicator() {
    const { data: status, isLoading, isError } = useMailStatus();

    if (isLoading) {
        return <span className="text-xs text-ws-muted">Checking...</span>;
    }

    if (isError || !status) {
        return (
            <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle size={12} />
                Disconnected
            </span>
        );
    }

    return (
        <span className={`flex items-center gap-1 text-xs ${status.running ? 'text-green-600' : 'text-ws-muted'}`}>
            <Circle size={8} className={status.running ? 'fill-green-500' : 'fill-slate-300'} />
            {status.running ? 'Running' : 'Stopped'}
        </span>
    );
}

export function MailPanel(props: IDockviewPanelProps) {
    const [offset, setOffset] = useState(0);
    const [useEnrichment, setUseEnrichment] = useState(true);

    // When bound to a workspace project, filter mail to that project
    const wsCtx = useWorkspaceContextOptional();
    const isBound = wsCtx?.isBound(props.api.id) ?? false;
    const projectFilter = isBound ? wsCtx?.boundProjectId ?? undefined : undefined;

    const { data: promotedIds } = usePromotedIds();
    const promotedSet = useMemo(
        () => new Set(promotedIds ?? []),
        [promotedIds]
    );

    const basicQuery = useInbox({
        limit: ITEMS_PER_PAGE,
        offset,
        projectId: projectFilter,
    });

    const enrichedQuery = useEnrichedInbox({
        limit: ITEMS_PER_PAGE,
        offset,
        projectId: projectFilter,
    });

    const { data, isLoading, isError, error, refetch, isFetching } = useEnrichment
        ? enrichedQuery
        : basicQuery;

    const totalPages = data ? Math.ceil(data.total / ITEMS_PER_PAGE) : 0;
    const currentPage = Math.floor(offset / ITEMS_PER_PAGE) + 1;
    const prevTotalRef = useRef(data?.total);

    const handlePrevPage = () => {
        setOffset(Math.max(0, offset - ITEMS_PER_PAGE));
    };

    // Guard against offset drifting out of range when total changes
    useEffect(() => {
        const totalChanged = data?.total !== prevTotalRef.current;
        if (totalChanged) {
            prevTotalRef.current = data?.total;
            if (data && offset > 0 && offset >= data.total) {
                // Defer setState to avoid synchronous cascading render
                const correctedOffset = Math.max(0, Math.floor((data.total - 1) / ITEMS_PER_PAGE) * ITEMS_PER_PAGE);
                requestAnimationFrame(() => setOffset(correctedOffset));
            }
        }
    }, [data?.total, offset, data]);

    const handleNextPage = () => {
        if (data && offset + ITEMS_PER_PAGE < data.total) {
            setOffset(offset + ITEMS_PER_PAGE);
        }
    };

    return (
        <div className="h-full flex flex-col bg-ws-bg">
            {/* Header */}
            <header className="bg-ws-panel-bg border-b border-ws-panel-border px-4 py-3 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <StatusIndicator />
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setUseEnrichment(!useEnrichment)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${useEnrichment
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-slate-100 text-ws-text-secondary hover:bg-slate-200'
                                }`}
                            title={useEnrichment ? 'AI triage enabled' : 'AI triage disabled'}
                        >
                            <Sparkles size={12} />
                            AI Triage
                        </button>
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs text-ws-text-secondary hover:text-ws-fg hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-ws-muted" size={32} />
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <AlertCircle className="text-red-400 mb-3" size={40} />
                        <h3 className="text-ws-body text-ws-fg mb-1">Failed to load emails</h3>
                        <p className="text-sm text-ws-text-secondary mb-4">
                            {error instanceof Error ? error.message : 'Could not connect to AutoHelper'}
                        </p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
                        >
                            Retry
                        </button>
                    </div>
                ) : data?.emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Mail className="text-ws-muted mb-3" size={40} />
                        <h3 className="text-ws-body text-ws-fg mb-1">No emails yet</h3>
                        <p className="text-sm text-ws-text-secondary">Emails will appear here once ingested</p>
                    </div>
                ) : (
                    <div className="bg-[var(--ws-panel-bg)] rounded-lg border border-[var(--ws-panel-border)] overflow-hidden">
                        <Table hoverable>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell width="3rem">Status</Table.HeaderCell>
                                    <Table.HeaderCell>From</Table.HeaderCell>
                                    <Table.HeaderCell>Subject</Table.HeaderCell>
                                    <Table.HeaderCell>Priority</Table.HeaderCell>
                                    <Table.HeaderCell>Date</Table.HeaderCell>
                                    <Table.HeaderCell width="3rem" />
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {data?.emails.map((email) => (
                                    <EmailRow key={email.id} email={email} isPromoted={promotedSet.has(email.id)} onAction={() => refetch()} />
                                ))}
                            </Table.Body>
                        </Table>
                    </div>
                )}
            </main>

            {/* Footer / Pagination */}
            {data && data.total > ITEMS_PER_PAGE && (
                <footer className="bg-ws-panel-bg border-t border-ws-panel-border px-4 py-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-ws-text-secondary">
                            Showing {offset + 1}-{Math.min(offset + ITEMS_PER_PAGE, data.total)} of {data.total}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={offset === 0}
                                className="p-1.5 text-ws-text-secondary hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs text-ws-text-secondary">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={handleNextPage}
                                disabled={offset + ITEMS_PER_PAGE >= data.total}
                                className="p-1.5 text-ws-text-secondary hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}
