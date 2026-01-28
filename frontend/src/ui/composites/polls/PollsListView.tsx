import { useCallback } from 'react';
import { Plus, ExternalLink } from 'lucide-react';
import { Button, Text, Badge, Spinner, Stack, Inline } from '@autoart/ui';
import { usePolls } from '../../../api/hooks/polls';
import type { Poll } from '@autoart/shared';

const POLL_BASE_URL = import.meta.env.VITE_POLL_BASE_URL || 'https://poll.autoart.work';

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function StatusBadge({ status }: { status: Poll['status'] }) {
    const variant = status === 'active' ? 'success' : status === 'closed' ? 'neutral' : 'warning';
    return <Badge variant={variant} size="sm">{status}</Badge>;
}

interface PollsListViewProps {
    onCreatePoll: () => void;
    onSelectPoll: (poll: Poll) => void;
}

export function PollsListView({ onCreatePoll, onSelectPoll }: PollsListViewProps) {
    const { data: polls, isLoading, isError, error } = usePolls();

    const handleShareLink = useCallback((e: React.MouseEvent, uniqueId: string) => {
        e.stopPropagation();
        const url = `${POLL_BASE_URL}/${uniqueId}`;
        navigator.clipboard.writeText(url);
    }, []);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex h-full items-center justify-center">
                <Text color="error">{error instanceof Error ? error.message : 'Failed to load polls'}</Text>
            </div>
        );
    }

    return (
        <Stack gap="none" className="h-full">
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--ws-group-border)] px-4 py-3">
                <Inline justify="between" align="center">
                    <Text size="lg" weight="semibold">Polls</Text>
                    <Button
                        variant="primary"
                        size="sm"
                        leftSection={<Plus size={14} />}
                        onClick={onCreatePoll}
                    >
                        New Poll
                    </Button>
                </Inline>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {!polls || polls.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                        <Stack align="center" gap="sm">
                            <Text color="dimmed">No polls yet</Text>
                            <Button variant="secondary" size="sm" onClick={onCreatePoll}>
                                Create your first poll
                            </Button>
                        </Stack>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--ws-group-border)]">
                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ws-text-secondary)] uppercase tracking-wider">
                                    Title
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ws-text-secondary)] uppercase tracking-wider w-24">
                                    Status
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ws-text-secondary)] uppercase tracking-wider w-32">
                                    Created
                                </th>
                                <th className="px-4 py-2 w-12" />
                            </tr>
                        </thead>
                        <tbody>
                            {polls.map((poll) => (
                                <tr
                                    key={poll.id}
                                    onClick={() => onSelectPoll(poll)}
                                    className="border-b border-[var(--ws-group-border)] cursor-pointer hover:bg-[var(--ws-row-expanded-bg)] transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <Text weight="medium">{poll.title}</Text>
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={poll.status} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Text size="sm" color="dimmed">{formatDate(poll.created_at)}</Text>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={(e) => handleShareLink(e, poll.unique_id)}
                                            className="p-1.5 text-[var(--ws-text-secondary)] hover:text-[var(--ws-accent)] rounded transition-colors"
                                            title="Copy share link"
                                        >
                                            <ExternalLink size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </Stack>
    );
}
