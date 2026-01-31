/**
 * PollsDashboard - List of polls with create and close actions
 */

import { Plus, BarChart3, Loader2, ExternalLink, XCircle } from 'lucide-react';

import { Button } from '@autoart/ui';
import { usePolls, useCreatePoll, useClosePoll } from '../../api/hooks/polls';
import type { Poll, PollStatus } from '@autoart/shared';

const STATUS_DOT: Record<PollStatus, string> = {
    active: 'bg-[#6F7F5C]',   // Moss Green
    closed: 'bg-[#8C8C88]',   // Disabled gray
    draft: 'bg-[#B89B5E]',    // Desaturated Amber
};

const STATUS_LABEL: Record<PollStatus, string> = {
    active: 'Active',
    closed: 'Closed',
    draft: 'Draft',
};

function defaultTimeConfig() {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return {
        dates,
        start_hour: 9,
        end_hour: 17,
        granularity: '30min' as const,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}

export function PollsDashboard() {
    const { data: polls, isLoading } = usePolls();
    const createPoll = useCreatePoll();
    const closePoll = useClosePoll();

    const handleCreate = async () => {
        try {
            await createPoll.mutateAsync({
                title: 'Untitled Poll',
                time_config: defaultTimeConfig(),
            });
        } catch (err) {
            console.error('Failed to create poll:', err);
        }
    };

    const handleClose = async (e: React.MouseEvent, pollId: string) => {
        e.stopPropagation();
        try {
            await closePoll.mutateAsync(pollId);
        } catch (err) {
            console.error('Failed to close poll:', err);
        }
    };

    const handleOpenPublic = (poll: Poll) => {
        window.open(`/public/poll/${poll.unique_id}`, '_blank');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#3F5C6E]" />
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-xl font-semibold text-[#2E2E2C]">Polls</h1>
                    <p className="text-sm text-[#5A5A57] mt-1">
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
                    <button
                        key={poll.id}
                        onClick={() => handleOpenPublic(poll)}
                        className="bg-white rounded-xl border border-[#D6D2CB] p-6 text-left hover:border-[#3F5C6E] hover:shadow-sm transition-all group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[rgba(63,92,110,0.08)] flex items-center justify-center text-[#3F5C6E] group-hover:bg-[#3F5C6E] group-hover:text-white transition-colors">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-[#2E2E2C] truncate">{poll.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[poll.status]}`} />
                                    <span className="text-sm text-[#5A5A57]">{STATUS_LABEL[poll.status]}</span>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-xs text-[#8C8C88]">
                                        {new Date(poll.created_at).toLocaleDateString()}
                                    </p>
                                    <div className="flex items-center gap-1">
                                        {poll.status === 'active' && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => handleClose(e, poll.id)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleClose(e as any, poll.id); }}
                                                className="p-1 rounded text-[#8C4A4A] hover:bg-[rgba(140,74,74,0.08)] transition-colors"
                                                title="Close poll"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </span>
                                        )}
                                        <span className="p-1 rounded text-[#5A5A57] hover:bg-black/5 transition-colors">
                                            <ExternalLink className="w-4 h-4" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </button>
                ))}

                {/* New Poll card */}
                <button
                    onClick={handleCreate}
                    disabled={createPoll.isPending}
                    className="bg-[#F5F2ED] rounded-xl border-2 border-dashed border-[#D6D2CB] p-6 hover:border-[#3F5C6E] hover:bg-[rgba(63,92,110,0.04)] transition-all flex flex-col items-center justify-center min-h-[140px]"
                >
                    <Plus className="w-8 h-8 text-[#8C8C88] mb-2" />
                    <span className="text-sm font-medium text-[#5A5A57]">New Poll</span>
                </button>
            </div>
        </div>
    );
}
