import { useMemo } from 'react';
import { ArrowLeft, Link2 } from 'lucide-react';
import { Button, Card, Stack, Inline, Text, Badge, Spinner } from '@autoart/ui';
import { usePoll, usePollResults, useClosePoll, usePollEngagements } from '../../../api/hooks/polls';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { formatDateShort, formatTime } from '@autoart/shared';
import { TimeGrid } from '../../../poll/components/TimeGrid';
import type { Poll } from '@autoart/shared';
import { POLL_BASE_URL } from './constants';

interface PollDetailViewProps {
    poll: Poll;
    onBack: () => void;
}

export function PollDetailView({ poll: initialPoll, onBack }: PollDetailViewProps) {
    const { data: pollData, isLoading: pollLoading, error: pollError } = usePoll(initialPoll.id);
    const { data: results, isLoading: resultsLoading, error: resultsError } = usePollResults(initialPoll.unique_id);
    const closeMutation = useClosePoll();
    const { data: engagements } = usePollEngagements(initialPoll.id);
    const { formatDate, dateFormat, timezone } = useDateFormat();
    const { copied: linkCopied, copyToClipboard } = useCopyToClipboard();

    const poll = pollData ?? initialPoll;
    const isLoading = pollLoading || resultsLoading;

    const heatmapData = useMemo(() => {
        if (!results?.slotCounts) return undefined;
        return new Map<string, number>(Object.entries(results.slotCounts));
    }, [results]);

    const responseCount = results?.totalResponses ?? 0;
    const pollUrl = `${POLL_BASE_URL}/${poll.unique_id}`;

    const handleCopyLink = () => {
        copyToClipboard(pollUrl);
    };

    return (
        <Stack gap="none" className="h-full">
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--ws-group-border)] px-4 py-3">
                <Inline justify="between" align="center">
                    <Inline align="center" gap="sm">
                        <button
                            onClick={onBack}
                            className="p-1 rounded hover:bg-[var(--ws-row-expanded-bg)] transition-colors"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <Text size="lg" weight="semibold">{poll.title}</Text>
                        <Badge
                            variant={poll.status === 'active' ? 'success' : 'neutral'}
                            size="sm"
                        >
                            {poll.status}
                        </Badge>
                    </Inline>
                    <Inline gap="sm">
                        <Button
                            variant="ghost"
                            size="sm"
                            leftSection={<Link2 size={14} />}
                            onClick={handleCopyLink}
                        >
                            {linkCopied ? 'Copied!' : 'Copy Link'}
                        </Button>
                        {poll.status === 'active' && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    if (window.confirm('Are you sure? Participants will no longer be able to respond.')) {
                                        closeMutation.mutate(poll.id);
                                    }
                                }}
                                disabled={closeMutation.isPending}
                            >
                                {closeMutation.isPending ? 'Closing...' : 'Close Poll'}
                            </Button>
                        )}
                    </Inline>
                </Inline>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 py-4">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Spinner size="lg" />
                    </div>
                ) : (pollError || resultsError) ? (
                    <div className="flex h-full items-center justify-center">
                        <Card padding="lg">
                            <Stack align="center" gap="md">
                                <Text weight="semibold" color="error">Failed to load poll data</Text>
                                <Text size="sm" color="dimmed">
                                    {(pollError ?? resultsError) instanceof Error
                                        ? (pollError ?? resultsError)!.message
                                        : 'An unexpected error occurred'}
                                </Text>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => window.location.reload()}
                                >
                                    Retry
                                </Button>
                            </Stack>
                        </Card>
                    </div>
                ) : (
                    <Stack gap="lg" className="max-w-4xl">
                        {/* Metadata */}
                        <Card padding="md">
                            <Stack gap="sm">
                                {poll.description && (
                                    <Text color="dimmed">{poll.description}</Text>
                                )}
                                <Inline gap="lg">
                                    <Text size="sm" color="dimmed">
                                        Created {formatDate(poll.created_at)}
                                    </Text>
                                    <Text size="sm" color="dimmed">
                                        {responseCount} {responseCount === 1 ? 'response' : 'responses'}
                                    </Text>
                                </Inline>
                            </Stack>
                        </Card>

                        {/* Engagement */}
                        {engagements && (
                            <Card padding="md">
                                <Stack gap="sm">
                                    <Text weight="semibold">Engagement</Text>
                                    <Inline gap="lg">
                                        <Text size="sm">
                                            <span style={{ color: 'var(--ws-color-info)' }}>
                                                {engagements.total_opened}
                                            </span>
                                            {' '}opened
                                        </Text>
                                        <Text size="sm">
                                            <span style={{ color: 'var(--ws-color-success)' }}>
                                                {engagements.total_interacted}
                                            </span>
                                            {' '}interacted
                                        </Text>
                                        <Text size="sm">
                                            <span style={{ color: 'var(--ws-color-warning)' }}>
                                                {engagements.total_deferred}
                                            </span>
                                            {' '}left
                                        </Text>
                                        <Text size="sm">
                                            <span style={{ color: 'var(--ws-fg)' }}>
                                                {engagements.unique_actors}
                                            </span>
                                            {' '}unique visitors
                                        </Text>
                                    </Inline>
                                </Stack>
                            </Card>
                        )}

                        {/* Best Times */}
                        {results && results.bestSlots.length > 0 && (
                            <Card padding="md">
                                <Stack gap="sm">
                                    <Text weight="semibold">Best Times</Text>
                                    <Inline gap="sm" wrap>
                                        {results.bestSlots.map((slot) => {
                                            const parts = slot.split(':');
                                            if (parts.length >= 3) {
                                                const [date, hour, minute] = parts;
                                                const hourNum = parseInt(hour, 10);
                                                const minuteNum = parseInt(minute, 10);
                                                if (!isNaN(hourNum) && !isNaN(minuteNum) && hourNum >= 0 && hourNum <= 23 && minuteNum >= 0 && minuteNum <= 59) {
                                                    const dateConfig = { dateFormat, timezone: poll.time_config.timezone ?? timezone };
                                                    const dayStr = formatDateShort(date, dateConfig);
                                                    const timeStr = formatTime(hourNum, minuteNum, dateConfig);
                                                    return (
                                                        <Badge key={slot} variant="success" size="md">
                                                            {dayStr} @ {timeStr}
                                                        </Badge>
                                                    );
                                                }
                                            }
                                            return (
                                                <Badge key={slot} variant="success" size="md">
                                                    {slot}
                                                </Badge>
                                            );
                                        })}
                                    </Inline>
                                </Stack>
                            </Card>
                        )}

                        {/* Heatmap */}
                        <Card padding="md">
                            <Stack gap="md">
                                <Text weight="semibold">Availability Heatmap</Text>
                                <TimeGrid
                                    dates={poll.time_config.dates}
                                    startHour={poll.time_config.start_hour}
                                    endHour={poll.time_config.end_hour}
                                    granularity={poll.time_config.granularity}
                                    readOnly
                                    heatmapData={heatmapData}
                                    maxCount={responseCount}
                                    selectedSlots={new Set()}
                                    onSlotsChange={() => {}}
                                    dateFormatConfig={{ dateFormat, timezone: poll.time_config.timezone ?? timezone }}
                                />
                            </Stack>
                        </Card>

                        {/* Participants */}
                        {pollData?.responses && pollData.responses.length > 0 && (
                            <Card padding="md">
                                <Stack gap="sm">
                                    <Text weight="semibold">Participants</Text>
                                    <Inline gap="sm" wrap>
                                        {pollData.responses.map((r) => (
                                            <Badge key={r.id} variant="neutral" size="md">
                                                {r.participant_name}
                                            </Badge>
                                        ))}
                                    </Inline>
                                </Stack>
                            </Card>
                        )}
                    </Stack>
                )}
            </div>
        </Stack>
    );
}
