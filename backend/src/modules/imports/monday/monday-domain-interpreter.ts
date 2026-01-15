/**
 * Monday Domain Interpreter
 *
 * Configuration-driven interpreter that converts Monday.com data nodes
 * into AutoArt ImportPlan entities based on workspace configuration.
 *
 * Processing Phases:
 * 1. Index & Hydrate: Build maps and attach configs to nodes
 * 2. Containers: Create project, subprocess, stage containers from boards/groups
 * 3. Items: Convert items to ImportPlanItems based on board/group role
 * 4. Columns: Map column values to field recordings
 * 5. Links: Collect pending link references for post-import resolution
 */

import type {
    MondayDataNode,
    MondayColumnValue,
} from '../connectors/monday-connector.js';
import type {
    ImportPlan,
    ImportPlanContainer,
    ImportPlanItem,
    FieldRecording,
    PendingLinkReference,
} from '../types.js';
import type {
    MondayWorkspaceConfig,
    MondayBoardConfig,
    MondayGroupConfig,
    MondayColumnConfig,
    MondayBoardRole,
    MondayGroupRole,
    MondayColumnSemanticRole,
} from './monday-config.types.js';
import { DEFAULT_INFERENCE_HEURISTICS as heuristics } from './monday-config.types.js';

interface InterpreterContext {
    workspace: MondayWorkspaceConfig;
    boardConfigs: Map<string, MondayBoardConfig>;
    groupConfigs: Map<string, MondayGroupConfig>;
    columnConfigs: Map<string, Map<string, MondayColumnConfig>>;
    containerTempIds: Map<string, string>; // externalId -> tempId
    itemTempIds: Map<string, string>; // externalId -> tempId
}

// ============================================================================
// MAIN INTERPRETER
// ============================================================================

/**
 * Interpret Monday data nodes into an ImportPlan using workspace configuration.
 */
