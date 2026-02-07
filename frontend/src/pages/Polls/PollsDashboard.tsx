/**
 * PollsDashboard - List of polls with create and close actions
 */

import { Plus, BarChart3, Loader2, ExternalLink, XCircle, Pencil, Copy, Trash2 } from 'lucide-react';

import { Button } from '@autoart/ui';
import { usePolls, useCreatePoll, useClosePoll, useDuplicatePoll, useDeletePoll } from '../../api/hooks/polls';
import { type } from '../../ui/typography';
import type { Poll, PollStatus } from '@autoart/shared';

interface PollsDashboardProps {
    onOpenPoll?: (pollId: string) => void;
}

const STATUS_DOT: Record<PollStatus, string> = {
    active: 'bg-ws-success',
    closed: 'bg-ws-text-disabled',
    draft: 'bg-ws-warning',
};

const STATUS_LABEL: Record<PollStatus, string> = {
    active: 'Active',
    closed: 'Closed',
    draft: 'Draft',
};

/** Format a Date to YYYY-MM-DD using local time (avoids UTC date shift). */
function formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function defaultTimeConfig() {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(formatLocalDate(d));
    }
    return {
        dates,
        start_hour: 9,
        end_hour: 17,
        granularity: '30min' as const,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}

const POLL_APP_URL = import.meta.env.VITE_POLL_APP_URL || 'https://poll.autoart.work';

export function PollsDashboard({ onOpenPoll }: PollsDashboardProps) {
    const { data: polls, isLoading } = usePolls();
    const createPoll = useCreatePoll();
    const closePoll = useClosePoll();
    const duplicatePoll = useDuplicatePoll();
    const deletePoll = useDeletePoll();

    const handleCreate = async () => {
        try {
            const result = await createPoll.mutateAsync({
                title: 'Untitled Poll',
                time_config: defaultTimeConfig(),
            });
            // Open the newly created poll in editor
            if (onOpenPoll && result.poll) {
                onOpenPoll(result.poll.id);
            }
        } catch (err) {
            console.error('Failed to create poll:', err);
        }
    };

    const handleClose = async (e: React.SyntheticEvent, pollId: string) => {
        e.stopPropagation();
        try {
            await closePoll.mutateAsync(pollId);
        } catch (err) {
            console.error('Failed to close poll:', err);
        }
    };

    const handleDuplicate = async (e: React.SyntheticEvent, pollId: string) => {
        e.stopPropagation();
        try {
            const result = await duplicatePoll.mutateAsync({ id: pollId });
            // Open the duplicated poll in editor
            if (onOpenPoll && result.poll) {
                onOpenPoll(result.poll.id);
            }
        } catch (err) {
            console.error('Failed to duplicate poll:', err);
        }
    };

    const handleDelete = async (e: React.SyntheticEvent, pollId: string) => {
        e.stopPropagation();
        if (!confirm('Delete this poll and all its responses?')) return;
        try {
            await deletePoll.mutateAsync(pollId);
        } catch (err) {
            console.error('Failed to delete poll:', err);
        }
    };

    const handleCardClick = (poll: Poll) => {
        if (onOpenPoll) {
            onOpenPoll(poll.id);
        } else {
            // Fallback: open public poll in new tab
            window.open(`${POLL_APP_URL}/${poll.unique_id}`, '_blank', 'noopener,noreferrer');
        }
    };

    const handleOpenPublic = (e: React.SyntheticEvent, poll: Poll) => {
        e.stopPropagation();
        window.open(`${POLL_APP_URL}/${poll.unique_id}`, '_blank', 'noopener,noreferrer');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-ws-info" />
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className={type.h1}>Polls</h1>
                    <p className={`${type.bodySecondary} mt-1`}>
                        Availability polls for scheduling across participants
                    </p>
                </div>
                <Button
                    onClick={handleCreate}
                    disabled={createPoll.isPending}
                    className="hidden md:flex items-center gap-2"
                >
                    {createPoll.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    New Poll
                </Button>
            </div>

            {/* Poll Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {polls?.map((poll) => (
                    <div
                        key={poll.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleCardClick(poll)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(poll); } }}
                        className="bg-white rounded-xl border border-ws-border p-6 text-left hover:border-ws-accent hover:shadow-sm transition-all group cursor-pointer"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[rgba(63,92,110,0.08)] flex items-center justify-center text-ws-info group-hover:bg-ws-accent group-hover:text-white transition-colors">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-ws-fg truncate">{poll.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[poll.status]}`} />
                                    <span className={type.bodySecondary}>{STATUS_LABEL[poll.status]}</span>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <p className={type.metadata}>
                                        {new Date(poll.created_at).toLocaleDateString()}
                                    </p>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {poll.status !== 'closed' && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onOpenPoll?.(poll.id); }}
                                                className="p-1 rounded text-ws-text-secondary hover:bg-black/5 transition-colors"
                                                title="Edit poll"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => handleDuplicate(e, poll.id)}
                                            className="p-1 rounded text-ws-text-secondary hover:bg-black/5 transition-colors"
                                            title="Duplicate poll"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleOpenPublic(e, poll)}
                                            className="p-1 rounded text-ws-text-secondary hover:bg-black/5 transition-colors"
                                            title="Open public poll"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        {poll.status === 'active' && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleClose(e, poll.id)}
                                                className="p-1 rounded text-ws-warning hover:bg-[rgba(184,155,94,0.08)] transition-colors"
                                                title="Close poll"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => handleDelete(e, poll.id)}
                                            className="p-1 rounded text-ws-error hover:bg-[rgba(140,74,74,0.08)] transition-colors"
                                            title="Delete poll"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {polls?.length === 0 && (
                    <p className={type.bodySecondary}>No polls created</p>
                )}

                {/* New Poll card */}
                <button
                    onClick={handleCreate}
                    disabled={createPoll.isPending}
                    className="bg-ws-bg rounded-xl border-2 border-dashed border-ws-border p-6 hover:border-ws-accent hover:bg-[rgba(63,92,110,0.04)] transition-all flex flex-col items-center justify-center min-h-[140px]"
                >
                    <Plus className="w-8 h-8 text-ws-text-disabled mb-2" />
                    <span className={`text-sm font-medium text-ws-text-secondary`}>New Poll</span>
                </button>
            </div>
        </div>
    );
}
