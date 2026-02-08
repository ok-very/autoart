/**
 * BfaSyncView
 *
 * Main reconciliation view for BFA sync operations.
 * Allows triggering sync, reviewing field-level diffs,
 * submitting accept/reject/defer decisions, and applying changes.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';

import type { BfaSyncDecision, BfaSubmitDecision, BfaApplyResult, BfaInjectionResult, BfaImportResult } from '@autoart/shared';

import { Button, Card, Select, Spinner, Stack, Inline, Badge, TextInput } from '@autoart/ui';

import {
    useBfaSyncReports,
    useBfaSyncReport,
    useBfaDecisions,
    useTriggerBfaSync,
    useSubmitBfaDecisions,
    useApplyBfaDecisions,
    useInjectBfaToGoogleDoc,
    useImportBfaToAutoArt,
} from '../../api/hooks/bfaSync';

import { BfaSyncStatsBar } from './components/BfaSyncStatsBar';
import { BfaFieldChangesTable } from './components/BfaFieldChangesTable';

/** Build a stable key for a field change */
function changeKey(entityId: string, field: string): string {
    return `${entityId}::${field}`;
}

export function BfaSyncView() {
    // Board selection
    const [selectedBoardConfigId, setSelectedBoardConfigId] = useState<string | null>(null);

    // Local decision state (dirty until submitted)
    const [localDecisions, setLocalDecisions] = useState<Map<string, BfaSyncDecision | null>>(new Map());

    // Apply result display
    const [applyResult, setApplyResult] = useState<BfaApplyResult | null>(null);

    // Injection state
    const [docIdInput, setDocIdInput] = useState<string>(() =>
        localStorage.getItem('bfa-sync-doc-id') ?? ''
    );
    const [injectionResult, setInjectionResult] = useState<BfaInjectionResult | null>(null);

    // Import state
    const [importResult, setImportResult] = useState<BfaImportResult | null>(null);

    // Persist doc ID to localStorage
    useEffect(() => {
        if (docIdInput) {
            localStorage.setItem('bfa-sync-doc-id', docIdInput);
        } else {
            localStorage.removeItem('bfa-sync-doc-id');
        }
    }, [docIdInput]);

    // API hooks
    const { data: reports, isLoading: reportsLoading } = useBfaSyncReports();
    const { data: report, isLoading: reportLoading } = useBfaSyncReport(selectedBoardConfigId);
    const { data: persistedDecisions } = useBfaDecisions(selectedBoardConfigId);

    const triggerSync = useTriggerBfaSync();
    const submitDecisions = useSubmitBfaDecisions();
    const applyDecisions = useApplyBfaDecisions();
    const injectToDoc = useInjectBfaToGoogleDoc();
    const importToAutoArt = useImportBfaToAutoArt();

    // Board selector options from reports (deduplicated by boardId)
    const boardOptions = useMemo(() => {
        if (!reports) return [];
        const seen = new Set<string>();
        const options: Array<{ value: string; label: string }> = [];
        for (const r of reports) {
            if (!seen.has(r.boardId)) {
                seen.add(r.boardId);
                // Use the report ID as the board config ID (route param is board config ID)
                // The reports list returns full reports; we use boardId for display, id for API calls
                options.push({ value: r.boardId, label: `Board ${r.boardId.slice(0, 8)}...` });
            }
        }
        return options;
    }, [reports]);

    // Merge persisted decisions into local state
    const mergedDecisions = useMemo(() => {
        const merged = new Map<string, BfaSyncDecision | null>();

        // First, populate from persisted decisions
        if (persistedDecisions) {
            for (const d of persistedDecisions) {
                merged.set(changeKey(d.entityId, d.field), d.decision);
            }
        }

        // Then overlay local changes (dirty state)
        for (const [key, decision] of localDecisions) {
            merged.set(key, decision);
        }

        return merged;
    }, [persistedDecisions, localDecisions]);

    // Dirty tracking: local changes that differ from persisted
    const dirtyCount = useMemo(() => {
        let count = 0;
        for (const [key, localVal] of localDecisions) {
            const persisted = persistedDecisions?.find(
                d => changeKey(d.entityId, d.field) === key
            );
            if (persisted?.decision !== localVal) {
                count++;
            }
        }
        return count;
    }, [localDecisions, persistedDecisions]);

    // Count accepted decisions (for apply button)
    const acceptedCount = useMemo(() => {
        let count = 0;
        for (const [, decision] of mergedDecisions) {
            if (decision === 'accept') count++;
        }
        return count;
    }, [mergedDecisions]);

    const handleDecisionChange = useCallback((entityId: string, field: string, decision: BfaSyncDecision) => {
        setLocalDecisions(prev => {
            const next = new Map(prev);
            next.set(changeKey(entityId, field), decision);
            return next;
        });
    }, []);

    const handleTriggerSync = () => {
        if (!selectedBoardConfigId) return;
        setApplyResult(null);
        triggerSync.mutate({ boardConfigId: selectedBoardConfigId });
    };

    const handleSubmitDecisions = () => {
        if (!selectedBoardConfigId || dirtyCount === 0) return;

        const decisions: BfaSubmitDecision[] = [];
        for (const [key, decision] of localDecisions) {
            if (decision === null) continue;
            const [entityId, field] = key.split('::');
            decisions.push({ entityId, field, decision });
        }

        submitDecisions.mutate(
            { boardConfigId: selectedBoardConfigId, decisions },
            { onSuccess: () => setLocalDecisions(new Map()) },
        );
    };

    const handleApply = () => {
        if (!selectedBoardConfigId) return;
        applyDecisions.mutate(
            { boardConfigId: selectedBoardConfigId },
            { onSuccess: (result) => setApplyResult(result) },
        );
    };

    const handleInject = () => {
        if (!selectedBoardConfigId || !docIdInput.trim()) return;
        setInjectionResult(null);

        // Parse document ID from full URL if needed
        const documentId = parseDocumentId(docIdInput.trim());

        injectToDoc.mutate(
            { boardConfigId: selectedBoardConfigId, documentId },
            { onSuccess: (result) => setInjectionResult(result) },
        );
    };

    const handleImport = () => {
        if (!selectedBoardConfigId) return;
        setImportResult(null);
        importToAutoArt.mutate(
            { boardConfigId: selectedBoardConfigId },
            { onSuccess: (result) => setImportResult(result) },
        );
    };

    const isLoading = reportsLoading || reportLoading;
    const isMutating = triggerSync.isPending || submitDecisions.isPending || applyDecisions.isPending || injectToDoc.isPending || importToAutoArt.isPending;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-ws-panel-border">
                <span className="text-sm font-semibold text-ws-fg">BFA Sync</span>

                <Select
                    value={selectedBoardConfigId}
                    onChange={setSelectedBoardConfigId}
                    data={boardOptions}
                    placeholder="Select board..."
                    size="sm"
                />

                <Button
                    size="sm"
                    variant="primary"
                    onClick={handleTriggerSync}
                    disabled={!selectedBoardConfigId || isMutating}
                >
                    {triggerSync.isPending ? 'Syncing...' : 'Sync Now'}
                </Button>

                {isLoading && <Spinner size="sm" />}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
                <Stack gap="md">
                    {/* Stats bar */}
                    {report && <BfaSyncStatsBar stats={report.stats} />}

                    {/* Error display */}
                    {triggerSync.isError && (
                        <Card padding="sm" className="border-[var(--ws-color-error)]">
                            <span className="text-sm text-[var(--ws-color-error)]">
                                Sync failed: {triggerSync.error?.message}
                            </span>
                        </Card>
                    )}

                    {/* Field changes table */}
                    {report && (
                        <BfaFieldChangesTable
                            changes={report.fieldChanges}
                            decisions={mergedDecisions}
                            onDecisionChange={handleDecisionChange}
                        />
                    )}

                    {/* Warnings */}
                    {report && report.warnings.length > 0 && (
                        <Card padding="sm" className="border-l-2 border-l-[var(--ws-color-warning)]">
                            <Stack gap="sm">
                                <span className="text-xs font-medium text-ws-text-secondary uppercase">
                                    Warnings
                                </span>
                                {report.warnings.map((w, i) => (
                                    <span key={i} className="text-sm text-ws-fg">
                                        {w.message}
                                    </span>
                                ))}
                            </Stack>
                        </Card>
                    )}

                    {/* Apply results banner */}
                    {applyResult && (
                        <Card
                            padding="sm"
                            className={
                                applyResult.errors.length > 0
                                    ? 'border-[var(--ws-color-error)]'
                                    : 'border-[var(--ws-color-success)]'
                            }
                        >
                            <Inline gap="md">
                                <Badge variant="success" size="md">Applied: {applyResult.applied}</Badge>
                                <Badge variant="neutral" size="md">Rejected: {applyResult.rejected}</Badge>
                                <Badge variant="warning" size="md">Deferred: {applyResult.deferred}</Badge>
                                {applyResult.errors.length > 0 && (
                                    <Badge variant="error" size="md">
                                        Errors: {applyResult.errors.length}
                                    </Badge>
                                )}
                            </Inline>
                            {applyResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-[var(--ws-color-error)]">
                                    {applyResult.errors.map((err, i) => (
                                        <div key={i}>
                                            {err.field} on {err.entityId.slice(0, 8)}: {err.error}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Google Docs Injection */}
                    {applyResult && applyResult.applied > 0 && (
                        <Card padding="sm">
                            <Stack gap="sm">
                                <span className="text-xs font-medium text-ws-text-secondary uppercase">
                                    Google Docs Injection
                                </span>
                                <Inline gap="sm" align="end">
                                    <div className="flex-1">
                                        <TextInput
                                            size="sm"
                                            placeholder="Paste Google Doc ID or URL"
                                            value={docIdInput}
                                            onChange={(e) => setDocIdInput(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleInject}
                                        disabled={!docIdInput.trim() || isMutating}
                                    >
                                        {injectToDoc.isPending ? 'Injecting...' : 'Inject to Doc'}
                                    </Button>
                                </Inline>

                                {injectToDoc.isError && (
                                    <span className="text-xs text-[var(--ws-color-error)]">
                                        Injection failed: {injectToDoc.error?.message}
                                    </span>
                                )}

                                {injectionResult && (
                                    <Inline gap="md">
                                        <Badge variant="success" size="md">
                                            Injected: {injectionResult.projectsInjected}
                                        </Badge>
                                        {injectionResult.projectsSkipped > 0 && (
                                            <Badge variant="warning" size="md">
                                                Skipped: {injectionResult.projectsSkipped}
                                            </Badge>
                                        )}
                                        {injectionResult.errors.length > 0 && (
                                            <Badge variant="error" size="md">
                                                Errors: {injectionResult.errors.length}
                                            </Badge>
                                        )}
                                        {injectionResult.documentUrl && (
                                            <a
                                                href={injectionResult.documentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-[var(--ws-accent)] underline"
                                            >
                                                Open Document
                                            </a>
                                        )}
                                    </Inline>
                                )}

                                {injectionResult && injectionResult.errors.length > 0 && (
                                    <div className="text-xs text-[var(--ws-color-error)]">
                                        {injectionResult.errors.map((err, i) => (
                                            <div key={i}>
                                                {err.projectLabel || err.projectId.slice(0, 8)}: {err.error}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Stack>
                        </Card>
                    )}

                    {/* Import to AutoArt */}
                    {applyResult && applyResult.applied > 0 && (
                        <Card padding="sm">
                            <Stack gap="sm">
                                <span className="text-xs font-medium text-ws-text-secondary uppercase">
                                    Import to AutoArt
                                </span>
                                <Inline gap="sm" align="end">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleImport}
                                        disabled={isMutating}
                                    >
                                        {importToAutoArt.isPending ? 'Importing...' : 'Import to AutoArt'}
                                    </Button>
                                </Inline>

                                {importToAutoArt.isError && (
                                    <span className="text-xs text-[var(--ws-color-error)]">
                                        Import failed: {importToAutoArt.error?.message}
                                    </span>
                                )}

                                {importResult && (
                                    <Inline gap="md">
                                        <Badge variant="success" size="md">
                                            Created: {importResult.projectsCreated}
                                        </Badge>
                                        <Badge variant="neutral" size="md">
                                            Updated: {importResult.projectsUpdated}
                                        </Badge>
                                        {importResult.projectsSkipped > 0 && (
                                            <Badge variant="warning" size="md">
                                                Skipped: {importResult.projectsSkipped}
                                            </Badge>
                                        )}
                                        {importResult.recordsCreated > 0 && (
                                            <Badge variant="success" size="md">
                                                Records: {importResult.recordsCreated}
                                            </Badge>
                                        )}
                                        {importResult.errors.length > 0 && (
                                            <Badge variant="error" size="md">
                                                Errors: {importResult.errors.length}
                                            </Badge>
                                        )}
                                    </Inline>
                                )}

                                {importResult && importResult.createdProjectIds.length > 0 && (
                                    <span className="text-xs text-ws-text-secondary">
                                        {importResult.createdProjectIds.length} project{importResult.createdProjectIds.length !== 1 ? 's' : ''} created in hierarchy
                                    </span>
                                )}

                                {importResult && importResult.errors.length > 0 && (
                                    <div className="text-xs text-[var(--ws-color-error)]">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i}>
                                                {err.projectLabel}: {err.error}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Stack>
                        </Card>
                    )}

                    {/* Empty state */}
                    {!report && !isLoading && selectedBoardConfigId && (
                        <div className="py-12 text-center text-ws-text-secondary text-sm">
                            No sync report found. Click "Sync Now" to fetch changes from Monday.
                        </div>
                    )}

                    {!selectedBoardConfigId && !isLoading && (
                        <div className="py-12 text-center text-ws-text-secondary text-sm">
                            Select a board configuration to begin.
                        </div>
                    )}
                </Stack>
            </div>

            {/* Footer */}
            {report && (
                <div className="flex items-center gap-3 px-4 py-3 border-t border-ws-panel-border">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSubmitDecisions}
                        disabled={dirtyCount === 0 || isMutating}
                    >
                        {submitDecisions.isPending
                            ? 'Saving...'
                            : `Submit Decisions${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`
                        }
                    </Button>

                    <Button
                        size="sm"
                        variant="primary"
                        onClick={handleApply}
                        disabled={acceptedCount === 0 || isMutating}
                    >
                        {applyDecisions.isPending
                            ? 'Applying...'
                            : `Apply${acceptedCount > 0 ? ` (${acceptedCount})` : ''}`
                        }
                    </Button>

                    {submitDecisions.isError && (
                        <span className="text-xs text-[var(--ws-color-error)]">
                            Submit failed: {submitDecisions.error?.message}
                        </span>
                    )}
                    {applyDecisions.isError && (
                        <span className="text-xs text-[var(--ws-color-error)]">
                            Apply failed: {applyDecisions.error?.message}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Extract Google Doc ID from a full URL or return the input as-is.
 * Handles: https://docs.google.com/document/d/DOC_ID/edit
 */
function parseDocumentId(input: string): string {
    const match = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : input;
}
