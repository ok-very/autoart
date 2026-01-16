
import { randomUUID } from 'crypto';
import { db } from '@db/client.js';
import { MondayConnector } from '../connectors/monday-connector.js';
import { interpretMondayData } from './monday-domain-interpreter.js';
import * as mondayWorkspaceService from './monday-workspace.service.js';
import { getMondayToken } from '../connections.service.js';

interface SyncResult {
    boardId: string;
    itemsProcessed: number;
    itemsUpdated: number;
    itemsCreated: number;
    errors: string[];
}

export class MondaySyncService {
    /**
     * Synchronize a Monday board based on its configuration.
     * Fetches latest data, interprets it, and updates local entities (Actions).
     * 
     * STRATEGY (V1): UPDATE ONLY
     * - We only update items that already have a mapping in `external_source_mappings`.
     * - New items on Monday are IGNORED until explicitly imported via the Wizard.
     *   (This prevents creating orphans without a target Project context).
     */
    async syncBoard(boardConfigId: string, userId: string): Promise<SyncResult> {
        const result: SyncResult = {
            boardId: boardConfigId,
            itemsProcessed: 0,
            itemsUpdated: 0,
            itemsCreated: 0,
            errors: [],
        };

        // Use userId for future event logging features
        void userId;

        try {
            // 1. Get Board Configuration
            const boardConfig = await mondayWorkspaceService.getBoardConfig(boardConfigId);
            if (!boardConfig) {
                throw new Error(`Board config ${boardConfigId} not found`);
            }

            // 2. Get Workspace & Token
            const workspace = await mondayWorkspaceService.getWorkspace(boardConfig.workspace_id);
            if (!workspace) throw new Error('Workspace not found');

            // Get token using connections service (handles fallback logic)
            const token = await getMondayToken(workspace.provider_account_id ?? undefined);
            if (!token) throw new Error('Monday authentication token not found');

            // 3. Fetch Board Data
            const connector = new MondayConnector(token);
            // Fetch the full board hierarchy
            // DB column is board_id
            const boardNode = await connector.fetchBoard(boardConfig.board_id);

            // 4. Interpret Data -> Import Plan
            // We use a transient session ID for this sync operation
            const syncSessionId = randomUUID();

            // Need the full config tree for interpretation
            const workspaceConfig = await mondayWorkspaceService.getFullWorkspaceConfig(workspace.id);
            if (!workspaceConfig) throw new Error('Failed to load workspace configuration');

            // Pass array of nodes (just one board)
            const plan = interpretMondayData([boardNode], workspaceConfig, syncSessionId);

            // 5. Apply Changes (Update Only)
            for (const item of plan.items) {
                result.itemsProcessed++;

                // Retrieve Monday ID from metadata
                const mondayMeta = (item.metadata as any)?.monday;
                const externalId = mondayMeta?.id;

                if (!externalId) continue;

                // Check for existing mapping
                const mapping = await db
                    .selectFrom('external_source_mappings')
                    .select(['local_entity_id'])
                    .where('provider', '=', 'monday')
                    .where('external_id', '=', externalId)
                    .executeTakeFirst();

                if (mapping) {
                    // --- UPDATE ---
                    // We update 'field_bindings' on the Action.
                    const fieldBindings = [
                        { fieldKey: 'title', value: item.title },
                        ...item.fieldRecordings.map((fr) => ({
                            fieldKey: fr.fieldName,
                            value: fr.value,
                        })),
                    ];

                    await db
                        .updateTable('actions')
                        .set({
                            field_bindings: JSON.stringify(fieldBindings),
                        })
                        .where('id', '=', mapping.local_entity_id)
                        .execute();

                    result.itemsUpdated++;
                } else {
                    // --- CREATE ---
                    // Skipped in V1. Use Import Wizard to add new items.
                }
            }

            // 6. Update Sync State in DB
            await mondayWorkspaceService.updateSyncState(boardConfig.id, {
                last_synced_at: new Date(),
                errors: [], // Clear errors on success
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            result.errors.push(errorMessage);

            // Record error state
            try {
                await mondayWorkspaceService.getOrCreateSyncState(boardConfigId);
                await mondayWorkspaceService.updateSyncState(boardConfigId, {
                    errors: [errorMessage],
                });
            } catch (stateErr) {
                console.error('Failed to update sync state:', stateErr);
            }

            throw err; // Re-throw to caller
        }

        return result;
    }

    async getSyncStatus(boardConfigId: string) {
        return mondayWorkspaceService.getOrCreateSyncState(boardConfigId);
    }
}

export const mondaySyncService = new MondaySyncService();
