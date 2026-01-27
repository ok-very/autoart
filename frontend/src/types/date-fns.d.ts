declare module 'date-fns' {
    export function format(date: Date | number, formatStr: string, options?: { locale?: unknown }): string;
    export function parse(dateString: string, formatString: string, referenceDate: Date, options?: { locale?: unknown }): Date;
    export function startOfWeek(date: Date | number, options?: { locale?: unknown; weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date;
    export function getDay(date: Date | number): number;
    export function addMonths(date: Date | number, amount: number): Date;
    export function subMonths(date: Date | number, amount: number): Date;
    export function addDays(date: Date | number, amount: number): Date;
    export function subDays(date: Date | number, amount: number): Date;
    export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
    export function isBefore(date: Date | number, dateToCompare: Date | number): boolean;
    export function isAfter(date: Date | number, dateToCompare: Date | number): boolean;
    export function differenceInDays(dateLeft: Date | number, dateRight: Date | number): number;
    export function parseISO(dateString: string): Date;
    export function formatISO(date: Date | number): string;
}

declare module 'date-fns/locale' {
    export const enUS: unknown;
}
