import { z } from 'zod';
import { FieldDefSchema, type StatusConfig, type FieldDef } from './records';

/**
 * Task Status Enum
 * Defines the workflow states a task can be in
 */
export const TaskStatusSchema = z.enum([
    'empty',        // No status set yet
    'not-started',  // Planned but not begun
    'in-progress',  // Actively being worked on
    'blocked',      // Waiting on something external
    'review',       // Work complete, pending review
    'done',         // Fully complete
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Default workflow status configuration
 * This is the fallback when a field's statusConfig is not defined.
 * 
 * @deprecated Prefer using field.statusConfig from the record definition.
 * Status configuration is now stored per-field in the database.
 * This constant remains for backwards compatibility and as a fallback.
 */
export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; colorClass: string }> = {
    'empty': { label: '', colorClass: 'bg-slate-100 text-slate-400' },
    'not-started': { label: 'Not Started', colorClass: 'bg-slate-200 text-slate-600' },
    'in-progress': { label: 'In Progress', colorClass: 'bg-amber-100 text-amber-700' },
    'blocked': { label: 'Blocked', colorClass: 'bg-red-100 text-red-700' },
    'review': { label: 'Review', colorClass: 'bg-purple-100 text-purple-700' },
    'done': { label: 'Done', colorClass: 'bg-emerald-100 text-emerald-700' },
};

/**
 * Get status configuration from a field definition.
 * Falls back to TASK_STATUS_CONFIG if field.statusConfig is not defined.
 */
export function getStatusConfig(field: FieldDef): StatusConfig {
    if (field.statusConfig) {
        return field.statusConfig;
    }
    // Fallback to default config
    return TASK_STATUS_CONFIG;
}

/**
 * Get status display info for a specific status value.
 * Uses field's statusConfig if available, otherwise falls back to defaults.
 */
export function getStatusDisplay(
    status: string,
    field?: FieldDef
): { label: string; colorClass: string } {
    const config = field ? getStatusConfig(field) : TASK_STATUS_CONFIG;
    // Cast to Record<string, ...> since we have a fallback for unknown keys
    const statusMap = config as Record<string, { label: string; colorClass: string }>;
    return statusMap[status] ?? { label: status, colorClass: 'bg-slate-200 text-slate-600' };
}

/**
 * Task Metadata Schema
 * Defines the structure of task node metadata fields
 */
export const TaskMetadataSchema = z
    .object({
        status: TaskStatusSchema.optional(),
        // Owner can be a string (name/id) or an object with user details
        owner: z.union([
            z.string(),
            z.object({
                id: z.string().optional(),
                name: z.string().optional(),
                email: z.string().optional(),
            }),
        ]).optional(),
        dueDate: z.string().optional(),
        percentComplete: z.number().min(0).max(100).optional(),
        tags: z.array(z.string()).optional(),
        completed: z.boolean().optional(),
    })
    .passthrough();

export type TaskMetadata = z.infer<typeof TaskMetadataSchema>;

/**
 * Task Field Definition
 * Describes a column/field for task display and editing
 */
export const TaskFieldDefSchema = FieldDefSchema.extend({
    /** Column width in pixels or flex unit */
    width: z.union([z.number(), z.literal('flex')]).optional(),
    /** Whether this field appears in the collapsed row */
    showInCollapsed: z.boolean().default(true),
    /** Whether this field appears in the expanded row */
    showInExpanded: z.boolean().default(true),
    /** Custom render type for the DataFieldWidget */
    renderAs: z.enum(['text', 'status', 'user', 'date', 'percent', 'tags', 'description']).optional(),
});

export type TaskFieldDef = z.infer<typeof TaskFieldDefSchema>;

/**
 * Default task field definitions
 * The canonical set of fields for task display
 */
export const DEFAULT_TASK_FIELDS: TaskFieldDef[] = [
    {
        key: 'title',
        type: 'text',
        label: 'Task',
        required: true,
        width: 360,
        showInCollapsed: true,
        showInExpanded: false,
        renderAs: 'text',
    },
    {
        key: 'status',
        type: 'status',
        label: 'Status',
        options: ['empty', 'not-started', 'in-progress', 'blocked', 'review', 'done'],
        width: 128,
        showInCollapsed: true,
        showInExpanded: true,
        renderAs: 'status',
    },
    {
        key: 'owner',
        type: 'user',
        label: 'Owner',
        width: 96,
        showInCollapsed: true,
        showInExpanded: true,
        renderAs: 'user',
    },
    {
        key: 'dueDate',
        type: 'date',
        label: 'Due',
        width: 160,
        showInCollapsed: true,
        showInExpanded: true,
        renderAs: 'date',
    },
    {
        key: 'tags',
        type: 'tags',
        label: 'Tags',
        width: 'flex',
        showInCollapsed: false,
        showInExpanded: true,
        renderAs: 'tags',
    },
    {
        key: 'description',
        type: 'textarea',
        label: 'Description',
        width: 'flex',
        showInCollapsed: false,
        showInExpanded: true,
        renderAs: 'description',
    },
];

/**
 * Parse raw metadata into typed TaskMetadata
 */
export function parseTaskMetadata(input: unknown): TaskMetadata {
    if (typeof input === 'string') {
        try {
            input = JSON.parse(input);
        } catch {
            return {};
        }
    }

    if (!input || typeof input !== 'object') return {};

    // Validate in a way that doesn't drop all fields if one field is invalid.
    const candidate = { ...(input as Record<string, unknown>) };

    const result = TaskMetadataSchema.safeParse(candidate);
    if (result.success) return result.data;

    // Salvage common fields even if validation fails.
    const salvaged: TaskMetadata = {};
    const statusResult = TaskStatusSchema.safeParse(candidate.status);
    if (statusResult.success) salvaged.status = statusResult.data;
    // Owner can be string or object
    if (typeof candidate.owner === 'string') {
        salvaged.owner = candidate.owner;
    } else if (candidate.owner && typeof candidate.owner === 'object') {
        salvaged.owner = candidate.owner as { id?: string; name?: string; email?: string };
    }
    if (typeof candidate.dueDate === 'string') salvaged.dueDate = candidate.dueDate;
    if (typeof candidate.percentComplete === 'number') {
        salvaged.percentComplete = Math.max(0, Math.min(100, candidate.percentComplete));
    }
    if (Array.isArray(candidate.tags)) {
        salvaged.tags = candidate.tags.filter((t): t is string => typeof t === 'string');
    }
    if (typeof candidate.completed === 'boolean') salvaged.completed = candidate.completed;
    return salvaged;
}

/**
 * Derive effective status from metadata
 */
export function deriveTaskStatus(metadata: TaskMetadata): TaskStatus {
    if (metadata.status) return metadata.status;
    if (metadata.completed === true) return 'done';
    return 'empty';
}

/**
 * Coerce percent complete from various metadata fields
 */
export function coercePercentComplete(metadata: TaskMetadata): number | null {
    if (typeof metadata.percentComplete === 'number') {
        return Math.max(0, Math.min(100, metadata.percentComplete));
    }
    if (metadata.completed === true) return 100;
    if (metadata.completed === false) return 0;
    return null;
}

/**
 * Check if status is "active" (should show percent complete)
 */
export function isActiveStatus(status: TaskStatus): boolean {
    return status !== 'empty' && status !== 'not-started';
}
