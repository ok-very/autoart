/**
 * Monday Workspace Routes
 *
 * API endpoints for managing Monday.com workspace configurations.
 * Supports the configuration-driven import/sync approach.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { getMondayToken } from '../connections.service.js';
import { MondayConnector } from '../connectors/monday-connector.js';

import { inferBoardConfig } from './monday-domain-interpreter.js';
import * as workspaceService from './monday-workspace.service.js';
import { mondaySyncService } from './monday-sync.service.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const WorkspaceIdParamSchema = z.object({
    id: z.string().uuid(),
});

const BoardConfigIdParamSchema = z.object({
    id: z.string().uuid(),
    boardConfigId: z.string().uuid(),
});

const CreateWorkspaceBodySchema = z.object({
    name: z.string().min(1).max(255),
    providerAccountId: z.string().optional(),
    defaultProjectId: z.string().uuid().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
});

const UpdateWorkspaceBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    defaultProjectId: z.string().uuid().nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
});

const BoardRoleSchema = z.enum([
    'project_board',
    'action_board',
    'template_board',
    'reference_board',
    'overview_board',
    'ignore',
]);

const GroupRoleSchema = z.enum([
    'stage',
    'subprocess',
    'backlog',
    'done',
    'archive',
    'template_group',
    'reference_group',
    'ignore',
]);

const ColumnSemanticRoleSchema = z.enum([
    'title', 'description', 'status', 'due_date', 'assignee', 'tags',
    'priority', 'estimate', 'identifier', 'fact', 'note', 'metric',
    'template_name', 'template_key', 'link_to_template', 'link_to_project',
    'link_to_subprocess', 'link_to_action', 'link_to_record', 'dependency',
    'custom', 'ignore',
]);

const AddBoardBodySchema = z.object({
    boardId: z.string().min(1),
    role: BoardRoleSchema.optional(),
    linkedProjectId: z.string().uuid().optional(),
    templateScope: z.enum([
        'project_template',
        'subprocess_template',
        'action_template',
        'record_template',
    ]).optional(),
    syncDirection: z.enum(['pull', 'push', 'both', 'none']).optional(),
    syncEnabled: z.boolean().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
});

const UpdateBoardConfigBodySchema = z.object({
    role: BoardRoleSchema.optional(),
    linkedProjectId: z.string().uuid().nullable().optional(),
    syncDirection: z.enum(['pull', 'push', 'both', 'none']).optional(),
    syncEnabled: z.boolean().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
});

const UpdateGroupConfigsBodySchema = z.object({
    groups: z.array(z.object({
        groupId: z.string(),
        groupTitle: z.string(),
        role: GroupRoleSchema,
        stageOrder: z.number().int().optional(),
        stageKind: z.enum(['todo', 'in_progress', 'blocked', 'done', 'archive']).optional(),
        subprocessNameOverride: z.string().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
    })),
});

const UpdateColumnConfigsBodySchema = z.object({
    columns: z.array(z.object({
        columnId: z.string(),
        columnTitle: z.string(),
        columnType: z.string(),
        semanticRole: ColumnSemanticRoleSchema,
        localFieldKey: z.string().optional(),
        factKindId: z.string().uuid().optional(),
        renderHint: z.string().optional(),
        isRequired: z.boolean().optional(),
        multiValued: z.boolean().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        sampleValues: z.array(z.string()).optional(),
    })),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function mondayWorkspaceRoutes(app: FastifyInstance) {
    // ========================================================================
    // WORKSPACE CRUD
    // ========================================================================

    /**
     * List all workspaces
     */
    app.get('/workspaces', async (request, reply) => {
        const userId = (request.user as { id?: string })?.id;
        const workspaces = await workspaceService.listWorkspaces(userId);
        return reply.send({ workspaces });
    });

    /**
     * Create a new workspace
     */
    app.post('/workspaces', async (request, reply) => {
        const body = CreateWorkspaceBodySchema.parse(request.body);
        const userId = (request.user as { id?: string })?.id;

        const workspace = await workspaceService.createWorkspace({
            name: body.name,
            provider_account_id: body.providerAccountId,
            default_project_id: body.defaultProjectId,
            settings: body.settings,
            created_by: userId,
        });

        return reply.status(201).send(workspace);
    });

    /**
     * Get a workspace with full configuration
     */
    app.get('/workspaces/:id', async (request, reply) => {
        const { id } = WorkspaceIdParamSchema.parse(request.params);
        const config = await workspaceService.getFullWorkspaceConfig(id);

        if (!config) {
            return reply.status(404).send({ error: 'Workspace not found' });
        }

        return reply.send(config);
    });

    /**
     * Update a workspace
     */
    app.patch('/workspaces/:id', async (request, reply) => {
        const { id } = WorkspaceIdParamSchema.parse(request.params);
        const body = UpdateWorkspaceBodySchema.parse(request.body);

        try {
            const workspace = await workspaceService.updateWorkspace(id, {
                name: body.name,
                default_project_id: body.defaultProjectId ?? undefined,
                settings: body.settings,
            });
            return reply.send(workspace);
        } catch {
            return reply.status(404).send({ error: 'Workspace not found' });
        }
    });

    /**
     * Delete a workspace
     */
    app.delete('/workspaces/:id', async (request, reply) => {
        const { id } = WorkspaceIdParamSchema.parse(request.params);
        await workspaceService.deleteWorkspace(id);
        return reply.status(204).send();
    });

    // ========================================================================
    // BOARD CONFIGURATION
    // ========================================================================

    /**
     * Add a board to workspace (with optional auto-inference)
     */
    app.post('/workspaces/:id/boards', async (request, reply) => {
        const { id } = WorkspaceIdParamSchema.parse(request.params);
        const body = AddBoardBodySchema.parse(request.body);
        const userId = (request.user as { id?: string })?.id;

        // Check workspace exists
        const workspace = await workspaceService.getWorkspace(id);
        if (!workspace) {
            return reply.status(404).send({ error: 'Workspace not found' });
        }

        // Fetch board schema from Monday
        const token = await getMondayToken(userId ?? undefined);
        const connector = new MondayConnector(token);
        const schema = await connector.discoverBoardSchema(body.boardId);

        // Infer configuration if role not provided
        const inferred = inferBoardConfig(
            schema.boardId,
            schema.boardName,
            schema.groups.map((g) => ({ id: g.id, title: g.title })),
            schema.columns.map((c) => ({ id: c.id, title: c.title, type: c.type }))
        );

        // Create board config with overrides
        const boardConfig = await workspaceService.createBoardConfig({
            workspace_id: id,
            board_id: body.boardId,
            board_name: schema.boardName,
            role: body.role ?? inferred.role,
            linked_project_id: body.linkedProjectId,
            template_scope: body.templateScope,
            sync_direction: body.syncDirection ?? 'pull',
            sync_enabled: body.syncEnabled ?? true,
            settings: body.settings,
        });

        // Create group configs from inference
        await workspaceService.upsertGroupConfigs(
            boardConfig.id,
            inferred.groups.map((g) => ({
                group_id: g.groupId,
                group_title: g.groupTitle,
                role: g.role,
                stage_order: g.stageOrder,
                stage_kind: g.stageKind,
            }))
        );

        // Create column configs from inference
        await workspaceService.upsertColumnConfigs(
            boardConfig.id,
            inferred.columns.map((c) => ({
                column_id: c.columnId,
                column_title: c.columnTitle,
                column_type: c.columnType,
                semantic_role: c.semanticRole,
                settings: {
                    ...(c.settings || {}),
                    sampleValues: c.sampleValues,
                    inferenceSource: c.inferenceSource,
                    inferenceConfidence: c.inferenceConfidence,
                    inferenceReasons: c.inferenceReasons,
                },
            }))
        );

        // Return full board config with nested data
        const groups = await workspaceService.listGroupConfigs(boardConfig.id);
        const columns = await workspaceService.listColumnConfigs(boardConfig.id);

        return reply.status(201).send({
            ...boardConfig,
            groups,
            columns,
        });
    });

    /**
     * List boards in a workspace
     */
    app.get('/workspaces/:id/boards', async (request, reply) => {
        const { id } = WorkspaceIdParamSchema.parse(request.params);
        const boards = await workspaceService.listBoardConfigs(id);
        return reply.send({ boards });
    });

    /**
     * Get board config with groups and columns
     */
    app.get('/workspaces/:id/boards/:boardConfigId', async (request, reply) => {
        const { boardConfigId } = BoardConfigIdParamSchema.parse(request.params);

        const boardConfig = await workspaceService.getBoardConfig(boardConfigId);
        if (!boardConfig) {
            return reply.status(404).send({ error: 'Board config not found' });
        }

        const groups = await workspaceService.listGroupConfigs(boardConfigId);
        const columns = await workspaceService.listColumnConfigs(boardConfigId);

        return reply.send({
            ...boardConfig,
            groups,
            columns,
        });
    });

    /**
     * Update board config
     */
    app.patch('/workspaces/:id/boards/:boardConfigId', async (request, reply) => {
        const { boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const body = UpdateBoardConfigBodySchema.parse(request.body);

        try {
            const boardConfig = await workspaceService.updateBoardConfig(boardConfigId, {
                role: body.role,
                linked_project_id: body.linkedProjectId ?? undefined,
                sync_direction: body.syncDirection,
                sync_enabled: body.syncEnabled,
                settings: body.settings,
            });
            return reply.send(boardConfig);
        } catch {
            return reply.status(404).send({ error: 'Board config not found' });
        }
    });

    /**
     * Delete board config
     */
    app.delete('/workspaces/:id/boards/:boardConfigId', async (request, reply) => {
        const { boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        await workspaceService.deleteBoardConfig(boardConfigId);
        return reply.status(204).send();
    });

    /**
     * Update group configurations for a board
     */
    app.put('/workspaces/:id/boards/:boardConfigId/groups', async (request, reply) => {
        const { boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const body = UpdateGroupConfigsBodySchema.parse(request.body);

        const groups = await workspaceService.upsertGroupConfigs(
            boardConfigId,
            body.groups.map((g) => ({
                group_id: g.groupId,
                group_title: g.groupTitle,
                role: g.role,
                stage_order: g.stageOrder,
                stage_kind: g.stageKind,
                subprocess_name_override: g.subprocessNameOverride,
                settings: g.settings,
            }))
        );

        return reply.send({ groups });
    });

    /**
     * Update column configurations for a board
     */
    app.put('/workspaces/:id/boards/:boardConfigId/columns', async (request, reply) => {
        const { boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const body = UpdateColumnConfigsBodySchema.parse(request.body);

        const columns = await workspaceService.upsertColumnConfigs(
            boardConfigId,
            body.columns.map((c) => ({
                column_id: c.columnId,
                column_title: c.columnTitle,
                column_type: c.columnType,
                semantic_role: c.semanticRole,
                local_field_key: c.localFieldKey,
                fact_kind_id: c.factKindId,
                render_hint: c.renderHint,
                is_required: c.isRequired ?? false,
                multi_valued: c.multiValued ?? false,
                settings: {
                    ...c.settings,
                    sampleValues: c.sampleValues,
                },
            }))
        );

        return reply.send({ columns });
    });

    // ========================================================================
    // DISCOVERY & PREVIEW
    // ========================================================================

    /**
     * Discover a board's schema without adding it to workspace
     */
    app.post('/discover-board', async (request, reply) => {
        const body = z.object({ boardId: z.string().min(1) }).parse(request.body);
        const userId = (request.user as { id?: string })?.id;

        const token = await getMondayToken(userId ?? undefined);
        const connector = new MondayConnector(token);
        const schema = await connector.discoverBoardSchema(body.boardId);

        // Return schema with inferred configuration
        const inferred = inferBoardConfig(
            schema.boardId,
            schema.boardName,
            schema.groups.map((g) => ({ id: g.id, title: g.title })),
            schema.columns.map((c) => ({ id: c.id, title: c.title, type: c.type }))
        );

        return reply.send({
            schema,
            inferredConfig: inferred,
        });
    });


    // ========================================================================
    // SYNC OPERATIONS
    // ========================================================================

    /**
     * Synchronize a board
     */
    app.post('/workspaces/:id/boards/:boardConfigId/sync', async (request, reply) => {
        const { boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const userId = (request.user as { id?: string })?.id;

        if (!userId) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const result = await mondaySyncService.syncBoard(boardConfigId, userId);
        return reply.send(result);
    });

    /**
     * Get sync status
     */
    app.get('/workspaces/:id/boards/:boardConfigId/sync/status', async (request, reply) => {
        const { boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const status = await mondaySyncService.getSyncStatus(boardConfigId);
        return reply.send(status || { sync_status: 'idle' });
    });
    /**
     * List board configurations by external IDs
     */
    app.get('/boards/configs', async (request, reply) => {
        const { ids } = request.query as { ids: string };
        if (!ids) {
            return reply.code(400).send({ message: 'ids query param required' });
        }

        const boardIds = ids.split(',');
        const configs = await workspaceService.listBoardConfigsByExternalIds(boardIds);

        // Map to domain entity (camelCase)
        // We need nested groups/columns for full config?
        // Step 2 only needs roles. But subsequent steps need groups/columns.
        // Let's fetch full details for each.
        // Optimization: listBoardConfigsByExternalIds only gives board rows.
        // We should probably iterate and get full config for each?
        // OR just map the board props for now if that's all we need.
        // But headers might need full info. 
        // Let's map board props + fetch children if possible?
        // For now, let's just map board props.

        const mapped = await Promise.all(configs.map(async (bc) => {
            // Fetch children for complete config?
            // Yes, safer for wizard.
            const groups = await workspaceService.listGroupConfigs(bc.id);
            const columns = await workspaceService.listColumnConfigs(bc.id);

            return {
                id: bc.id, // DB ID
                boardId: bc.board_id,
                boardName: bc.board_name,
                role: bc.role,
                workspaceId: bc.workspace_id, // Needed for update url
                linkedProjectId: bc.linked_project_id ?? undefined,
                templateScope: bc.template_scope,
                syncDirection: bc.sync_direction,
                syncEnabled: bc.sync_enabled,
                settings: bc.settings,
                groups: groups.map((g) => ({
                    boardId: bc.board_id,
                    groupId: g.group_id,
                    groupTitle: g.group_title,
                    role: g.role,
                    stageOrder: g.stage_order ?? undefined,
                    stageKind: g.stage_kind ?? undefined,
                    subprocessNameOverride: g.subprocess_name_override ?? undefined,
                    settings: g.settings,
                })),
                columns: columns.map((c) => ({
                    boardId: bc.board_id,
                    columnId: c.column_id,
                    columnTitle: c.column_title,
                    columnType: c.column_type,
                    semanticRole: c.semantic_role,
                    localFieldKey: c.local_field_key ?? undefined,
                    factKindId: c.fact_kind_id ?? undefined,
                    renderHint: c.render_hint ?? undefined,
                    isRequired: c.is_required,
                    multiValued: c.multi_valued,
                    settings: c.settings,
                })),
            };
        }));

        return reply.send(mapped);
    });
}

export default mondayWorkspaceRoutes;
