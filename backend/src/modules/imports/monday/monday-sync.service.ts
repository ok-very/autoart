import { randomUUID } from 'crypto';
import { db } from '@db/client.js';
import { getMondayToken } from '../connections.service.js';
import { MondayConnector } from '../connectors/monday-connector.js';
import { interpretMondayData } from './monday-domain-interpreter.js';
import * as mondayWorkspaceService from './monday-workspace.service.js';


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

            // --- PHASE 7: Auto-Subscribe to Webhooks ---
            await this.ensureWebhookSubscription(boardConfig, connector);

            // Fetch the full board hierarchy
            // DB column is board_id
            const boardNode = await connector.fetchBoard(boardConfig.board_id);

            // 4. Interpret Data -> Import Plan
            // ... rest of the method ...
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

    /**
     * Ensure a webhook is subscribed for the board.
     */
    private async ensureWebhookSubscription(
        boardConfig: any, // Typed as any to avoid importing DB types if not needed, but ideally MondayBoardConfig
        connector: MondayConnector
    ) {
        // Skip if local env without explicit URL
        const appUrl = process.env.APP_URL;
        if (!appUrl || appUrl.includes('localhost')) {
            // console.warn('Skipping webhook registration: APP_URL is localhost or missing');
            return;
        }

        // Check if already registered in our config
        const settings = boardConfig.settings as { webhookId?: number } | undefined;
        if (settings?.webhookId) {
            return;
        }

        try {
            const webhookUrl = `${appUrl}/api/webhooks/monday`;
            // Subscribe to 'change_column_value'
            // We could also subscribe to 'create_item' later
            const webhookId = await connector.createWebhook(
                boardConfig.board_id,
                webhookUrl,
                'change_column_value'
            );

            // Persist the webhook ID
            await mondayWorkspaceService.updateBoardConfig(boardConfig.id, {
                settings: {
                    ...(settings || {}),
                    webhookId
                }
            });
            console.log(`Registered Monday webhook ${webhookId} for board ${boardConfig.board_id}`);
        } catch (err) {
            console.error(`Failed to register webhook for board ${boardConfig.board_id}:`, err);
            // Don't fail the sync, just log
        }
    }

    /**
     * Handle incoming webhook event.
     */
    async handleWebhookEvent(event: any) {
        if (event.type !== 'change_column_value') {
            return;
        }

        const { boardId, pulseId, columnId, value } = event;
        // value structure depends on column type. 
        // For text: { value: "New Text" } ? No, Monday sends weird stuff.
        // Actually, 'value' in webhook payload is often a small object or null.
        // However, 'create_webhook' documentation says it sends 'value'.
        // To be safe and robust, it is often better to FETCH the item fresh using the connector
        // because the webhook payload 'value' format is inconsistent and complex to parse blindly.
        // BUT for V1, let's try to interpret if possible, or trigger a single-item sync.

        // Approach: Trigger Single Item Sync (safer, cleaner)
        // 1. Get Board Config
        const boardConfig = await mondayWorkspaceService.getBoardConfigByExternalBoardId(String(boardId));
        if (!boardConfig) {
            console.warn(`Webhook received for unknown board ${boardId}`);
            return;
        }

        // 2. Map Monday Item to Local Action
        const mapping = await db
            .selectFrom('external_source_mappings')
            .selectAll()
            .where('provider', '=', 'monday')
            .where('external_id', '=', String(pulseId))
            .executeTakeFirst();

        if (!mapping) {
            return; // Item not imported yet
        }

        // 3. Fetch Fresh Data (Single Item)
        // We need a token. Getting it from workspace is a bit roundabout.
        // Optimization: We could store token? No, sensitive.
        // We must fetch workspace to get account ID to get token.
        /*
        const workspace = await mondayWorkspaceService.getWorkspace(boardConfig.workspace_id);
        if (!workspace) return;
        
        const token = await getMondayToken(workspace.provider_account_id ?? undefined);
        if (!token) return;

        // const connector = new MondayConnector(token);
        // TODO: Implement fetchItem(id) in MondayConnector for robust updates
        */

        // We need a method to fetch a single item. 
        // traverseHierarchy scans whole board. 
        // MondayConnector doesn't expose `getItem(id)` yet.
        // Let's rely on the payload for now or add `getItem`.
        // The payload 'value' is actually the raw value structure.

        // Let's assume we update JUST that column if we can map it.
        const targetColumn = await db
            .selectFrom('monday_column_configs')
            .select(['local_field_key'])
            .where('board_config_id', '=', boardConfig.id)
            .where('column_id', '=', columnId)
            .executeTakeFirst();

        if (!targetColumn || !targetColumn.local_field_key) {
            return; // Column not mapped
        }

        // Parse value. Monday webhook values are .... special.
        // e.g. Name: { name: "New Name" }
        // Status: { index: 1, label: "Done" }
        // We need the `value` object.

        // For V1 simplest MVP: If we receive a change, we queue a sync or update if simple.
        // Let's try to update safely.

        // We need to interpret the value.
        // Since we don't have the sophisticated interpreter here for just one value,
        // and we want to avoid `fetchBoard`, let's just Log and TODO properly.
        // Actually, let's try to fetch the item via `fetchItemsPage` with limit 1?
        // `fetchItemsPage` takes a cursor. It doesn't take Item IDs.
        // MondayConnector needs `getItem(id)`.

        // For now, I will implement a basic "Update Title" handling if columnId is 'name' or title.
        // And simple text.

        let newValue: any = null;
        if (value && typeof value === 'object') {
            // Attempt to extract meaningful value
            // Text columns: value.value might be string? 
            // Status: value.label?
            if ('label' in value) newValue = value.label;
            else if ('text' in value) newValue = value.text;
            else if ('name' in value) newValue = value.name;
            else if ('value' in value) newValue = value.value;
            else newValue = JSON.stringify(value);
        } else {
            newValue = value;
        }

        // Update DB
        // We need to merge this into existing field_bindings.
        const action = await db
            .selectFrom('actions')
            .select(['id', 'field_bindings'])
            .where('id', '=', mapping.local_entity_id)
            .executeTakeFirst();

        if (!action) return;

        let bindings: any[] = [];
        const bindingsRaw = action.field_bindings as string | any[] | null;

        try {
            bindings = typeof action.field_bindings === 'string'
                ? JSON.parse(action.field_bindings)
                : action.field_bindings;

            if (!Array.isArray(bindings)) {
                console.warn(`[MondaySync] Action ${action.id} field_bindings parsed but not array. Resetting to empty.`);
                bindings = [];
            }
        } catch (err) {
            console.error(`[MondaySync] Failed to parse field_bindings for action ${action.id}. Preserving raw value.`, {
                error: err,
                rawValue: bindingsRaw
            });
            // Abort update to prevent data loss
            return;
        }

        // Remove old binding for this key
        bindings = bindings.filter((b: any) => b.fieldKey !== targetColumn.local_field_key);
        // Add new
        bindings.push({ fieldKey: targetColumn.local_field_key, value: newValue });

        await db
            .updateTable('actions')
            .set({ field_bindings: JSON.stringify(bindings) })
            .where('id', '=', mapping.local_entity_id)
            .execute();

        console.log(`[Webhook] Updated Action ${mapping.local_entity_id} field ${targetColumn.local_field_key}`);
    }

    async getSyncStatus(boardConfigId: string) {
        return mondayWorkspaceService.getOrCreateSyncState(boardConfigId);
    }
}

export const mondaySyncService = new MondaySyncService();
