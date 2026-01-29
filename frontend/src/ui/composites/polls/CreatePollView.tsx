import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, TextInput, Card, Stack, Inline, Text, Alert, SegmentedControl, Select } from '@autoart/ui';
import { useCreatePoll } from '../../../api/hooks/polls';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { GRANULARITY_OPTIONS } from './constants';
import type { TimeSlotGranularity } from '@autoart/shared';

interface CreatePollViewProps {
    onBack: () => void;
    onCreated: (pollId: string, uniqueId: string) => void;
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function formatDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}));

function MonthGrid({
    year,
    month,
    selectedDates,
    onToggleDate,
}: {
    year: number;
    month: number;
    selectedDates: Set<string>;
    onToggleDate: (dateKey: string) => void;
}) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
                {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="text-center text-xs text-[var(--ws-text-secondary)] py-1">
                        {label}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, idx) => {
                    if (day === null) {
                        return <div key={`empty-${idx}`} className="h-8" />;
                    }
                    const dateKey = formatDateKey(year, month, day);
                    const cellDate = new Date(year, month, day);
                    const isPast = cellDate < today;
                    const isSelected = selectedDates.has(dateKey);

                    return (
                        <button
                            key={dateKey}
                            type="button"
                            disabled={isPast}
                            onClick={() => onToggleDate(dateKey)}
                            className={[
                                'h-8 rounded text-sm transition-colors',
                                isPast
                                    ? 'text-[var(--ws-text-disabled)] cursor-not-allowed'
                                    : isSelected
                                        ? 'bg-[var(--ws-accent)] text-[var(--ws-accent-fg)] font-medium'
                                        : 'hover:bg-[var(--ws-row-expanded-bg)] text-[var(--ws-fg)]',
                            ].join(' ')}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function CreatePollView({ onBack, onCreated }: CreatePollViewProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const [startHour, setStartHour] = useState<string>('9');
    const [endHour, setEndHour] = useState<string>('17');
    const [granularity, setGranularity] = useState<TimeSlotGranularity>('30min');
    const { formatMonthYear, timezone } = useDateFormat();

    const now = new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());

    const createMutation = useCreatePoll();

    const handleToggleDate = useCallback((dateKey: string) => {
        setSelectedDates((prev) => {
            const next = new Set(prev);
            if (next.has(dateKey)) {
                next.delete(dateKey);
            } else {
                next.add(dateKey);
            }
            return next;
        });
    }, []);

    const handlePrevMonth = useCallback(() => {
        setViewMonth((m) => {
            if (m === 0) {
                setViewYear((y) => y - 1);
                return 11;
            }
            return m - 1;
        });
    }, []);

    const handleNextMonth = useCallback(() => {
        setViewMonth((m) => {
            if (m === 11) {
                setViewYear((y) => y + 1);
                return 0;
            }
            return m + 1;
        });
    }, []);

    const sortedDates = useMemo(
        () => Array.from(selectedDates).sort(),
        [selectedDates]
    );

    const isValid = title.trim().length > 0
        && sortedDates.length > 0
        && Number(startHour) < Number(endHour);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        createMutation.mutate(
            {
                title: title.trim(),
                description: description.trim() || undefined,
                time_config: {
                    dates: sortedDates,
                    start_hour: Number(startHour),
                    end_hour: Number(endHour),
                    granularity,
                    timezone,
                },
            },
            {
                onSuccess: (poll) => {
                    onCreated(poll.id, poll.unique_id);
                },
            }
        );
    };

    return (
        <Stack gap="none" className="h-full">
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--ws-group-border)] px-4 py-3">
                <Inline align="center" gap="sm">
                    <button
                        onClick={onBack}
                        className="p-1 rounded hover:bg-[var(--ws-row-expanded-bg)] transition-colors"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <Text size="lg" weight="semibold">New Poll</Text>
                </Inline>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-auto px-4 py-4">
                <form onSubmit={handleSubmit} className="max-w-xl">
                    <Stack gap="lg">
                        <Card padding="lg">
                            <Stack gap="md">
                                <TextInput
                                    label="Title"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Team meeting availability"
                                />
                                <TextInput
                                    label="Description"
                                    hint="Optional"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Finding a time that works for everyone"
                                />
                            </Stack>
                        </Card>

                        <Card padding="lg">
                            <Stack gap="md">
                                <Text weight="semibold">Select Dates</Text>
                                <Inline justify="between" align="center">
                                    <button
                                        type="button"
                                        onClick={handlePrevMonth}
                                        className="px-2 py-1 text-sm rounded hover:bg-[var(--ws-row-expanded-bg)] transition-colors"
                                    >
                                        &larr;
                                    </button>
                                    <Text weight="medium">{formatMonthYear(viewYear, viewMonth)}</Text>

                                    <button
                                        type="button"
                                        onClick={handleNextMonth}
                                        className="px-2 py-1 text-sm rounded hover:bg-[var(--ws-row-expanded-bg)] transition-colors"
                                    >
                                        &rarr;
                                    </button>
                                </Inline>
                                <MonthGrid
                                    year={viewYear}
                                    month={viewMonth}
                                    selectedDates={selectedDates}
                                    onToggleDate={handleToggleDate}
                                />
                                {sortedDates.length > 0 && (
                                    <Text size="sm" color="dimmed">
                                        {sortedDates.length} date{sortedDates.length !== 1 ? 's' : ''} selected
                                    </Text>
                                )}
                            </Stack>
                        </Card>

                        <Card padding="lg">
                            <Stack gap="md">
                                <Text weight="semibold">Time Range</Text>
                                <Inline gap="md" align="end">
                                    <Select
                                        label="Start"
                                        value={startHour}
                                        onChange={(v) => v && setStartHour(v)}
                                        data={HOUR_OPTIONS}
                                    />
                                    <Select
                                        label="End"
                                        value={endHour}
                                        onChange={(v) => v && setEndHour(v)}
                                        data={HOUR_OPTIONS}
                                    />
                                </Inline>
                                {Number(startHour) >= Number(endHour) && (
                                    <Text size="sm" color="error">End time must be after start time</Text>
                                )}
                            </Stack>
                        </Card>

                        <Card padding="lg">
                            <Stack gap="md">
                                <Text weight="semibold">Granularity</Text>
                                <SegmentedControl
                                    value={granularity}
                                    onChange={(v) => setGranularity(v as TimeSlotGranularity)}
                                    data={GRANULARITY_OPTIONS}
                                />
                            </Stack>
                        </Card>

                        {createMutation.error && (
                            <Alert variant="error">
                                {createMutation.error instanceof Error
                                    ? createMutation.error.message
                                    : 'Failed to create poll'}
                            </Alert>
                        )}

                        <Inline justify="end" gap="sm">
                            <Button variant="secondary" type="button" onClick={onBack}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={!isValid || createMutation.isPending}
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create Poll'}
                            </Button>
                        </Inline>
                    </Stack>
                </form>
            </div>
        </Stack>
    );
}
