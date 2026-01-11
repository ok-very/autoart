/**
 * Sync Service
 *
 * Manages external source mappings for bidirectional sync.
 * Tracks links between local entities and external sources (Monday, Asana, etc.)
 */

import type { Provider } from './connections.service.js';
import { db } from '../../db/client.js';
import type {
    ExternalSourceMapping,
    NewExternalSourceMapping,
} from '../../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncResult {
    success: boolean;
    added: number;
    updated: number;
    conflicts: Array<{
        localEntityId: string;
        externalId: string;
        reason: string;
    }>;
}

// ============================================================================
// MAPPING CRUD
// ============================================================================

/**
 * Create a mapping between an external entity and a local entity.
 */
export async function createMapping(params: {
    provider: Provider;
    externalId: string;
    externalType: string;
    localEntityType: string;
    localEntityId: string;
    columnMappings?: Record<string, string>;
}): Promise<ExternalSourceMapping> {
    const mapping: NewExternalSourceMapping = {
        provider: params.provider,
        external_id: params.externalId,
        external_type: params.externalType,
        local_entity_type: params.localEntityType,
        local_entity_id: params.localEntityId,
        column_mappings: params.columnMappings ?? {},
    };

    const result = await db
        .insertInto('external_source_mappings')
        .values(mapping)
        .onConflict((oc) =>
            oc.columns(['provider', 'external_id']).doUpdateSet({
                local_entity_type: mapping.local_entity_type,
                local_entity_id: mapping.local_entity_id,
                column_mappings: mapping.column_mappings,
            })
        )
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Get mapping by local entity ID.
 */
export async function getMappingByLocalEntity(
    localEntityId: string
): Promise<ExternalSourceMapping | null> {
    const result = await db
        .selectFrom('external_source_mappings')
        .selectAll()
        .where('local_entity_id', '=', localEntityId)
        .executeTakeFirst();

    return result ?? null;
}

/**
 * Get mapping by external ID.
 */
export async function getMappingByExternalId(
    provider: Provider,
    externalId: string
): Promise<ExternalSourceMapping | null> {
    const result = await db
        .selectFrom('external_source_mappings')
        .selectAll()
        .where('provider', '=', provider)
        .where('external_id', '=', externalId)
        .executeTakeFirst();

    return result ?? null;
}

/**
 * Get all mappings for a provider.
 */
export async function getMappingsForProvider(
    provider: Provider
): Promise<ExternalSourceMapping[]> {
    const results = await db
        .selectFrom('external_source_mappings')
        .selectAll()
        .where('provider', '=', provider)
        .where('sync_enabled', '=', true)
        .execute();

    return results;
}

/**
 * Update sync status after successful sync.
 */
export async function updateSyncStatus(
    mappingId: string,
    syncHash: string
): Promise<void> {
    await db
        .updateTable('external_source_mappings')
        .set({
            last_synced_at: new Date(),
            last_sync_hash: syncHash,
        })
        .where('id', '=', mappingId)
        .execute();
}

/**
 * Toggle sync enabled/disabled for a mapping.
 */
export async function setSyncEnabled(
    mappingId: string,
    enabled: boolean
): Promise<void> {
    await db
        .updateTable('external_source_mappings')
        .set({ sync_enabled: enabled })
        .where('id', '=', mappingId)
        .execute();
}

/**
 * Delete a mapping.
 */
export async function deleteMapping(mappingId: string): Promise<void> {
    await db
        .deleteFrom('external_source_mappings')
        .where('id', '=', mappingId)
        .execute();
}

// ============================================================================
// SYNC OPERATIONS (STUBS)
// ============================================================================

/**
 * Sync a local entity from its external source.
 * TODO: Implement actual sync logic per provider.
 */
export async function syncFromExternal(
    mappingId: string
): Promise<SyncResult> {
    const mapping = await db
        .selectFrom('external_source_mappings')
        .selectAll()
        .where('id', '=', mappingId)
        .executeTakeFirst();

    if (!mapping) {
        return {
            success: false,
            added: 0,
            updated: 0,
            conflicts: [{ localEntityId: '', externalId: '', reason: 'Mapping not found' }],
        };
    }

    // TODO: Implement provider-specific sync logic
    // 1. Fetch external data using connector
    // 2. Compare with local data
    // 3. Apply changes or report conflicts

    return {
        success: true,
        added: 0,
        updated: 0,
        conflicts: [],
    };
}
