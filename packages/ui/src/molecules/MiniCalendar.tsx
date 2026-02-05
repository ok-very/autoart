/**
 * MiniCalendar - Month grid for selecting multiple dates
 *
 * Renders a compact calendar where clicking days toggles selection.
 * Navigation arrows move between months. Monday-start weeks.
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    addMonths,
    subMonths,
    isSameMonth,
    isToday,
} from 'date-fns';

export interface MiniCalendarProps {
    selectedDates: string[];
    onDatesChange: (dates: string[]) => void;
    className?: string;
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MiniCalendar({ selectedDates, onDatesChange, className }: MiniCalendarProps) {
    const [viewMonth, setViewMonth] = useState<Date>(() => {
        if (selectedDates.length > 0) {
            const sorted = [...selectedDates].sort();
            return startOfMonth(new Date(sorted[0] + 'T00:00:00'));
        }
        return startOfMonth(new Date());
    });

    const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

    const days = useMemo(() => {
        const monthStart = startOfMonth(viewMonth);
        const monthEnd = endOfMonth(viewMonth);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [viewMonth]);

    const handleDayClick = useCallback(
        (day: Date) => {
            const iso = format(day, 'yyyy-MM-dd');
            const next = selectedSet.has(iso)
                ? selectedDates.filter((d) => d !== iso)
                : [...selectedDates, iso];
            next.sort();
            onDatesChange(next);
        },
        [selectedDates, selectedSet, onDatesChange],
    );

    return (
        <div className={clsx('inline-block', className)}>
            {/* Nav header */}
            <div className="flex items-center justify-between mb-2">
                <button
                    type="button"
                    onClick={() => setViewMonth((m) => subMonths(m, 1))}
                    className="w-7 h-7 flex items-center justify-center rounded text-ws-text-secondary hover:bg-[var(--ws-row-expanded-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ws-accent)]"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-[var(--ws-fg)]">
                    {format(viewMonth, 'MMMM yyyy')}
                </span>
                <button
                    type="button"
                    onClick={() => setViewMonth((m) => addMonths(m, 1))}
                    className="w-7 h-7 flex items-center justify-center rounded text-ws-text-secondary hover:bg-[var(--ws-row-expanded-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ws-accent)]"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0">
                {DAY_HEADERS.map((d) => (
                    <div
                        key={d}
                        className="w-8 h-6 flex items-center justify-center text-[11px] text-ws-text-secondary select-none"
                    >
                        {d}
                    </div>
                ))}

                {/* Day cells */}
                {days.map((day) => {
                    const iso = format(day, 'yyyy-MM-dd');
                    const inMonth = isSameMonth(day, viewMonth);
                    const today = isToday(day);
                    const selected = selectedSet.has(iso);

                    return (
                        <button
                            key={iso}
                            type="button"
                            onClick={() => handleDayClick(day)}
                            className={clsx(
                                'w-8 h-8 flex items-center justify-center rounded text-xs transition-colors',
                                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ws-accent)]',
                                selected && 'bg-[var(--ws-accent)] text-[var(--ws-accent-fg)]',
                                !selected && today && 'ring-1 ring-inset ring-[var(--ws-accent)]',
                                !selected && !inMonth && 'text-ws-text-disabled',
                                !selected && inMonth && 'text-[var(--ws-fg)] hover:bg-[var(--ws-row-expanded-bg)]',
                            )}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
