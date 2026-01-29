import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { Button, Card, Stack, Inline, Text, Badge, Spinner } from '@autoart/ui';
import {
  formatDateShort,
  formatTime,
  buildPollDateConfig,
  type DateFormatConfig,
} from '@autoart/shared';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { fetchPoll, fetchResults } from '../api';
import { TimeGrid } from './TimeGrid';

export function ResultsPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const { copied: linkCopied, copyToClipboard } = useCopyToClipboard();

  const {
    data: poll,
    isLoading: pollLoading,
    error: pollError,
  } = useQuery({
    queryKey: ['poll', uniqueId],
    queryFn: () => fetchPoll(uniqueId!),
    enabled: !!uniqueId,
  });

  const {
    data: results,
    isLoading: resultsLoading,
    error: resultsError,
  } = useQuery({
    queryKey: ['poll-results', uniqueId],
    queryFn: () => fetchResults(uniqueId!),
    enabled: !!uniqueId,
  });

  const isLoading = pollLoading || resultsLoading;
  const error = pollError || resultsError;

  const dateConfig: DateFormatConfig = useMemo(
    () => buildPollDateConfig(poll),
    [poll?.time_config?.timezone],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ws-bg">
        <Stack align="center" gap="md">
          <Spinner size="lg" />
          <Text color="dimmed">Loading results...</Text>
        </Stack>
      </div>
    );
  }

  if (error || !poll || !results) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ws-bg p-4">
        <Card shadow="md" padding="lg">
          <Stack align="center" gap="md">
            <Text size="xl" weight="bold">Poll Not Found</Text>
            <Text color="dimmed">
              This poll may have been deleted or doesn't exist.
            </Text>
          </Stack>
        </Card>
      </div>
    );
  }

  const heatmapData = new Map<string, number>(Object.entries(results.slotCounts));

  return (
    <div className="min-h-screen bg-ws-bg px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Card shadow="sm" padding="lg">
          <Stack gap="lg">
            {/* Header */}
            <Inline justify="between" align="start">
              <div>
                <Text size="xl" weight="bold" className="block text-ws-fg">{poll.title}</Text>
                {poll.description && (
                  <Text color="dimmed" className="mt-1 block">{poll.description}</Text>
                )}
                <Text size="sm" color="muted" className="mt-2 block">
                  {results.totalResponses} {results.totalResponses === 1 ? 'response' : 'responses'}
                </Text>
              </div>
              <Button
                variant="ghost"
                size="sm"
                leftSection={<Link2 size={14} />}
                onClick={() => {
                  const pollUrl = window.location.href.replace(/\/results$/, '');
                  copyToClipboard(pollUrl);
                }}
              >
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
            </Inline>

            {/* Best Times */}
            {results.bestSlots.length > 0 && (
              <div className="rounded-lg bg-heatmap-25 p-4">
                <Text weight="semibold" className="mb-2 block text-heatmap-100">Best Times</Text>
                <Inline gap="sm">
                  {results.bestSlots.map((slot) => {
                    const parts = slot.split(':');
                    if (parts.length < 3) {
                      return (
                        <Badge key={slot} variant="success" size="md">
                          {slot}
                        </Badge>
                      );
                    }
                    const [date, hour, minute] = parts;
                    const hourNum = parseInt(hour, 10);
                    const minuteNum = parseInt(minute, 10);
                    if (isNaN(hourNum) || isNaN(minuteNum) || hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
                      return (
                        <Badge key={slot} variant="success" size="md">
                          {slot}
                        </Badge>
                      );
                    }
                    const dayStr = formatDateShort(date, dateConfig);
                    const timeStr = formatTime(hourNum, minuteNum, dateConfig);
                    return (
                      <Badge key={slot} variant="success" size="md">
                        {dayStr} @ {timeStr}
                      </Badge>
                    );
                  })}
                </Inline>
              </div>
            )}

            {/* Availability Heatmap */}
            <div>
              <Text weight="semibold" className="mb-3 block text-ws-fg">Availability Heatmap</Text>
              <TimeGrid
                dates={poll.time_config.dates}
                startHour={poll.time_config.start_hour}
                endHour={poll.time_config.end_hour}
                granularity={poll.time_config.granularity}
                readOnly={true}
                heatmapData={heatmapData}
                maxCount={results.totalResponses}
                selectedSlots={new Set()}
                onSlotsChange={() => {}}
                dateFormatConfig={dateConfig}
              />
              <Inline gap="md" className="mt-2">
                <Text size="xs" color="muted">Less available</Text>
                <Inline gap="xs">
                  <div className="h-4 w-4 rounded bg-heatmap-0" />
                  <div className="h-4 w-4 rounded bg-heatmap-25" />
                  <div className="h-4 w-4 rounded bg-heatmap-50" />
                  <div className="h-4 w-4 rounded bg-heatmap-75" />
                  <div className="h-4 w-4 rounded bg-heatmap-100" />
                </Inline>
                <Text size="xs" color="muted">More available</Text>
              </Inline>
            </div>

            {/* Participants */}
            {poll.responses.length > 0 && (
              <div>
                <Text weight="semibold" className="mb-3 block text-ws-fg">Participants</Text>
                <Inline gap="sm">
                  {poll.responses.map((response) => (
                    <Badge key={response.id} variant="neutral" size="md">
                      {response.participant_name}
                    </Badge>
                  ))}
                </Inline>
              </div>
            )}

            {/* Back Link */}
            <div className="border-t border-ws-border pt-4">
              <Link
                to={`/${uniqueId}`}
                className="text-sm text-ws-accent hover:underline"
              >
                &larr; Submit your availability
              </Link>
            </div>
          </Stack>
        </Card>
      </div>
    </div>
  );
}