export function interpretMondayData(
    nodes: MondayDataNode[],
    workspace: MondayWorkspaceConfig,
    sessionId: string
): ImportPlan {
    const ctx = buildContext(workspace);
    const containers: ImportPlanContainer[] = [];
    const items: ImportPlanItem[] = [];
    const pendingLinks: PendingLinkReference[] = [];

    // Phase 1: Index nodes by type
    const boardNodes: MondayDataNode[] = [];
    const groupNodes: MondayDataNode[] = [];
    const itemNodes: MondayDataNode[] = [];
    const subitemNodes: MondayDataNode[] = [];

    for (const node of nodes) {
        switch (node.type) {
            case 'board':
                boardNodes.push(node);
                break;
            case 'group':
                groupNodes.push(node);
                break;
            case 'item':
                itemNodes.push(node);
                break;
            case 'subitem':
                subitemNodes.push(node);
                break;
        }
    }

    // Phase 2: Create containers from boards and groups
    for (const boardNode of boardNodes) {
        const boardConfig = ctx.boardConfigs.get(boardNode.id);
        if (!boardConfig || boardConfig.role === 'ignore') continue;

        const container = createContainerFromBoard(boardNode, boardConfig, ctx);
        if (container) {
            containers.push(container);
        }
    }

    for (const groupNode of groupNodes) {
        const boardId = groupNode.metadata.boardId;
        if (!boardId) continue;

        const boardConfig = ctx.boardConfigs.get(boardId);
        if (!boardConfig || boardConfig.role === 'ignore') continue;

        const groupKey = `${boardId}:${groupNode.id}`;
        const groupConfig = ctx.groupConfigs.get(groupKey);
        if (groupConfig?.role === 'ignore') continue;

        const container = createContainerFromGroup(
            groupNode,
            boardConfig,
            groupConfig,
            ctx
        );
        if (container) {
            containers.push(container);
        }
    }

    // Phase 3: Create items
    for (const itemNode of itemNodes) {
        const boardId = itemNode.metadata.boardId;
        if (!boardId) continue;

        const boardConfig = ctx.boardConfigs.get(boardId);
        if (!boardConfig || boardConfig.role === 'ignore') continue;

        const groupKey = `${boardId}:${itemNode.metadata.groupId}`;
        const groupConfig = ctx.groupConfigs.get(groupKey);
        if (groupConfig?.role === 'ignore') continue;

        const columnConfigMap = ctx.columnConfigs.get(boardId);

        const { item, links } = createItemFromNode(
            itemNode,
            boardConfig,
            groupConfig,
            columnConfigMap,
            ctx
        );
        if (item) {
            items.push(item);
            pendingLinks.push(...links);
        }
    }

    // Phase 4: Create subitems
    for (const subitemNode of subitemNodes) {
        const boardId = subitemNode.metadata.boardId;
        if (!boardId) continue;

        const boardConfig = ctx.boardConfigs.get(boardId);
        if (!boardConfig) continue;

        // Check how to treat subitems
        const treatAs = boardConfig.settings?.treatSubitemsAs ?? 'child_actions';
        if (treatAs === 'ignore') continue;

        const columnConfigMap = ctx.columnConfigs.get(boardId);

        const { item, links } = createSubitemFromNode(
            subitemNode,
            boardConfig,
            columnConfigMap,
            ctx
        );
        if (item) {
            items.push(item);
            pendingLinks.push(...links);
        }
    }

    return {
        sessionId,
        containers,
        items,
        validationIssues: [],
        classifications: [],
        pendingLinks: pendingLinks.length > 0 ? pendingLinks : undefined,
    };
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

function buildContext(workspace: MondayWorkspaceConfig): InterpreterContext {
    const boardConfigs = new Map<string, MondayBoardConfig>();
    const groupConfigs = new Map<string, MondayGroupConfig>();
    const columnConfigs = new Map<string, Map<string, MondayColumnConfig>>();

    for (const board of workspace.boards) {
        boardConfigs.set(board.boardId, board);

        const colMap = new Map<string, MondayColumnConfig>();
        for (const col of board.columns) {
            colMap.set(col.columnId, col);
        }
        columnConfigs.set(board.boardId, colMap);

        for (const group of board.groups) {
            const key = `${board.boardId}:${group.groupId}`;
            groupConfigs.set(key, group);
        }
    }

    return {
        workspace,
        boardConfigs,
        groupConfigs,
        columnConfigs,
        containerTempIds: new Map(),
        itemTempIds: new Map(),
    };
}

// ============================================================================
// CONTAINER CREATION
// ============================================================================

function createContainerFromBoard(
    node: MondayDataNode,
    config: MondayBoardConfig,
    ctx: InterpreterContext
): ImportPlanContainer | null {
    const tempId = `board:${node.id}`;
    ctx.containerTempIds.set(node.id, tempId);

    const roleToType: Record<MondayBoardRole, ImportPlanContainer['type'] | null> = {
        project_board: 'project',
        action_board: 'subprocess',
        template_board: 'project',
        reference_board: 'project',
        overview_board: null,
        ignore: null,
    };

    const type = roleToType[config.role];
    if (!type) return null;

    return {
        tempId,
        type,
        title: node.name,
        parentTempId: null,
        definitionName: config.role === 'template_board' ? 'Template' : undefined,
    };
}

function createContainerFromGroup(
    node: MondayDataNode,
    boardConfig: MondayBoardConfig,
    groupConfig: MondayGroupConfig | undefined,
    ctx: InterpreterContext
): ImportPlanContainer | null {
    const boardTempId = ctx.containerTempIds.get(node.metadata.boardId!);
    const tempId = `group:${node.metadata.boardId}:${node.id}`;
    ctx.containerTempIds.set(`${node.metadata.boardId}:${node.id}`, tempId);

    const role = groupConfig?.role ?? boardConfig.settings?.defaultGroupRole ?? 'subprocess';

    const roleToType: Record<MondayGroupRole, ImportPlanContainer['type'] | null> = {
        stage: 'stage',
        subprocess: 'subprocess',
        backlog: 'subprocess',
        done: 'subprocess',
        template_group: 'subprocess',
        ignore: null,
    };

    const type = roleToType[role];
    if (!type) return null;

    return {
        tempId,
        type,
        title: groupConfig?.subprocessNameOverride ?? node.name,
        parentTempId: boardTempId ?? null,
        definitionName: role === 'stage' ? `Stage (${groupConfig?.stageKind ?? 'todo'})` : undefined,
    };
}

// ============================================================================
// ITEM CREATION
// ============================================================================

function createItemFromNode(
    node: MondayDataNode,
    boardConfig: MondayBoardConfig,
    groupConfig: MondayGroupConfig | undefined,
    columnConfigMap: Map<string, MondayColumnConfig> | undefined,
    ctx: InterpreterContext
): { item: ImportPlanItem | null; links: PendingLinkReference[] } {
    const tempId = `item:${node.id}`;
    ctx.itemTempIds.set(node.id, tempId);

    // Determine entity type based on board/group role
    const entityType = determineEntityType(boardConfig, groupConfig);

    // Determine parent container
    const groupKey = `${node.metadata.boardId}:${node.metadata.groupId}`;
    let parentTempId = ctx.containerTempIds.get(groupKey);
    if (!parentTempId) {
        parentTempId = ctx.containerTempIds.get(node.metadata.boardId!);
    }

    // Convert column values to field recordings
    const { fieldRecordings, pendingLinks } = convertColumnValues(
        node.columnValues,
        columnConfigMap,
        tempId
    );

    const item: ImportPlanItem = {
        tempId,
        title: node.name,
        parentTempId,
        entityType,
        metadata: {
            mondayId: node.id,
            boardId: node.metadata.boardId,
            groupId: node.metadata.groupId,
            createdAt: node.metadata.createdAt,
            updatedAt: node.metadata.updatedAt,
        },
        fieldRecordings,
    };

    return { item, links: pendingLinks };
}

function createSubitemFromNode(
    node: MondayDataNode,
    boardConfig: MondayBoardConfig,
    columnConfigMap: Map<string, MondayColumnConfig> | undefined,
    ctx: InterpreterContext
): { item: ImportPlanItem | null; links: PendingLinkReference[] } {
    const tempId = `subitem:${node.id}`;
    ctx.itemTempIds.set(node.id, tempId);

    // Parent is the item
    const parentTempId = node.metadata.parentItemId
        ? ctx.itemTempIds.get(node.metadata.parentItemId)
        : undefined;

    const treatAs = boardConfig.settings?.treatSubitemsAs ?? 'child_actions';
    const entityType: ImportPlanItem['entityType'] =
        treatAs === 'subtasks' ? 'subtask' : 'action';

    const { fieldRecordings, pendingLinks } = convertColumnValues(
        node.columnValues,
        columnConfigMap,
        tempId
    );

    const item: ImportPlanItem = {
        tempId,
        title: node.name,
        parentTempId,
        entityType,
        metadata: {
            mondayId: node.id,
            boardId: node.metadata.boardId,
            parentItemId: node.metadata.parentItemId,
            createdAt: node.metadata.createdAt,
            updatedAt: node.metadata.updatedAt,
        },
        fieldRecordings,
    };

    return { item, links: pendingLinks };
}

// ============================================================================
// COLUMN VALUE CONVERSION
// ============================================================================

function convertColumnValues(
    columnValues: MondayColumnValue[],
    configMap: Map<string, MondayColumnConfig> | undefined,
    itemTempId: string
): { fieldRecordings: FieldRecording[]; pendingLinks: PendingLinkReference[] } {
    const fieldRecordings: FieldRecording[] = [];
    const pendingLinks: PendingLinkReference[] = [];

    for (const cv of columnValues) {
        const config = configMap?.get(cv.id);
        const semanticRole = config?.semanticRole ?? inferSemanticRole(cv);

        if (semanticRole === 'ignore') continue;

        // Handle link columns specially
        if (isLinkSemanticRole(semanticRole)) {
            const linkedIds = extractLinkedIds(cv);
            if (linkedIds.length > 0) {
                pendingLinks.push({
                    sourceTempId: itemTempId,
                    fieldName: config?.localFieldKey ?? cv.title,
                    linkedExternalIds: linkedIds,
                });
            }
            continue;
        }

        // Regular field recording
        const recording: FieldRecording = {
            fieldName: config?.localFieldKey ?? cv.title,
            value: extractValue(cv, semanticRole),
            renderHint: config?.renderHint ?? inferRenderHint(cv.type, semanticRole),
        };

        fieldRecordings.push(recording);
    }

    return { fieldRecordings, pendingLinks };
}

function inferSemanticRole(cv: MondayColumnValue): MondayColumnSemanticRole {
    // Check type-based mapping first
    const typeRole = heuristics.columnTypeToRole[cv.type];
    if (typeRole) return typeRole;

    // Check name patterns
    for (const [role, patterns] of Object.entries(heuristics.columnNamePatterns)) {
        for (const pattern of patterns) {
            if (pattern.test(cv.title)) {
                return role as MondayColumnSemanticRole;
            }
        }
    }

    return 'custom';
}

function isLinkSemanticRole(role: MondayColumnSemanticRole): boolean {
    return [
        'link_to_template',
        'link_to_project',
        'link_to_subprocess',
        'link_to_action',
        'link_to_record',
        'dependency',
    ].includes(role);
}

function extractLinkedIds(cv: MondayColumnValue): string[] {
    if (!cv.value) return [];

    // board_relation format: { linkedPulseIds: [{ linkedPulseId: "123" }] }
    if (
        typeof cv.value === 'object' &&
        'linkedPulseIds' in cv.value &&
        Array.isArray((cv.value as { linkedPulseIds: unknown[] }).linkedPulseIds)
    ) {
        return (cv.value as { linkedPulseIds: Array<{ linkedPulseId: string }> }).linkedPulseIds.map(
            (lp) => String(lp.linkedPulseId)
        );
    }

    // dependency format: { linkedIds: ["123", "456"] }
    if (
        typeof cv.value === 'object' &&
        'linkedIds' in cv.value &&
        Array.isArray((cv.value as { linkedIds: unknown[] }).linkedIds)
    ) {
        return (cv.value as { linkedIds: string[] }).linkedIds.map(String);
    }

    return [];
}

function extractValue(
    cv: MondayColumnValue,
    _role: MondayColumnSemanticRole
): unknown {
    // Prefer text for most fields
    if (cv.text !== null && cv.text !== '') {
        return cv.text;
    }

    // Handle specific value structures
    if (cv.value && typeof cv.value === 'object') {
        const val = cv.value as Record<string, unknown>;

        // Status column
        if ('label' in val) return val.label;

        // Date column
        if ('date' in val) return val.date;

        // People column
        if ('personsAndTeams' in val && Array.isArray(val.personsAndTeams)) {
            return (val.personsAndTeams as Array<{ id: number; kind: string }>)
                .map((p) => p.id)
                .join(', ');
        }

        // Numbers
        if (cv.type === 'numbers' && typeof val === 'number') {
            return val;
        }
    }

    return cv.value;
}

function inferRenderHint(
    columnType: string,
    _role: MondayColumnSemanticRole
): string | undefined {
    const typeHints: Record<string, string> = {
        status: 'status',
        date: 'date',
        people: 'person',
        numbers: 'number',
        checkbox: 'checkbox',
        rating: 'rating',
        timeline: 'timeline',
        link: 'link',
        email: 'email',
        phone: 'phone',
        color_picker: 'color',
    };

    return typeHints[columnType];
}

// ============================================================================
// ENTITY TYPE DETERMINATION
// ============================================================================

function determineEntityType(
    boardConfig: MondayBoardConfig,
    groupConfig: MondayGroupConfig | undefined
): ImportPlanItem['entityType'] {
    // Template boards produce template entities
    if (boardConfig.role === 'template_board') {
        return 'template';
    }

    // Reference boards produce records
    if (boardConfig.role === 'reference_board') {
        return 'record';
    }

    // Template groups produce templates
    if (groupConfig?.role === 'template_group') {
        return 'template';
    }

    // Default: action
    return 'action';
}

// ============================================================================
// INFERENCE HELPERS (for boards without explicit config)
// ============================================================================

/**
 * Infer board configuration from a discovered board schema.
 * Used when no explicit config exists.
 */
export function inferBoardConfig(
    boardId: string,
    boardName: string,
    groups: Array<{ id: string; title: string }>,
    columns: Array<{ id: string; title: string; type: string }>
): MondayBoardConfig {
    // Infer board role from name
    let role: MondayBoardRole = 'project_board';
    for (const [r, patterns] of Object.entries(heuristics.boardNamePatterns)) {
        for (const pattern of patterns) {
            if (pattern.test(boardName)) {
                role = r as MondayBoardRole;
                break;
            }
        }
    }

    // Infer group roles
    const groupConfigs: MondayGroupConfig[] = groups.map((g, idx) => {
        let groupRole: MondayGroupRole = 'subprocess';
        for (const [r, patterns] of Object.entries(heuristics.groupNamePatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(g.title)) {
                    groupRole = r as MondayGroupRole;
                    break;
                }
            }
        }

        return {
            boardId,
            groupId: g.id,
            groupTitle: g.title,
            role: groupRole,
            stageOrder: groupRole === 'stage' ? idx : undefined,
        };
    });

    // Infer column roles
    const columnConfigs: MondayColumnConfig[] = columns.map((c) => {
        const semanticRole = inferColumnSemanticRole(c.title, c.type);
        return {
            boardId,
            columnId: c.id,
            columnTitle: c.title,
            columnType: c.type,
            semanticRole,
        };
    });

    return {
        boardId,
        boardName,
        role,
        syncDirection: 'pull',
        syncEnabled: true,
        groups: groupConfigs,
        columns: columnConfigs,
    };
}

function inferColumnSemanticRole(
    title: string,
    type: string
): MondayColumnSemanticRole {
    // Type-based inference
    const typeRole = heuristics.columnTypeToRole[type];
    if (typeRole) return typeRole;

    // Name-based inference
    for (const [role, patterns] of Object.entries(heuristics.columnNamePatterns)) {
        for (const pattern of patterns) {
            if (pattern.test(title)) {
                return role as MondayColumnSemanticRole;
            }
        }
    }

    return 'custom';
}
