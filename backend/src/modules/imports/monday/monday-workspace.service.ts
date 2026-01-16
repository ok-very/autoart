/**
 * Monday Workspace Service
 *
 * CRUD operations for Monday.com workspace configurations.
 * Manages the configuration-driven interpretation of Monday data into AutoArt entities.
 */

import { db } from '@db/client.js';
import type {
    MondayWorkspace,
    NewMondayWorkspace,
    MondayWorkspaceUpdate,
    MondayBoardConfig,
    NewMondayBoardConfig,
    MondayBoardConfigUpdate,
    MondayGroupConfig,
    NewMondayGroupConfig,
    MondayColumnConfig,
    NewMondayColumnConfig,
    MondaySyncState,
} from '@db/schema.js';

import type {
    MondayWorkspaceConfig,
    MondayBoardConfig as MondayBoardConfigType,
    MondayGroupConfig as MondayGroupConfigType,
    MondayColumnConfig as MondayColumnConfigType,
    MondayBoardRole,
    MondayGroupRole,
    MondayColumnSemanticRole,
    MondaySyncDirection,
} from './monday-config.types.js';

// ============================================================================
// WORKSPACE OPERATIONS
// ============================================================================

/**
 * Create a new Monday workspace configuration.
 */
export async function createWorkspace(
    params: NewMondayWorkspace
): Promise<MondayWorkspace> {
    const result = await db
        .insertInto('monday_workspaces')
        .values(params)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Get a workspace by ID.
 */
export async function getWorkspace(id: string): Promise<MondayWorkspace | null> {
    const result = await db
        .selectFrom('monday_workspaces')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();

    return result ?? null;
}

/**
 * Get all workspaces, optionally filtered by user.
 */
export async function listWorkspaces(
    createdBy?: string
): Promise<MondayWorkspace[]> {
    let query = db.selectFrom('monday_workspaces').selectAll();

    if (createdBy) {
        query = query.where('created_by', '=', createdBy);
    }

    return query.orderBy('created_at', 'desc').execute();
}

/**
 * Update a workspace.
 */
export async function updateWorkspace(
    id: string,
    update: MondayWorkspaceUpdate
): Promise<MondayWorkspace> {
    const result = await db
        .updateTable('monday_workspaces')
        .set({ ...update, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Delete a workspace and all its configurations.
 */
export async function deleteWorkspace(id: string): Promise<void> {
    await db.deleteFrom('monday_workspaces').where('id', '=', id).execute();
}

// ============================================================================
// BOARD CONFIG OPERATIONS
// ============================================================================

/**
 * Create a board configuration within a workspace.
 */
export async function createBoardConfig(
    params: NewMondayBoardConfig
): Promise<MondayBoardConfig> {
    const result = await db
        .insertInto('monday_board_configs')
        .values(params)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Get a board configuration by ID.
 */
export async function getBoardConfig(
    id: string
): Promise<MondayBoardConfig | null> {
    const result = await db
        .selectFrom('monday_board_configs')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();

    return result ?? null;
}

/**
 * Get a board configuration by workspace and board ID.
 */
export async function getBoardConfigByBoardId(
    workspaceId: string,
    boardId: string
): Promise<MondayBoardConfig | null> {
    const result = await db
        .selectFrom('monday_board_configs')
        .selectAll()
        .where('workspace_id', '=', workspaceId)
        .where('board_id', '=', boardId)
        .executeTakeFirst();

    return result ?? null;
}

/**
 * List all board configs for a workspace.
 */
export async function listBoardConfigs(
    workspaceId: string
): Promise<MondayBoardConfig[]> {
    return db
        .selectFrom('monday_board_configs')
        .selectAll()
        .where('workspace_id', '=', workspaceId)
        .orderBy('board_name', 'asc')
        .execute();
}

/**
 * List board configs by external board IDs.
 */
export async function listBoardConfigsByExternalIds(
    boardIds: string[]
): Promise<MondayBoardConfig[]> {
    if (boardIds.length === 0) return [];

    return db
        .selectFrom('monday_board_configs')
        .selectAll()
        .where('board_id', 'in', boardIds)
        .execute();
}

/**
 * Update a board configuration.
 */
export async function updateBoardConfig(
    id: string,
    update: MondayBoardConfigUpdate
): Promise<MondayBoardConfig> {
    const result = await db
        .updateTable('monday_board_configs')
        .set({ ...update, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * Delete a board configuration.
 */
export async function deleteBoardConfig(id: string): Promise<void> {
    await db.deleteFrom('monday_board_configs').where('id', '=', id).execute();
}

// ============================================================================
// GROUP CONFIG OPERATIONS
// ============================================================================

/**
 * Create a group configuration within a board config.
 */
export async function createGroupConfig(
    params: NewMondayGroupConfig
): Promise<MondayGroupConfig> {
    const result = await db
        .insertInto('monday_group_configs')
        .values(params)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * List all group configs for a board config.
 */
export async function listGroupConfigs(
    boardConfigId: string
): Promise<MondayGroupConfig[]> {
    return db
        .selectFrom('monday_group_configs')
        .selectAll()
        .where('board_config_id', '=', boardConfigId)
        .orderBy('stage_order', 'asc')
        .execute();
}

/**
 * Batch upsert group configs for a board.
 */
export async function upsertGroupConfigs(
    boardConfigId: string,
    groups: Omit<NewMondayGroupConfig, 'board_config_id'>[]
): Promise<MondayGroupConfig[]> {
    if (groups.length === 0) return [];

    // Delete existing and insert new
    await db
        .deleteFrom('monday_group_configs')
        .where('board_config_id', '=', boardConfigId)
        .execute();

    const values = groups.map((g) => ({
        ...g,
        board_config_id: boardConfigId,
    }));

    return db
        .insertInto('monday_group_configs')
        .values(values)
        .returningAll()
        .execute();
}

// ============================================================================
// COLUMN CONFIG OPERATIONS
// ============================================================================

/**
 * Create a column configuration within a board config.
 */
export async function createColumnConfig(
    params: NewMondayColumnConfig
): Promise<MondayColumnConfig> {
    const result = await db
        .insertInto('monday_column_configs')
        .values(params)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

/**
 * List all column configs for a board config.
 */
export async function listColumnConfigs(
    boardConfigId: string
): Promise<MondayColumnConfig[]> {
    return db
        .selectFrom('monday_column_configs')
        .selectAll()
        .where('board_config_id', '=', boardConfigId)
        .orderBy('column_title', 'asc')
        .execute();
}

/**
 * Batch upsert column configs for a board.
 */
export async function upsertColumnConfigs(
    boardConfigId: string,
    columns: Omit<NewMondayColumnConfig, 'board_config_id'>[]
): Promise<MondayColumnConfig[]> {
    if (columns.length === 0) return [];

    // Delete existing and insert new
    await db
        .deleteFrom('monday_column_configs')
        .where('board_config_id', '=', boardConfigId)
        .execute();

    const values = columns.map((c) => ({
        ...c,
        board_config_id: boardConfigId,
    }));

    return db
        .insertInto('monday_column_configs')
        .values(values)
        .returningAll()
        .execute();
}

// ============================================================================
// SYNC STATE OPERATIONS
// ============================================================================

/**
 * Get or create sync state for a board config.
 */
export async function getOrCreateSyncState(
    boardConfigId: string
): Promise<MondaySyncState> {
    const existing = await db
        .selectFrom('monday_sync_states')
        .selectAll()
        .where('board_config_id', '=', boardConfigId)
        .executeTakeFirst();

    if (existing) return existing;

    return db
        .insertInto('monday_sync_states')
        .values({ board_config_id: boardConfigId })
        .returningAll()
        .executeTakeFirstOrThrow();
}

/**
 * Update sync state after a sync operation.
 */
export async function updateSyncState(
    boardConfigId: string,
    update: {
        last_activity_log_id?: string;
        last_synced_at?: Date;
        sync_cursor?: unknown;
        items_synced?: number;
        errors?: unknown[];
    }
): Promise<MondaySyncState> {
    const result = await db
        .updateTable('monday_sync_states')
        .set({
            ...update,
            updated_at: new Date(),
        })
        .where('board_config_id', '=', boardConfigId)
        .returningAll()
        .executeTakeFirstOrThrow();

    return result;
}

// ============================================================================
// FULL WORKSPACE CONFIG (HYDRATED)
// ============================================================================

/**
 * Get a fully hydrated workspace configuration with all nested configs.
 */
export async function getFullWorkspaceConfig(
    workspaceId: string
): Promise<MondayWorkspaceConfig | null> {
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) return null;

    const boardConfigs = await listBoardConfigs(workspaceId);

    const boards: MondayBoardConfigType[] = await Promise.all(
        boardConfigs.map(async (bc) => {
            const groups = await listGroupConfigs(bc.id);
            const columns = await listColumnConfigs(bc.id);

            return {
                boardId: bc.board_id,
                boardName: bc.board_name,
                role: bc.role as MondayBoardRole,
                linkedProjectId: bc.linked_project_id ?? undefined,
                templateScope: bc.template_scope as MondayBoardConfigType['templateScope'],
                syncDirection: bc.sync_direction as MondaySyncDirection,
                syncEnabled: bc.sync_enabled,
                settings: bc.settings as MondayBoardConfigType['settings'],
                groups: groups.map((g) => ({
                    boardId: bc.board_id,
                    groupId: g.group_id,
                    groupTitle: g.group_title,
                    role: g.role as MondayGroupRole,
                    stageOrder: g.stage_order ?? undefined,
                    stageKind: g.stage_kind as MondayGroupConfigType['stageKind'],
                    subprocessNameOverride: g.subprocess_name_override ?? undefined,
                    settings: g.settings as MondayGroupConfigType['settings'],
                })),
                columns: columns.map((c) => {
                    const settings = (c.settings as Record<string, any>) || {};
                    return {
                        boardId: bc.board_id,
                        columnId: c.column_id,
                        columnTitle: c.column_title,
                        columnType: c.column_type,
                        semanticRole: c.semantic_role as MondayColumnSemanticRole,
                        localFieldKey: c.local_field_key ?? undefined,
                        factKindId: c.fact_kind_id ?? undefined,
                        renderHint: c.render_hint ?? undefined,
                        isRequired: c.is_required,
                        multiValued: c.multi_valued,
                        settings: c.settings as MondayColumnConfigType['settings'],
                        sampleValues: settings.sampleValues as string[] | undefined,
                        inferenceSource: settings.inferenceSource,
                        inferenceConfidence: settings.inferenceConfidence,
                        inferenceReasons: settings.inferenceReasons,
                    };
                }),
            };
        })
    );

    return {
        id: workspace.id,
        name: workspace.name,
        providerAccountId: workspace.provider_account_id ?? undefined,
        defaultProjectId: workspace.default_project_id ?? undefined,
        settings: workspace.settings as MondayWorkspaceConfig['settings'],
        boards,
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
    };
}

/**
 * Save a full workspace configuration (upsert all nested configs).
 */
export async function saveFullWorkspaceConfig(
    config: MondayWorkspaceConfig,
    createdBy?: string
): Promise<MondayWorkspace> {
    // Upsert workspace
    let workspace = await getWorkspace(config.id);

    if (workspace) {
        workspace = await updateWorkspace(config.id, {
            name: config.name,
            provider_account_id: config.providerAccountId,
            default_project_id: config.defaultProjectId,
            settings: config.settings,
        });
    } else {
        workspace = await createWorkspace({
            id: config.id,
            name: config.name,
            provider_account_id: config.providerAccountId,
            default_project_id: config.defaultProjectId,
            settings: config.settings,
            created_by: createdBy,
        });
    }

    // Sync boards
    const existingBoards = await listBoardConfigs(workspace.id);
    const configBoardIds = new Set(config.boards.map((b) => b.boardId));

    // Delete removed boards
    for (const eb of existingBoards) {
        if (!configBoardIds.has(eb.board_id)) {
            await deleteBoardConfig(eb.id);
        }
    }

    // Upsert boards
    for (const boardConfig of config.boards) {
        let boardDbConfig = await getBoardConfigByBoardId(
            workspace.id,
            boardConfig.boardId
        );

        if (boardDbConfig) {
            boardDbConfig = await updateBoardConfig(boardDbConfig.id, {
                board_name: boardConfig.boardName,
                role: boardConfig.role,
                linked_project_id: boardConfig.linkedProjectId,
                template_scope: boardConfig.templateScope,
                sync_direction: boardConfig.syncDirection,
                sync_enabled: boardConfig.syncEnabled,
                settings: boardConfig.settings,
            });
        } else {
            boardDbConfig = await createBoardConfig({
                workspace_id: workspace.id,
                board_id: boardConfig.boardId,
                board_name: boardConfig.boardName,
                role: boardConfig.role,
                linked_project_id: boardConfig.linkedProjectId,
                template_scope: boardConfig.templateScope,
                sync_direction: boardConfig.syncDirection,
                sync_enabled: boardConfig.syncEnabled,
                settings: boardConfig.settings,
            });
        }

        // Upsert groups
        await upsertGroupConfigs(
            boardDbConfig.id,
            boardConfig.groups.map((g) => ({
                group_id: g.groupId,
                group_title: g.groupTitle,
                role: g.role,
                stage_order: g.stageOrder,
                stage_kind: g.stageKind,
                subprocess_name_override: g.subprocessNameOverride,
                settings: g.settings,
            }))
        );

        // Upsert columns
        await upsertColumnConfigs(
            boardDbConfig.id,
            boardConfig.columns.map((c) => ({
                column_id: c.columnId,
                column_title: c.columnTitle,
                column_type: c.columnType,
                semantic_role: c.semanticRole,
                local_field_key: c.localFieldKey,
                fact_kind_id: c.factKindId,
                render_hint: c.renderHint,
                is_required: c.isRequired ?? false,
                multi_valued: c.multiValued ?? false,
                settings: c.settings,
            }))
        );
    }

    return workspace;
}
