import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPoll, fetchResults } from '../api';
import { TimeGrid } from './TimeGrid';

export function ResultsPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !poll || !results) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Poll Not Found</h1>
          <p className="text-slate-600">
            This poll may have been deleted or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const heatmapData = new Map<string, number>(Object.entries(results.slotCounts));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{poll.title}</h1>
          {poll.description && (
            <p className="mt-1 text-slate-600">{poll.description}</p>
          )}
          <p className="mt-2 text-sm text-slate-500">
            {results.totalResponses} {results.totalResponses === 1 ? 'response' : 'responses'}
          </p>
        </div>

        {results.bestSlots.length > 0 && (
          <div className="mb-6 rounded-lg bg-emerald-50 p-4">
            <h2 className="mb-2 font-semibold text-emerald-800">Best Times</h2>
            <div className="flex flex-wrap gap-2">
              {results.bestSlots.map((slot) => {
                const parts = slot.split(':');
                if (parts.length < 3) {
                  return (
                    <span key={slot} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                      {slot}
                    </span>
                  );
                }
                const [date, hour, minute] = parts;
                const dateObj = new Date(date + 'T12:00:00');
                // Validate date is parseable
                if (isNaN(dateObj.getTime())) {
                  return (
                    <span key={slot} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                      {slot}
                    </span>
                  );
                }
                const dayStr = dateObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const hourNum = parseInt(hour, 10);
                const minuteNum = parseInt(minute, 10);
                if (isNaN(hourNum) || isNaN(minuteNum) || hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
                  return (
                    <span key={slot} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                      {slot}
                    </span>
                  );
                }
                const period = hourNum >= 12 ? 'PM' : 'AM';
                const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                const timeStr = `${displayHour}:${minuteNum.toString().padStart(2, '0')} ${period}`;
                return (
                  <span
                    key={slot}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800"
                  >
                    {dayStr} @ {timeStr}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="mb-3 font-semibold text-slate-800">Availability Heatmap</h2>
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
          />
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Less available</span>
            <div className="flex gap-0.5">
              <div className="h-4 w-4 rounded bg-slate-100" />
              <div className="h-4 w-4 rounded bg-emerald-200" />
              <div className="h-4 w-4 rounded bg-emerald-300" />
              <div className="h-4 w-4 rounded bg-emerald-400" />
              <div className="h-4 w-4 rounded bg-emerald-500" />
            </div>
            <span>More available</span>
          </div>
        </div>

        {poll.responses.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-semibold text-slate-800">Participants</h2>
            <div className="flex flex-wrap gap-2">
              {poll.responses.map((response) => (
                <span
                  key={response.id}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                >
                  {response.participant_name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <Link
            to={`/${uniqueId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Submit your availability
          </Link>
        </div>
      </div>
    </div>
  );
}
