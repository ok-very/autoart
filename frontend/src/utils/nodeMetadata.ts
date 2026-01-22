/**
 * Node Metadata Utilities
 *
 * Re-exports task-related schemas and helpers from @autoart/shared.
 * Contains additional frontend-specific utilities.
 */

// Re-export everything from shared package
export {
    TaskStatusSchema,
    TaskMetadataSchema,
    TaskFieldDefSchema,
    TASK_STATUS_CONFIG,
    parseTaskMetadata,
    deriveTaskStatus,
    coercePercentComplete,
    isActiveStatus,
    type TaskStatus,
    type TaskMetadata,
    type TaskFieldDef,
} from '@autoart/shared';

import { z } from 'zod';

const UnknownRecordSchema = z.record(z.string(), z.unknown());

/**
 * Parse any unknown value into a record
 */
export function parseUnknownRecord(input: unknown): Record<string, unknown> {
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);
            const res = UnknownRecordSchema.safeParse(parsed);
            return res.success ? res.data : {};
        } catch {
            return {};
        }
    }

    const res = UnknownRecordSchema.safeParse(input);
    return res.success ? res.data : {};
}
