declare module 'react-big-calendar' {
    import { ComponentType } from 'react';

    export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda';

    export interface Event {
        title?: string;
        start?: Date;
        end?: Date;
        allDay?: boolean;
        resource?: unknown;
    }

    export interface CalendarProps<TEvent extends Event = Event> {
        localizer: DateLocalizer;
        events?: TEvent[];
        views?: View[] | { [key in View]?: boolean | ComponentType };
        view?: View;
        defaultView?: View;
        defaultDate?: Date;
        date?: Date;
        onNavigate?: (date: Date, view: View) => void;
        onView?: (view: View) => void;
        onSelectEvent?: (event: TEvent) => void;
        onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] }) => void;
        selectable?: boolean;
        step?: number;
        timeslots?: number;
        min?: Date;
        max?: Date;
        style?: React.CSSProperties;
        className?: string;
        eventPropGetter?: (event: TEvent) => { className?: string; style?: React.CSSProperties };
        dayPropGetter?: (date: Date) => { className?: string; style?: React.CSSProperties };
        components?: {
            event?: ComponentType<{ event: TEvent }>;
            toolbar?: ComponentType;
            [key: string]: ComponentType | undefined;
        };
        formats?: Partial<{
            dateFormat: string;
            dayFormat: string;
            weekdayFormat: string;
            timeGutterFormat: string;
            monthHeaderFormat: string;
            dayHeaderFormat: string;
            dayRangeHeaderFormat: (range: { start: Date; end: Date }) => string;
            agendaHeaderFormat: (range: { start: Date; end: Date }) => string;
        }>;
    }

    export interface DateLocalizer {
        format: (value: Date, format: string, culture?: string) => string;
        parse: (value: string, format: string, culture?: string) => Date;
        startOfWeek: (culture?: string) => number;
        messages?: Record<string, string>;
    }

    export function dateFnsLocalizer(config: {
        format: typeof import('date-fns').format;
        parse: typeof import('date-fns').parse;
        startOfWeek: typeof import('date-fns').startOfWeek;
        getDay: typeof import('date-fns').getDay;
        locales: Record<string, unknown>;
    }): DateLocalizer;

    export const Calendar: ComponentType<CalendarProps>;
    export default Calendar;
}

declare module 'react-big-calendar/lib/addons/dragAndDrop' {
    import { ComponentType } from 'react';
    import { CalendarProps, Event } from 'react-big-calendar';

    export interface EventInteractionArgs<TEvent extends Event = Event> {
        event: TEvent;
        start: Date;
        end: Date;
        isAllDay?: boolean;
    }

    export interface DragAndDropCalendarProps<TEvent extends Event = Event>
        extends CalendarProps<TEvent> {
        onEventDrop?: (args: EventInteractionArgs<TEvent>) => void;
        onEventResize?: (args: EventInteractionArgs<TEvent>) => void;
        onDragStart?: (args: { event: TEvent; action: 'resize' | 'move' }) => void;
        draggableAccessor?: string | ((event: TEvent) => boolean);
        resizableAccessor?: string | ((event: TEvent) => boolean);
        resizable?: boolean;
        popup?: boolean;
    }

    function withDragAndDrop<TEvent extends Event = Event>(
        Calendar: ComponentType<CalendarProps<TEvent>>
    ): ComponentType<DragAndDropCalendarProps<TEvent>>;

    export default withDragAndDrop;
}
