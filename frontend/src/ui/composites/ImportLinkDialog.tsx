/**
 * ImportLinkDialog
 *
 * Modal for linking an action to an import session item.
 * Shows: session selector, filtered item list, classification badges.
 * On selection, creates an import-action link via the API.
 */

import { clsx } from 'clsx';
import { Link2, FileText, AlertCircle } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import type { ItemClassificationResponse } from '@autoart/shared';
import { Modal, Button, Select, Spinner, Text, Inline, Stack } from '@autoart/ui';

import {
    useImportSessions,
    useClassifications,
    useImportPlan,
    useActionImportLinks,
    useLinkAction,
} from '../../api/hooks/imports';
import type { ImportPlanItem } from '../../api/hooks/imports';

// ==================== TYPES ====================

interface ImportLinkDialogProps {
    open: boolean;
    onClose: () => void;
    actionId: string;
    actionTitle?: string;
}

// ==================== HELPERS ====================

type ClassificationOutcome = ItemClassificationResponse['outcome'];

const OUTCOME_STYLES: Record<ClassificationOutcome, { bg: string; text: string; border: string; label: string }> = {
    FACT_EMITTED: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'Fact Emitted',
    },
    DERIVED_STATE: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        label: 'Derived State',
    },
    INTERNAL_WORK: {
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        label: 'Internal Work',
    },
    EXTERNAL_WORK: {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        label: 'External Work',
    },
    AMBIGUOUS: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        label: 'Ambiguous',
    },
    UNCLASSIFIED: {
        bg: 'bg-slate-50',
        text: 'text-slate-500',
        border: 'border-slate-200',
        label: 'Unclassified',
    },
    DEFERRED: {
        bg: 'bg-slate-50',
        text: 'text-slate-400',
        border: 'border-slate-200',
        label: 'Deferred',
    },
};

function OutcomeBadge({ outcome }: { outcome: ClassificationOutcome }) {
    const style = OUTCOME_STYLES[outcome] || OUTCOME_STYLES.UNCLASSIFIED;
    return (
        <span
            className={clsx(
                'inline-flex items-center px-2 text-[10px] font-medium rounded-full border',
                style.bg, style.text, style.border
            )}
        >
            {style.label}
        </span>
    );
}

// ==================== MAIN COMPONENT ====================

