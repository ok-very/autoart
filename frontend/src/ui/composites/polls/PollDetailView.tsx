import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Stack, Inline, Text, Badge, Spinner } from '@autoart/ui';
import { usePoll, usePollResults, useClosePoll } from '../../../api/hooks/polls';
import { TimeGrid } from '../../../poll/components/TimeGrid';
import type { Poll } from '@autoart/shared';

const POLL_BASE_URL = import.meta.env.VITE_POLL_BASE_URL || 'https://poll.autoart.work';

interface PollDetailViewProps {
    poll: Poll;
    onBack: () => void;
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

export function PollDetailView({ poll: initialPoll, onBack }: PollDetailViewProps) {
    const { data: pollData, isLoading: pollLoading } = usePoll(initialPoll.id);
    const { data: results, isLoading: resultsLoading } = usePollResults(initialPoll.unique_id);
    const closeMutation = useClosePoll();

    const poll = pollData ?? initialPoll;
    const isLoading = pollLoading || resultsLoading;

    const heatmapData = useMemo(() => {
        if (!results?.slotCounts) return undefined;
        return new Map<string, number>(Object.entries(results.slotCounts));
    }, [results]);

    const responseCount = results?.totalResponses ?? 0;

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
                        {poll.status === 'active' && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => closeMutation.mutate(poll.id)}
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
                                <Text size="sm" color="dimmed">
                                    Share: {POLL_BASE_URL}/{poll.unique_id}
                                </Text>
                            </Stack>
                        </Card>

                        {/* Best Times */}
                        {results && results.bestSlots.length > 0 && (
                            <Card padding="md">
                                <Stack gap="sm">
                                    <Text weight="semibold">Best Times</Text>
                                    <Inline gap="sm" wrap>
                                        {results.bestSlots.map((slot) => (
                                            <Badge key={slot} variant="success" size="md">
                                                {slot}
                                            </Badge>
                                        ))}
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
