/**
 * CalendarView Component
 *
 * A calendar-based view for displaying actions as events using react-big-calendar.
 * Supports drag-and-drop for rescheduling and hot zones for cross-month navigation.
 */

import { Calendar, dateFnsLocalizer, type View, type Event } from 'react-big-calendar';
import withDragAndDrop, {
    type EventInteractionArgs,
} from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useState, useCallback, useRef, useEffect } from 'react';

import { useDragHotZones, type HotZoneConfig } from '../../hooks';
import type { CalendarEvent } from '../../utils/calendar-adapter';
import { getEventColor } from '../../utils/calendar-adapter';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../../styles/calendar.css';

// ============================================================================
// LOCALIZER SETUP
// ============================================================================

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

// ============================================================================
// DRAG AND DROP CALENDAR
// ============================================================================

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as any);

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarViewProps {
    /** Calendar events to display */
    events: CalendarEvent[];
    /** Callback when an event is dropped on a new date */
    onEventDrop?: (args: { event: CalendarEvent; start: Date; end: Date }) => void;
    /** Callback when an event is resized */
    onEventResize?: (args: { event: CalendarEvent; start: Date; end: Date }) => void;
    /** Callback when an event is selected/clicked */
    onSelectEvent?: (event: CalendarEvent) => void;
    /** Callback when the calendar navigates to a new date */
    onNavigate?: (date: Date, view: View) => void;
    /** Default view (month, week, day, agenda) */
    defaultView?: View;
    /** Default date to display */
    defaultDate?: Date;
    /** Additional className for the container */
    className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CalendarView({
    events,
    onEventDrop,
    onEventResize,
    onSelectEvent,
    onNavigate,
    defaultView = 'month',
    defaultDate = new Date(),
    className,
}: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(defaultDate);
    const [isDragging, setIsDragging] = useState(false);
    const [hotZones, setHotZones] = useState<HotZoneConfig[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle navigation
    const handleNavigate = useCallback((date: Date, view: View) => {
        setCurrentDate(date);
        onNavigate?.(date, view);
    }, [onNavigate]);

    // Compute hot zone bounds from current container position
    const computeHotZones = useCallback((): HotZoneConfig[] => {
        if (!containerRef.current) return [];
        const rect = containerRef.current.getBoundingClientRect();
        return [
            {
                id: 'prev-month',
                bounds: {
                    left: rect.left,
                    right: rect.left + 60,
                    top: rect.top,
                    bottom: rect.bottom,
                },
                onTrigger: () => {
                    setCurrentDate(d => subMonths(d, 1));
                },
            },
            {
                id: 'next-month',
                bounds: {
                    left: rect.right - 60,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                },
                onTrigger: () => {
                    setCurrentDate(d => addMonths(d, 1));
                },
            },
        ];
    }, []);

    // Update hot zones when dragging starts or window resizes
    useEffect(() => {
        if (isDragging) {
            // Compute initial bounds when drag starts
            setHotZones(computeHotZones());

            // Update bounds on resize/scroll during drag
            const handleResize = () => setHotZones(computeHotZones());
            window.addEventListener('resize', handleResize);
            window.addEventListener('scroll', handleResize, true);

            return () => {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('scroll', handleResize, true);
            };
        } else {
            setHotZones([]);
        }
    }, [isDragging, computeHotZones]);

    // Enable hot zones during drag
    useDragHotZones({
        zones: hotZones,
        isDragging,
        dwellTime: 450,
        cooldownTime: 900,
    });

    // Handle drag start
    const handleDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    // Handle event drop
    const handleEventDrop = useCallback((args: EventInteractionArgs<CalendarEvent>) => {
        setIsDragging(false);
        if (onEventDrop && args.event && args.start && args.end) {
            onEventDrop({
                event: args.event,
                start: new Date(args.start),
                end: new Date(args.end),
            });
        }
    }, [onEventDrop]);

    // Handle event resize
    const handleEventResize = useCallback((args: EventInteractionArgs<CalendarEvent>) => {
        setIsDragging(false);
        if (onEventResize && args.event && args.start && args.end) {
            onEventResize({
                event: args.event,
                start: new Date(args.start),
                end: new Date(args.end),
            });
        }
    }, [onEventResize]);

    // Handle event select
    const handleSelectEvent = useCallback((event: CalendarEvent) => {
        onSelectEvent?.(event);
    }, [onSelectEvent]);

    // Custom event styling based on status
    const eventPropGetter = useCallback((event: CalendarEvent) => {
        const backgroundColor = getEventColor(event);
        return {
            style: {
                backgroundColor,
                borderColor: backgroundColor,
            },
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`relative h-full ${className || ''}`}
            data-aa-component="CalendarView"
        >
            {/* Hot zone indicators (visible during drag) */}
            {isDragging && (
                <>
                    <div className="calendar-hot-zone calendar-hot-zone--left" />
                    <div className="calendar-hot-zone calendar-hot-zone--right" />
                </>
            )}

            <DnDCalendar
                localizer={localizer}
                events={events}
                date={currentDate}
                defaultView={defaultView}
                views={['month', 'week', 'day', 'agenda']}
                onNavigate={handleNavigate}
                onDragStart={handleDragStart}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventPropGetter}
                resizable
                selectable
                popup
                style={{ height: '100%' }}
            />
        </div>
    );
}

export default CalendarView;
