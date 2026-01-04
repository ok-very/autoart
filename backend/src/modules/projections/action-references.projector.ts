/**
 * Action References Projector
 *
 * Maintains the action_references snapshot table from events.
 * This is a synchronous projector that updates the table in response to events.
 *
 * Projector responsibilities (per projection-invariants.md):
 * - Read: Actions + Events
 * - Call: Interpreter (pure)
 * - Write: Only UI-facing cached fields (action_references)
 * - Never: Define semantics (that's the interpreter's job)
 *
 * Event types handled:
 * - ACTION_REFERENCE_ADDED → upsert row
 * - ACTION_REFERENCE_REMOVED → delete row
 */

import { db } from '../../db/client.js';
import type { Event, ActionReferenceAddedPayload, ActionReferenceRemovedPayload } from '@autoart/shared';

// ============================================================================
// PROJECTOR FUNCTIONS
// ============================================================================

/**
 * Handle ACTION_REFERENCE_ADDED event
 * Upserts a row in action_references (insert or update if exists)
 */
export async function handleReferenceAdded(event: Event): Promise<void> {
    if (event.type !== 'ACTION_REFERENCE_ADDED' || !event.actionId) return;

    const payload = event.payload as ActionReferenceAddedPayload;
    if (!payload.sourceRecordId || !payload.targetFieldKey) {
        console.warn(`[action-references.projector] Invalid payload for ACTION_REFERENCE_ADDED: ${JSON.stringify(payload)}`);
        return;
    }

    // Check if reference already exists
    const existing = await db
        .selectFrom('action_references')
        .select('id')
        .where('action_id', '=', event.actionId)
        .where('source_record_id', '=', payload.sourceRecordId)
        .where('target_field_key', '=', payload.targetFieldKey)
        .executeTakeFirst();

    if (existing) {
        // Update snapshot value if provided
        if (payload.snapshotValue !== undefined) {
            await db
                .updateTable('action_references')
                .set({ snapshot_value: payload.snapshotValue })
                .where('id', '=', existing.id)
                .execute();
        }
        // Already exists, nothing more to do
        return;
    }

    // Insert new reference
    await db
        .insertInto('action_references')
        .values({
            action_id: event.actionId,
            source_record_id: payload.sourceRecordId,
            target_field_key: payload.targetFieldKey,
            mode: 'static',
            snapshot_value: payload.snapshotValue ?? null,
        })
        .execute();
}

/**
 * Handle ACTION_REFERENCE_REMOVED event
 * Deletes the matching row from action_references
 */
export async function handleReferenceRemoved(event: Event): Promise<void> {
    if (event.type !== 'ACTION_REFERENCE_REMOVED' || !event.actionId) return;

    const payload = event.payload as ActionReferenceRemovedPayload;
    if (!payload.sourceRecordId || !payload.targetFieldKey) {
        console.warn(`[action-references.projector] Invalid payload for ACTION_REFERENCE_REMOVED: ${JSON.stringify(payload)}`);
        return;
    }

    await db
        .deleteFrom('action_references')
        .where('action_id', '=', event.actionId)
        .where('source_record_id', '=', payload.sourceRecordId)
        .where('target_field_key', '=', payload.targetFieldKey)
        .execute();
}

/**
 * Main projector dispatcher
 * Called by events.service after emitting reference events
 */
export async function projectActionReference(event: Event): Promise<void> {
    switch (event.type) {
        case 'ACTION_REFERENCE_ADDED':
            await handleReferenceAdded(event);
            break;
        case 'ACTION_REFERENCE_REMOVED':
            await handleReferenceRemoved(event);
            break;
    }
}

/**
 * Get all references for an action
 * Reads from the snapshot table (fast, consistent)
 */
export async function getActionReferences(actionId: string) {
    return db
        .selectFrom('action_references')
        .selectAll()
        .where('action_id', '=', actionId)
        .execute();
}
