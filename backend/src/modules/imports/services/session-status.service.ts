/**
 * Session Status Service
 *
 * Centralized session status transition management with validation.
 * Ensures only valid status transitions occur and provides consistent logging.
 */

import type { Transaction } from 'kysely';

import { db } from '@db/client.js';
import type { Database } from '@db/schema.js';
import { logger } from '@utils/logger.js';

import type { ImportSessionStatus } from '../types.js';

// ============================================================================
// STATUS TRANSITION DEFINITIONS
// ============================================================================

/**
 * Valid status transitions map.
 * Key = current status, Value = set of allowed next statuses
 */
const VALID_TRANSITIONS: Record<ImportSessionStatus, Set<ImportSessionStatus>> = {
    pending: new Set(['planned', 'needs_review', 'failed']),
    planned: new Set(['executing', 'needs_review', 'failed']),
    needs_review: new Set(['planned', 'executing', 'failed']),
    executing: new Set(['completed', 'failed', 'needs_review']),
    completed: new Set([]), // Terminal state - no transitions allowed
    failed: new Set(['pending']), // Allow retry from failed
};

// ============================================================================
// TRANSITION VALIDATION
// ============================================================================

export class InvalidStatusTransitionError extends Error {
    constructor(
        public readonly sessionId: string,
        public readonly fromStatus: ImportSessionStatus,
        public readonly toStatus: ImportSessionStatus
    ) {
        super(`Invalid status transition: ${fromStatus} -> ${toStatus} for session ${sessionId}`);
        this.name = 'InvalidStatusTransitionError';
    }
}

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(
    from: ImportSessionStatus,
    to: ImportSessionStatus
): boolean {
    return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Get allowed next statuses from a given status.
 */
export function getAllowedTransitions(
    status: ImportSessionStatus
): ImportSessionStatus[] {
    return Array.from(VALID_TRANSITIONS[status] ?? []);
}

// ============================================================================
// STATUS UPDATE OPERATIONS
// ============================================================================

export interface TransitionOptions {
    /** Skip validation (use with caution - for migrations/recovery only) */
    force?: boolean;
    /** Additional metadata to log with the transition */
    reason?: string;
}

/**
 * Update session status with validation.
 * Uses a transaction with row-level locking to prevent race conditions.
 *
 * @param sessionId - The session ID to update
 * @param newStatus - The target status
 * @param options - Optional transition options
 * @throws InvalidStatusTransitionError if transition is not allowed
 */
export async function transitionSessionStatus(
    sessionId: string,
    newStatus: ImportSessionStatus,
    options: TransitionOptions = {}
): Promise<void> {
    const { force = false, reason } = options;

    await db.transaction().execute(async (trx) => {
        // Lock the session row to prevent concurrent status transitions
        const session = await trx
            .selectFrom('import_sessions')
            .select(['id', 'status'])
            .where('id', '=', sessionId)
            .forUpdate()
            .executeTakeFirst();

        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const currentStatus = session.status as ImportSessionStatus;

        // Validate transition (unless forced)
        if (!force && !isValidTransition(currentStatus, newStatus)) {
            logger.error({
                sessionId,
                fromStatus: currentStatus,
                toStatus: newStatus,
                allowedTransitions: getAllowedTransitions(currentStatus),
                reason,
            }, '[session-status] Invalid status transition attempted');

            throw new InvalidStatusTransitionError(sessionId, currentStatus, newStatus);
        }

        // Log the transition
        logger.info({
            sessionId,
            fromStatus: currentStatus,
            toStatus: newStatus,
            forced: force,
            reason,
        }, '[session-status] Status transition');

        // Perform the update within transaction
        await trx
            .updateTable('import_sessions')
            .set({ status: newStatus, updated_at: new Date() })
            .where('id', '=', sessionId)
            .execute();
    });
}

// ============================================================================
// CONVENIENCE METHODS
// ============================================================================

/**
 * Mark session as planned or needs_review based on classification state.
 */
export async function markSessionPlanned(
    sessionId: string,
    hasUnresolved: boolean
): Promise<void> {
    const newStatus: ImportSessionStatus = hasUnresolved ? 'needs_review' : 'planned';
    await transitionSessionStatus(sessionId, newStatus, {
        reason: hasUnresolved ? 'Plan has unresolved classifications' : 'Plan generated successfully',
    });
}

/**
 * Mark session as executing.
 */
export async function markSessionExecuting(sessionId: string): Promise<void> {
    await transitionSessionStatus(sessionId, 'executing', {
        reason: 'Execution started',
    });
}

/**
 * Mark session as completed.
 */
export async function markSessionCompleted(sessionId: string): Promise<void> {
    await transitionSessionStatus(sessionId, 'completed', {
        reason: 'Execution completed successfully',
    });
}

/**
 * Mark session as failed.
 */
export async function markSessionFailed(
    sessionId: string,
    error?: Error
): Promise<void> {
    await transitionSessionStatus(sessionId, 'failed', {
        reason: error?.message ?? 'Execution failed',
    });
}

/**
 * Mark session as needs_review.
 */
export async function markSessionNeedsReview(
    sessionId: string,
    reason: string
): Promise<void> {
    await transitionSessionStatus(sessionId, 'needs_review', { reason });
}

// ============================================================================
// TRANSACTION SUPPORT
// ============================================================================

/**
 * Update session status within a transaction (for atomic operations).
 * Validates the transition and logs it.
 *
 * @param trx - Kysely transaction
 * @param sessionId - The session ID to update
 * @param currentStatus - The current status (caller must provide from locked row)
 * @param newStatus - The target status
 * @param reason - Optional reason for the transition
 * @throws InvalidStatusTransitionError if transition is not allowed
 */
export async function transitionStatusInTransaction(
    trx: Transaction<Database>,
    sessionId: string,
    currentStatus: ImportSessionStatus,
    newStatus: ImportSessionStatus,
    reason?: string
): Promise<void> {
    // Validate transition
    if (!isValidTransition(currentStatus, newStatus)) {
        logger.error({
            sessionId,
            fromStatus: currentStatus,
            toStatus: newStatus,
            allowedTransitions: getAllowedTransitions(currentStatus),
            reason,
        }, '[session-status] Invalid status transition attempted in transaction');

        throw new InvalidStatusTransitionError(sessionId, currentStatus, newStatus);
    }

    // Log the transition
    logger.info({
        sessionId,
        fromStatus: currentStatus,
        toStatus: newStatus,
        reason,
        inTransaction: true,
    }, '[session-status] Status transition');

    // Perform the update within transaction, validating current status atomically
    const result = await trx
        .updateTable('import_sessions')
        .set({ status: newStatus, updated_at: new Date() })
        .where('id', '=', sessionId)
        .where('status', '=', currentStatus)
        .executeTakeFirst();

    // Check if update was successful (status may have changed since validation)
    if (result.numUpdatedRows === 0n) {
        const session = await trx
            .selectFrom('import_sessions')
            .select('status')
            .where('id', '=', sessionId)
            .executeTakeFirst();

        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const actualStatus = session.status as ImportSessionStatus;
        logger.error({
            sessionId,
            expectedStatus: currentStatus,
            actualStatus,
            toStatus: newStatus,
        }, '[session-status] Status changed during transaction');

        throw new InvalidStatusTransitionError(sessionId, actualStatus, newStatus);
    }
}

/**
 * Convenience: Get the appropriate status after plan generation.
 */
export function getPlannedStatus(hasUnresolved: boolean): ImportSessionStatus {
    return hasUnresolved ? 'needs_review' : 'planned';
}

// ============================================================================
// VALIDATION SET (for filtering/queries)
// ============================================================================

/**
 * Set of all valid session statuses for validation in queries.
 */
export const VALID_SESSION_STATUSES: Set<ImportSessionStatus> = new Set([
    'pending',
    'planned',
    'needs_review',
    'executing',
    'completed',
    'failed',
]);
