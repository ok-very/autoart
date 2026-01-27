import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPoll, submitResponse, updateResponse, type PublicPoll } from '../api';
import { TimeGrid } from './TimeGrid';

const STORAGE_KEY = 'poll_participant_name';

export function PollPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const {
    data: poll,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['poll', uniqueId],
    queryFn: () => fetchPoll(uniqueId!),
    enabled: !!uniqueId,
  });

  const existingResponse = useMemo(() => {
    if (!poll || !name) return null;
    return poll.responses.find(
      (r) => r.participant_name.toLowerCase() === name.toLowerCase()
    );
  }, [poll, name]);

  const isUpdate = !!existingResponse;

  useEffect(() => {
    const storedName = localStorage.getItem(STORAGE_KEY);
    if (storedName) {
      setName(storedName);
    }
  }, []);

  useEffect(() => {
    if (existingResponse) {
      setSelectedSlots(new Set(existingResponse.available_slots));
    }
  }, [existingResponse]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!uniqueId) throw new Error('Poll ID is missing');
      return submitResponse(uniqueId, name, Array.from(selectedSlots), email || undefined);
    },
    onSuccess: () => {
      localStorage.setItem(STORAGE_KEY, name);
      queryClient.invalidateQueries({ queryKey: ['poll', uniqueId] });
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-600">Loading poll...</div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Poll Not Found</h1>
          <p className="text-slate-600">
            {error instanceof Error ? error.message : 'This poll may have been closed or deleted.'}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-4xl">✓</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            {isUpdate ? 'Response Updated!' : 'Response Submitted!'}
          </h1>
          <p className="mb-6 text-slate-600">
            Your availability has been {isUpdate ? 'updated' : 'recorded'} for "{poll.title}".
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to={`/${uniqueId}/results`}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              View Results
            </Link>
            <button
              onClick={() => setSubmitted(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit Response
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">{poll.title}</h1>
          {poll.description && <p className="text-slate-600">{poll.description}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Your Info</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Your Availability</h2>
            <p className="mb-4 text-sm text-slate-600">
              Click and drag to select times when you're available.
            </p>
            <TimeGrid
              dates={poll.time_config.dates}
              startHour={poll.time_config.start_hour}
              endHour={poll.time_config.end_hour}
              granularity={poll.time_config.granularity}
              selectedSlots={selectedSlots}
              onSlotsChange={setSelectedSlots}
            />
          </div>

          {mutationError && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700">
              {mutationError instanceof Error ? mutationError.message : 'Failed to submit response'}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {selectedSlots.size} time slot{selectedSlots.size !== 1 ? 's' : ''} selected
            </p>
            <button
              type="submit"
              disabled={!name.trim() || isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Submitting...' : isUpdate ? 'Update Response' : 'Submit Response'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <Link to={`/${uniqueId}/results`} className="text-sm text-blue-600 hover:underline">
            View current results →
          </Link>
        </div>
      </div>
    </div>
  );
}
