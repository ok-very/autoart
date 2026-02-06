/**
 * PollEditorView - Poll editor with tabs for settings and results
 *
 * Features:
 * - Title, description, confirmation message editing
 * - Time configuration (dates, hours, meeting duration, timezone)
 * - Status management
 * - Results view with response counts and heatmap
 */

import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Loader2, Check, ExternalLink, Copy, Trash2 } from 'lucide-react';

import { Button, MiniCalendar } from '@autoart/ui';
import {
    usePolls,
    useUpdatePoll,
    usePollResults,
    useDeletePoll,
} from '../../api/hooks/polls';
import type { UpdatePollInput, PollTimeConfig } from '@autoart/shared';

// Common timezones for the dropdown
const COMMON_TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Vancouver',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
    'Pacific/Auckland',
] as const;

interface PollEditorViewProps {
    pollId: string;
    onBack?: () => void;
    onDeleted?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type EditorTab = 'editor' | 'results';

const DURATION_OPTIONS = [
    { value: '15min', label: '15 min' },
    { value: '30min', label: '30 min' },
    { value: '60min', label: '1 hr' },
] as const;

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
] as const;

export function PollEditorView({ pollId, onBack, onDeleted }: PollEditorViewProps) {
    const { data: polls, isLoading: pollsLoading } = usePolls();
    const updatePoll = useUpdatePoll();
    const deletePoll = useDeletePoll();
    const { data: resultsData, isLoading: resultsLoading } = usePollResults(pollId);

    const poll = useMemo(() => polls?.find((p) => p.id === pollId), [polls, pollId]);

    // Track user changes
    const [titleChanges, setTitleChanges] = useState<string | null>(null);
    const [descriptionChanges, setDescriptionChanges] = useState<string | null>(null);
    const [confirmationChanges, setConfirmationChanges] = useState<string | null>(null);
    const [timeConfigChanges, setTimeConfigChanges] = useState<PollTimeConfig | null>(null);
    const [statusChanges, setStatusChanges] = useState<'active' | 'draft' | null>(null);

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [activeTab, setActiveTab] = useState<EditorTab>('editor');
    const [copied, setCopied] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Derive current values
    const title = titleChanges ?? poll?.title ?? '';
    const description = descriptionChanges ?? poll?.description ?? '';
    const confirmationMessage = confirmationChanges ?? poll?.confirmation_message ?? '';
    const timeConfig = timeConfigChanges ?? (poll?.time_config as PollTimeConfig | undefined);
    const status = statusChanges ?? (poll?.status as 'active' | 'draft' | undefined);

    const hasChanges =
        titleChanges !== null ||
        descriptionChanges !== null ||
        confirmationChanges !== null ||
        timeConfigChanges !== null ||
        statusChanges !== null;

    const handleSave = useCallback(async () => {
        if (!hasChanges || !poll) return;

        setSaveStatus('saving');
        try {
            const updates: UpdatePollInput = {};
            if (titleChanges !== null) updates.title = titleChanges;
            if (descriptionChanges !== null) updates.description = descriptionChanges || null;
            if (confirmationChanges !== null) updates.confirmation_message = confirmationChanges || null;
            if (timeConfigChanges !== null) updates.time_config = timeConfigChanges;
            if (statusChanges !== null) updates.status = statusChanges;

            await updatePoll.mutateAsync({ id: pollId, updates });

            // Reset changes
            setTitleChanges(null);
            setDescriptionChanges(null);
            setConfirmationChanges(null);
            setTimeConfigChanges(null);
            setStatusChanges(null);

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error('Failed to save poll:', err);
            setSaveStatus('error');
        }
    }, [
        hasChanges,
        poll,
        pollId,
        titleChanges,
        descriptionChanges,
        confirmationChanges,
        timeConfigChanges,
        statusChanges,
        updatePoll,
    ]);

    const handleDelete = useCallback(async () => {
        try {
            await deletePoll.mutateAsync(pollId);
            onDeleted?.();
            onBack?.();
        } catch (err) {
            console.error('Failed to delete poll:', err);
        }
    }, [pollId, deletePoll, onDeleted, onBack]);

    const handleDateRemove = useCallback((dateToRemove: string) => {
        if (!timeConfig) return;
        setTimeConfigChanges({
            ...timeConfig,
            dates: timeConfig.dates.filter((d) => d !== dateToRemove),
        });
    }, [timeConfig]);

    const publicUrl = poll?.unique_id ? `/public/poll/${poll.unique_id}` : null;

    const handleCopyUrl = () => {
        if (publicUrl) {
            navigator.clipboard.writeText(window.location.origin + publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const renderSaveStatus = () => {
        switch (saveStatus) {
            case 'saving':
                return (
                    <span className="flex items-center gap-1 text-xs text-ws-muted">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                    </span>
                );
            case 'saved':
                return (
                    <span className="flex items-center gap-1 text-xs text-ws-success">
                        <Check className="w-3 h-3" />
                        Saved
                    </span>
                );
            case 'error':
                return <span className="text-xs text-ws-error">Save failed</span>;
            default:
                return null;
        }
    };

    if (pollsLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-ws-info" />
            </div>
        );
    }

    if (!poll) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-ws-text-secondary">Poll not found</p>
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Polls
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="h-12 bg-ws-panel-bg border-b border-ws-panel-border flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-ws-text-secondary hover:bg-ws-hover"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ws-fg">{title || 'Untitled Poll'}</span>
                        <div className="flex items-center gap-2">
                            {renderSaveStatus()}
                        </div>
                    </div>
                </div>

                {/* Center: Tabs */}
                <div className="flex h-full">
                    {(['editor', 'results'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 h-full flex items-center text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab
                                    ? 'text-ws-accent border-ws-accent'
                                    : 'text-ws-text-secondary border-transparent hover:text-ws-fg'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {publicUrl && (
                        <>
                            <button
                                onClick={handleCopyUrl}
                                className="p-2 text-ws-text-secondary hover:bg-ws-hover rounded"
                                title="Copy URL"
                            >
                                {copied ? <Check className="w-4 h-4 text-ws-success" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <a
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-ws-text-secondary hover:bg-ws-hover rounded"
                                title="Open public poll"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </>
                    )}
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges || updatePoll.isPending}
                    >
                        {updatePoll.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            'Save'
                        )}
                    </Button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-6">
                {activeTab === 'editor' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {/* Basic Info */}
                        <section className="bg-ws-panel-bg rounded-lg border border-ws-panel-border p-4 space-y-4">
                            <h2 className="text-sm font-semibold text-ws-fg">Basic Information</h2>

                            <div>
                                <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitleChanges(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg focus:outline-none focus:ring-1 focus:ring-ws-accent"
                                    placeholder="Poll title"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescriptionChanges(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg focus:outline-none focus:ring-1 focus:ring-ws-accent resize-none"
                                    placeholder="Optional description"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                    Confirmation Message
                                </label>
                                <textarea
                                    value={confirmationMessage}
                                    onChange={(e) => setConfirmationChanges(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg focus:outline-none focus:ring-1 focus:ring-ws-accent resize-none"
                                    placeholder="Message shown after submission (default: 'Response Submitted!')"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                    Status
                                </label>
                                <select
                                    value={status ?? 'active'}
                                    onChange={(e) => setStatusChanges(e.target.value as 'active' | 'draft')}
                                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg focus:outline-none focus:ring-1 focus:ring-ws-accent"
                                    disabled={poll.status === 'closed'}
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                {poll.status === 'closed' && (
                                    <p className="text-xs text-ws-text-disabled mt-1">
                                        This poll is closed and cannot be edited
                                    </p>
                                )}
                            </div>
                        </section>

                        {/* Time Configuration */}
                        <section className="bg-ws-panel-bg rounded-lg border border-ws-panel-border p-4 space-y-4">
                            <h2 className="text-sm font-semibold text-ws-fg">Time Configuration</h2>

                            <div>
                                <label className="block text-xs font-medium text-ws-text-secondary mb-2">
                                    Dates
                                </label>
                                <MiniCalendar
                                    selectedDates={timeConfig?.dates ?? []}
                                    onDatesChange={(dates) =>
                                        setTimeConfigChanges({
                                            ...(timeConfig ?? { dates: [], start_hour: 9, end_hour: 17, granularity: '30min' as const, timezone: 'America/Vancouver' }),
                                            dates,
                                        })
                                    }
                                />
                                {timeConfig?.dates && timeConfig.dates.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {timeConfig.dates.map((date) => (
                                            <span
                                                key={date}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-ws-bg border border-ws-panel-border rounded"
                                            >
                                                {new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                                <button
                                                    onClick={() => handleDateRemove(date)}
                                                    className="text-ws-text-secondary hover:text-ws-error"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                        Start Hour
                                    </label>
                                    <select
                                        value={timeConfig?.start_hour ?? 9}
                                        onChange={(e) =>
                                            setTimeConfigChanges({
                                                ...(timeConfig ?? { dates: [], start_hour: 9, end_hour: 17, granularity: '30min' as const, timezone: 'America/Vancouver' }),
                                                start_hour: parseInt(e.target.value),
                                            })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>
                                                {i.toString().padStart(2, '0')}:00
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                        End Hour
                                    </label>
                                    <select
                                        value={timeConfig?.end_hour ?? 17}
                                        onChange={(e) =>
                                            setTimeConfigChanges({
                                                ...(timeConfig ?? { dates: [], start_hour: 9, end_hour: 17, granularity: '30min' as const, timezone: 'America/Vancouver' }),
                                                end_hour: parseInt(e.target.value),
                                            })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>
                                                {i.toString().padStart(2, '0')}:00
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                        Meeting Duration
                                    </label>
                                    <select
                                        value={timeConfig?.granularity ?? '30min'}
                                        onChange={(e) =>
                                            setTimeConfigChanges({
                                                ...(timeConfig ?? { dates: [], start_hour: 9, end_hour: 17, granularity: '30min' as const, timezone: 'America/Vancouver' }),
                                                granularity: e.target.value as '15min' | '30min' | '60min',
                                            })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg"
                                    >
                                        {DURATION_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                        Timezone
                                    </label>
                                    <select
                                        value={timeConfig?.timezone ?? 'America/Vancouver'}
                                        onChange={(e) =>
                                            setTimeConfigChanges({
                                                ...(timeConfig ?? { dates: [], start_hour: 9, end_hour: 17, granularity: '30min' as const, timezone: 'America/Vancouver' }),
                                                timezone: e.target.value,
                                            })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-bg"
                                    >
                                        {COMMON_TIMEZONES.map((tz) => (
                                            <option key={tz} value={tz}>
                                                {tz.replace('_', ' ')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* Danger Zone */}
                        <section className="bg-ws-panel-bg rounded-lg border border-ws-error/20 p-4">
                            <h2 className="text-sm font-semibold text-ws-error mb-2">Danger Zone</h2>
                            <p className="text-xs text-ws-text-secondary mb-3">
                                Deleting a poll will also remove all responses.
                            </p>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Poll
                            </Button>
                        </section>
                    </div>
                )}

                {activeTab === 'results' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {resultsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-ws-info" />
                            </div>
                        ) : resultsData ? (
                            <>
                                {/* Summary */}
                                <section className="bg-ws-panel-bg rounded-lg border border-ws-panel-border p-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-ws-text-secondary">Total Responses</p>
                                            <p className="text-2xl font-semibold text-ws-fg">
                                                {resultsData.totalResponses}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-ws-text-secondary">Best Slots</p>
                                            <p className="text-sm text-ws-fg">
                                                {resultsData.bestSlots.length > 0
                                                    ? resultsData.bestSlots.slice(0, 3).join(', ')
                                                    : 'No responses yet'}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {/* Slot Counts */}
                                {Object.keys(resultsData.slotCounts).length > 0 && (
                                    <section className="bg-ws-panel-bg rounded-lg border border-ws-panel-border p-4">
                                        <h2 className="text-sm font-semibold text-ws-fg mb-4">
                                            Availability by Slot
                                        </h2>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {Object.entries(resultsData.slotCounts)
                                                .sort(([, a], [, b]) => b - a)
                                                .map(([slot, count]) => {
                                                    const isBest = resultsData.bestSlots.includes(slot);
                                                    const maxCount = Math.max(...Object.values(resultsData.slotCounts));
                                                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

                                                    return (
                                                        <div key={slot} className="flex items-center gap-2">
                                                            <span className={`text-xs w-28 ${isBest ? 'font-semibold text-ws-success' : 'text-ws-text-secondary'}`}>
                                                                {slot}
                                                            </span>
                                                            <div className="flex-1 h-4 bg-ws-bg rounded overflow-hidden">
                                                                <div
                                                                    className={`h-full ${isBest ? 'bg-ws-success' : 'bg-ws-accent'}`}
                                                                    style={{ width: `${percentage}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-ws-text-secondary w-8 text-right">
                                                                {count}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </section>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12 text-ws-text-secondary">
                                Unable to load results
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-ws-panel-bg rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
                        <h2 className="text-lg font-semibold text-ws-fg mb-2">Delete Poll?</h2>
                        <p className="text-sm text-ws-text-secondary mb-4">
                            This will permanently delete the poll and all {resultsData?.totalResponses ?? 0} responses.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleDelete}
                                disabled={deletePoll.isPending}
                            >
                                {deletePoll.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    'Delete'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
