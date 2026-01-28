import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, TextInput, Card, Stack, Inline, Text, Alert, Spinner } from '@autoart/ui';
import { EngagementKind } from '@autoart/shared';
import { fetchPoll, submitResponse, updateResponse, logEngagement } from '../api';
import { TimeGrid } from './TimeGrid';

const STORAGE_KEY = 'poll_participant_name';

export function PollPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const queryClient = useQueryClient();

  // Use lazy initializer to read from localStorage (runs only on mount)
  const [name, setName] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [email, setEmail] = useState('');
  const [userSelectedSlots, setUserSelectedSlots] = useState<Set<string> | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Engagement tracking state
  const hasLoggedOpened = useRef(false);
  const hasLoggedInteracted = useRef(false);
  const hasSaved = useRef(false);

  // Refs to store latest values for unmount cleanup (avoids stale closure)
  const latestNameRef = useRef<string | undefined>(name || undefined);
  const latestSlotsCountRef = useRef<number>(userSelectedSlots?.size ?? 0);

  const {
    data: poll,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['poll', uniqueId],
    queryFn: () => fetchPoll(uniqueId!),
    enabled: !!uniqueId,
  });

  // Keep refs in sync with state
  useEffect(() => {
    latestNameRef.current = name || undefined;
  }, [name]);

  useEffect(() => {
    latestSlotsCountRef.current = userSelectedSlots?.size ?? 0;
  }, [userSelectedSlots]);

  // Log OPENED on mount
  useEffect(() => {
    if (uniqueId && !hasLoggedOpened.current) {
      hasLoggedOpened.current = true;
      logEngagement(uniqueId, EngagementKind.OPENED);
    }
  }, [uniqueId]);

  // Log DEFERRED on unmount only if interacted but not saved
  useEffect(() => {
    const currentUniqueId = uniqueId;
    return () => {
      if (currentUniqueId && hasLoggedInteracted.current && !hasSaved.current) {
        logEngagement(currentUniqueId, EngagementKind.DEFERRED, latestNameRef.current, {
          progress: { slots_selected: latestSlotsCountRef.current },
        });
      }
    };
  }, [uniqueId]);

  const handleInteraction = useCallback(() => {
    if (uniqueId && !hasLoggedInteracted.current) {
      hasLoggedInteracted.current = true;
      logEngagement(uniqueId, EngagementKind.INTERACTED, name || undefined, {
        interactionType: 'input',
      });
    }
  }, [uniqueId, name]);

  const existingResponse = useMemo(() => {
    if (!poll || !name) return null;
    return poll.responses.find(
      (r) => r.participant_name.toLowerCase() === name.toLowerCase()
    );
  }, [poll, name]);

  const isUpdate = !!existingResponse;

  // Derive selectedSlots from user selection or existing response
  const selectedSlots = useMemo(() => {
    if (userSelectedSlots !== null) return userSelectedSlots;
    if (existingResponse) return new Set(existingResponse.available_slots);
    return new Set<string>();
  }, [userSelectedSlots, existingResponse]);

  // Wrapper to track user selections
  const setSelectedSlots = useCallback((value: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof value === 'function') {
      // Use selectedSlots (derived from existingResponse) as fallback
      setUserSelectedSlots(prev => value(prev ?? selectedSlots));
    } else {
      setUserSelectedSlots(value);
    }
  }, [selectedSlots]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!uniqueId) throw new Error('Poll ID is missing');
      return submitResponse(uniqueId, name, Array.from(selectedSlots), email || undefined);
    },
    onSuccess: () => {
      localStorage.setItem(STORAGE_KEY, name);
      queryClient.invalidateQueries({ queryKey: ['poll', uniqueId] });
      hasSaved.current = true;
      setSubmitted(true);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!uniqueId) throw new Error('Poll ID is missing');
      return updateResponse(uniqueId, name, Array.from(selectedSlots));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll', uniqueId] });
      hasSaved.current = true;
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdate) {
      updateMutation.mutate();
    } else {
      submitMutation.mutate();
    }
  };

  const isPending = submitMutation.isPending || updateMutation.isPending;
  const mutationError = submitMutation.error || updateMutation.error;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2ED]">
        <Stack align="center" gap="md">
          <Spinner size="lg" />
          <Text color="dimmed">Loading poll...</Text>
        </Stack>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2ED] p-4">
        <Card shadow="md" padding="lg">
          <Stack align="center" gap="md">
            <Text size="xl" weight="bold">Poll Not Found</Text>
            <Text color="dimmed">
              {error instanceof Error ? error.message : 'This poll may have been closed or deleted.'}
            </Text>
          </Stack>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2ED] p-4">
        <Card shadow="md" padding="lg" className="max-w-md text-center">
          <Stack align="center" gap="md">
            <div className="text-4xl text-[#6F7F5C]">&#10003;</div>
            <Text size="xl" weight="bold">
              {isUpdate ? 'Response Updated!' : 'Response Submitted!'}
            </Text>
            <Text color="dimmed">
              Your availability has been {isUpdate ? 'updated' : 'recorded'} for "{poll.title}".
            </Text>
            <Inline gap="sm">
              <Button
                variant="secondary"
                onClick={() => setSubmitted(false)}
              >
                Edit Response
              </Button>
              <Button
                variant="primary"
                onClick={() => window.location.href = `/${uniqueId}/results`}
              >
                View Results
              </Button>
            </Inline>
          </Stack>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] p-4">
      <div className="mx-auto max-w-4xl">
        <Card shadow="sm" padding="lg" className="mb-6">
          <Text size="xl" weight="bold" className="mb-2 block text-[#2E2E2C]">{poll.title}</Text>
          {poll.description && <Text color="dimmed">{poll.description}</Text>}
        </Card>

        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <Card shadow="sm" padding="lg">
              <Text size="lg" weight="semibold" className="mb-4 block text-[#2E2E2C]">Your Info</Text>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="Name"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    handleInteraction();
                  }}
                  placeholder="Your name"
                />
                <TextInput
                  label="Email"
                  hint="Optional"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    handleInteraction();
                  }}
                  placeholder="your@email.com"
                />
              </div>
            </Card>

            <Card shadow="sm" padding="lg">
              <Text size="lg" weight="semibold" className="mb-4 block text-[#2E2E2C]">Your Availability</Text>
              <Text size="sm" color="dimmed" className="mb-4 block">
                Click and drag to select times when you're available.
              </Text>
              <TimeGrid
                dates={poll.time_config.dates}
                startHour={poll.time_config.start_hour}
                endHour={poll.time_config.end_hour}
                granularity={poll.time_config.granularity}
                selectedSlots={selectedSlots}
                onSlotsChange={setSelectedSlots}
                onInteraction={handleInteraction}
              />
            </Card>

            {mutationError && (
              <Alert variant="error">
                {mutationError instanceof Error ? mutationError.message : 'Failed to submit response'}
              </Alert>
            )}

            <Inline justify="between" align="center">
              <Text size="sm" color="dimmed">
                {selectedSlots.size} time slot{selectedSlots.size !== 1 ? 's' : ''} selected
              </Text>
              <Button
                type="submit"
                variant="primary"
                disabled={!name.trim() || isPending}
              >
                {isPending ? 'Submitting...' : isUpdate ? 'Update Response' : 'Submit Response'}
              </Button>
            </Inline>
          </Stack>
        </form>

        <div className="mt-6 text-center">
          <Link to={`/${uniqueId}/results`} className="text-sm text-[#3F5C6E] hover:underline">
            View current results &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