export function ImportLinkDialog({ open, onClose, actionId, actionTitle }: ImportLinkDialogProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    // Fetch sessions for the dropdown
    const { data: sessionsData, isLoading: sessionsLoading } = useImportSessions();

    // Fetch plan items for the selected session (items have titles)
    const { data: planData, isLoading: planLoading } = useImportPlan(selectedSessionId);

    // Fetch classifications for the selected session
    const { data: classificationsData, isLoading: classificationsLoading } = useClassifications(selectedSessionId ?? undefined);

    // Fetch existing links for this action (to filter out already-linked items)
    const { data: existingLinksData } = useActionImportLinks(actionId);

    // Link mutation
    const linkAction = useLinkAction();

    const sessions = sessionsData?.sessions ?? [];
    const sessionOptions = sessions.map((s) => ({
        value: s.id,
        label: `${s.parser_name} (${s.status}) - ${new Date(s.created_at).toLocaleDateString()}`,
    }));

    // Build classification lookup by itemTempId
    const classificationMap = useMemo(() => {
        const map = new Map<string, ItemClassificationResponse>();
        for (const c of classificationsData?.classifications ?? []) {
            map.set(c.itemTempId, c);
        }
        return map;
    }, [classificationsData]);

    // Set of already-linked item temp IDs for this action
    const linkedItemIds = useMemo(() => {
        const set = new Set<string>();
        for (const link of existingLinksData?.links ?? []) {
            if (link.importSessionId === selectedSessionId) {
                set.add(link.itemTempId);
            }
        }
        return set;
    }, [existingLinksData, selectedSessionId]);

    // Items from the plan, enriched with classification data
    const items = useMemo(() => {
        const planItems = planData?.items ?? [];
        return planItems.map((item: ImportPlanItem) => ({
            ...item,
            classification: classificationMap.get(item.tempId),
            isLinked: linkedItemIds.has(item.tempId),
        }));
    }, [planData, classificationMap, linkedItemIds]);

    const handleLinkItem = useCallback(
        (itemTempId: string) => {
            if (!selectedSessionId) return;
            linkAction.mutate(
                {
                    sessionId: selectedSessionId,
                    itemTempId,
                    actionId,
                },
                {
                    onSuccess: () => {
                        // Stay open so user can link more items, or close
                    },
                }
            );
        },
        [selectedSessionId, actionId, linkAction]
    );

    const handleClose = useCallback(() => {
        setSelectedSessionId(null);
        linkAction.reset();
        onClose();
    }, [onClose, linkAction]);

    const isItemsLoading = planLoading || classificationsLoading;

    return (
        <Modal
            open={open}
            onOpenChange={(isOpen) => !isOpen && handleClose()}
            title="Link to Import Item"
            description={actionTitle ? `Link "${actionTitle}" to an imported item.` : 'Select a session and item to link.'}
            size="lg"
        >
            <Stack gap="md">
                {/* Session selector */}
                {sessionsLoading ? (
                    <Inline gap="sm" align="center">
                        <Spinner size="sm" />
                        <Text size="sm" className="text-ws-text-secondary">Loading sessions...</Text>
                    </Inline>
                ) : sessions.length === 0 ? (
                    <div className="p-4 bg-ws-bg rounded-lg border border-ws-panel-border text-center">
                        <Text size="sm" className="text-ws-text-secondary">No import sessions found.</Text>
                    </div>
                ) : (
                    <Select
                        label="Import Session"
                        placeholder="Select a session..."
                        value={selectedSessionId}
                        onChange={setSelectedSessionId}
                        data={sessionOptions}
                        size="sm"
                    />
                )}

                {/* Items list */}
                {selectedSessionId && (
                    <div className="border border-ws-panel-border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-ws-bg border-b border-ws-panel-border">
                            <Text size="sm" className="font-medium text-ws-text-secondary">
                                Items ({items.filter((i) => !i.isLinked).length} available)
                            </Text>
                        </div>

                        {isItemsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Spinner size="sm" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="px-3 py-6 text-center">
                                <Text size="sm" className="text-ws-text-secondary">No items in this session.</Text>
                            </div>
                        ) : (
                            <div className="max-h-64 overflow-y-auto divide-y divide-ws-panel-border">
                                {items.map((item) => (
                                    <div
                                        key={item.tempId}
                                        className={clsx(
                                            'flex items-center justify-between px-3 py-2 text-sm',
                                            item.isLinked
                                                ? 'bg-ws-bg opacity-60'
                                                : 'hover:bg-ws-row-expanded-bg cursor-pointer'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <FileText size={14} className="text-ws-muted shrink-0" />
                                            <span className="truncate text-ws-fg">{item.title}</span>
                                            {item.classification && (
                                                <OutcomeBadge outcome={item.classification.outcome} />
                                            )}
                                        </div>

                                        <div className="shrink-0 ml-2">
                                            {item.isLinked ? (
                                                <span className="text-xs text-ws-text-secondary">Linked</span>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleLinkItem(item.tempId)}
                                                    disabled={linkAction.isPending}
                                                >
                                                    <Inline gap="xs" align="center">
                                                        <Link2 size={12} />
                                                        Link
                                                    </Inline>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Error state */}
                {linkAction.isError && (
                    <Inline gap="sm" align="center" className="text-ws-color-error">
                        <AlertCircle size={14} />
                        <Text size="sm">
                            {linkAction.error instanceof Error
                                ? linkAction.error.message
                                : 'Failed to create link'}
                        </Text>
                    </Inline>
                )}

                {/* Footer */}
                <Inline gap="sm" justify="end" className="pt-2">
                    <Button variant="secondary" onClick={handleClose}>
                        {linkAction.isSuccess ? 'Done' : 'Cancel'}
                    </Button>
                </Inline>
            </Stack>
        </Modal>
    );
}
