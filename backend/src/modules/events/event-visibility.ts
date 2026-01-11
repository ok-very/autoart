/**
 * Event Visibility Registry
 *
 * Server-side classification of system vs user events.
 * Used by the Project Log to filter events by default.
 *
 * Design decision: Use a server-side registry instead of a DB column
 * to avoid migration and keep classification flexible.
 */

/**
 * System events - hidden by default in the Project Log
 * These are internal/infrastructure events not meaningful to end users
 */
export const SYSTEM_EVENT_TYPES = new Set<string>([
  'PROJECTION_REFRESH',
  'DEBUG_EVENT',
  'SYSTEM_MAINTENANCE',
]);

/**
 * User-meaningful events - always shown in the Project Log
 * These represent actual work, changes, and business-relevant facts
 */
export const USER_EVENT_TYPES = new Set<string>([
  // Action lifecycle
  'ACTION_DECLARED',
  'WORK_STARTED',
  'WORK_STOPPED',
  'WORK_FINISHED',
  'WORK_BLOCKED',
  'WORK_UNBLOCKED',

  // Field updates
  'FIELD_VALUE_RECORDED',

  // Assignments
  'ASSIGNMENT_OCCURRED',
  'ASSIGNMENT_REMOVED',

  // Dependencies
  'DEPENDENCY_ADDED',
  'DEPENDENCY_REMOVED',

  // References
  'ACTION_REFERENCE_ADDED',
  'ACTION_REFERENCE_REMOVED',

  // Ordering
  'WORKFLOW_ROW_MOVED',
]);

/**
 * Check if an event type is a system event (hidden by default)
 */
export function isSystemEvent(eventType: string): boolean {
  return SYSTEM_EVENT_TYPES.has(eventType);
}

/**
 * Check if an event type is user-meaningful (always shown)
 */
export function isUserEvent(eventType: string): boolean {
  // If not explicitly system, treat as user event
  return !SYSTEM_EVENT_TYPES.has(eventType);
}

/**
 * Get all system event types as an array (for SQL IN clause)
 */
export function getSystemEventTypes(): string[] {
  return [...SYSTEM_EVENT_TYPES];
}
