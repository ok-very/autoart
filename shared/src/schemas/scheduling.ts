/**
 * Scheduling Schemas
 *
 * Defines schemas for duration-based scheduling and working days calculation.
 * Used by CalendarView, GanttView, and timeline projections.
 */

import { z } from 'zod';

/**
 * Day mode - how to count days in duration calculations
 * - calendar: Include all days (default)
 * - working: Skip weekends (and holidays if configured)
 */
export const DayModeSchema = z.enum(['calendar', 'working']);
export type DayMode = z.infer<typeof DayModeSchema>;

/**
 * Scheduling settings for a project/context
 */
export const SchedulingSettingsSchema = z.object({
    /** How to count days in duration calculations */
    dayMode: DayModeSchema.default('calendar'),
    /** Default schedule mode for new actions */
    defaultScheduleMode: z.enum(['explicit', 'anchor_start', 'anchor_due']).default('explicit'),
    /** Days considered weekends (0=Sunday, 6=Saturday) */
    weekendDays: z.array(z.number().min(0).max(6)).default([0, 6]),
    /** Holiday dates (ISO strings) to skip in working day calculations */
    holidays: z.array(z.string()).default([]),
});
export type SchedulingSettings = z.infer<typeof SchedulingSettingsSchema>;

/**
 * Default scheduling settings
 */
export const DEFAULT_SCHEDULING_SETTINGS: SchedulingSettings = {
    dayMode: 'calendar',
    defaultScheduleMode: 'explicit',
    weekendDays: [0, 6],
    holidays: [],
};

/**
 * Input schema for reschedule endpoint
 */
export const RescheduleInputSchema = z.object({
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    durationDays: z.number().min(0).optional(),
    scheduleMode: z.enum(['explicit', 'anchor_start', 'anchor_due']).optional(),
});
export type RescheduleInput = z.infer<typeof RescheduleInputSchema>;
