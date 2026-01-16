/**
 * Monday Workspace Configuration Types
 *
 * Defines the configuration model for interpreting Monday.com data
 * into AutoArt's domain schema (Projects, Subprocesses, Actions, Templates, Linked Records).
 *
 * This is the foundation of the advanced import path where interpretation
 * is configuration-driven rather than heuristic-based.
 */

// ============================================================================
// BOARD ROLES
// ============================================================================

/**
 * Role classification for a Monday board.
 * Determines how the board's contents are interpreted into AutoArt entities.
 */
export type MondayBoardRole =
    | 'project_board'    // Board represents projects with subprocesses/stages/actions
    | 'action_board'     // Board is flat list of actions within an existing project
    | 'template_board'   // Board stores reusable templates
    | 'reference_board'  // Board stores reference/lookup data (Linked Records)
    | 'overview_board'   // Dashboard/summary board with cross-project views
    | 'ignore';          // Subitems storage or otherwise excluded

// ============================================================================
// GROUP ROLES
// ============================================================================

/**
 * Role classification for a Monday group within a board.
 * Determines how items in the group are organized in AutoArt.
 */
export type MondayGroupRole =
    | 'stage'           // Pipeline stage (ordered, with stage kind)
    | 'subprocess'      // Subprocess container
    | 'backlog'         // Backlog/to-triage items
    | 'done'            // Completed items
    | 'archive'         // Archived/historical items
    | 'template_group'  // Group of template items
    | 'reference_group' // Group of reference items (records)
    | 'ignore';         // Excluded from import

/**
 * Stage kind for pipeline stages.
 */
export type MondayStageKind =
    | 'todo'
    | 'in_progress'
    | 'blocked'
    | 'done'
    | 'archive';

// ============================================================================
// COLUMN SEMANTIC ROLES
// ============================================================================

/**
 * Semantic role for a Monday column.
 * Determines how column values are interpreted and mapped to AutoArt fields/facts.
 */
export type MondayColumnSemanticRole =
    // Core action fields
    | 'title'
    | 'description'
    | 'status'
    | 'due_date'
    | 'assignee'
    | 'tags'
    | 'priority'
    | 'estimate'
    | 'identifier'
    // Data/fact fields
    | 'fact'
    | 'note'
    | 'metric'
    // Template fields
    | 'template_name'
    | 'template_key'
    // Linking fields
    | 'link_to_template'
    | 'link_to_project'
    | 'link_to_subprocess'
    | 'link_to_action'
    | 'link_to_record'
    | 'dependency'
    // Other
    | 'custom'
    | 'ignore';

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

/**
 * Sync direction for a board or workspace.
 */
export type MondaySyncDirection =
    | 'pull'   // Only import from Monday
    | 'push'   // Only export to Monday
    | 'both'   // Bi-directional sync
    | 'none';  // No sync (one-time import only)

// ============================================================================
// CONFIGURATION OBJECTS
// ============================================================================

/**
 * Column configuration - how a Monday column maps to AutoArt.
 */
export interface MondayColumnConfig {
    boardId: string;
    columnId: string;
    columnTitle: string;
    columnType: string;  // Monday column type (status, date, text, etc.)
    semanticRole: MondayColumnSemanticRole;
    /** AutoArt field key this column maps to */
    localFieldKey?: string;
    /** Fact kind ID if this column generates facts */
    factKindId?: string;
    /** Render hint override */
    renderHint?: string;
    /** Whether this field is required */
    isRequired?: boolean;
    /** Whether this field can have multiple values */
    multiValued?: boolean;
    /** Additional settings */
    settings?: Record<string, unknown>;
}

/**
 * Group configuration - how a Monday group is interpreted.
 */
export interface MondayGroupConfig {
    boardId: string;
    groupId: string;
    groupTitle: string;
    role: MondayGroupRole;
    /** Order in pipeline (for stage role) */
    stageOrder?: number;
    /** Stage kind (for stage role) */
    stageKind?: MondayStageKind;
    /** Override name for subprocess */
    subprocessNameOverride?: string;
    /** Additional settings */
    settings?: Record<string, unknown>;
}

/**
 * Board configuration - how a Monday board is interpreted.
 */
export interface MondayBoardConfig {
    boardId: string;
    boardName: string;
    role: MondayBoardRole;
    /** Link to existing AutoArt project (for action_board or to attach) */
    linkedProjectId?: string;
    /** Template scope (for template_board) */
    templateScope?: 'project_template' | 'subprocess_template' | 'action_template' | 'record_template';
    /** Sync direction */
    syncDirection: MondaySyncDirection;
    /** Whether sync is enabled */
    syncEnabled: boolean;
    /** Additional settings */
    settings?: {
        /** How to treat subitems */
        treatSubitemsAs?: 'child_actions' | 'subtasks' | 'ignore';
        /** Default group role if not explicitly configured */
        defaultGroupRole?: MondayGroupRole;
        /** Attach items without group to this container */
        attachOrphanItemsTo?: 'project' | 'subprocess' | 'ignore';
    };
    /** Group configurations within this board */
    groups: MondayGroupConfig[];
    /** Column configurations within this board */
    columns: MondayColumnConfig[];
}

/**
 * Workspace configuration - top-level container for Monday integration.
 */
export interface MondayWorkspaceConfig {
    id: string;
    name: string;
    /** Monday provider account ID if available */
    providerAccountId?: string;
    /** Default AutoArt project for boards without explicit linking */
    defaultProjectId?: string;
    /** Workspace-level settings */
    settings?: {
        /** Default sync direction for new boards */
        defaultSyncDirection?: MondaySyncDirection;
        /** Auto-discover new boards */
        autoDiscoverBoards?: boolean;
    };
    /** Board configurations within this workspace */
    boards: MondayBoardConfig[];
    /** Created timestamp */
    createdAt?: Date;
    /** Updated timestamp */
    updatedAt?: Date;
}

// ============================================================================
// LINK CONFIGURATION (for relation/mirror columns)
// ============================================================================

/**
 * Link type for relation/mirror columns.
 */
export type MondayLinkType =
    | 'template_link'
    | 'project_link'
    | 'subprocess_link'
    | 'action_link'
    | 'record_link'
    | 'parent_action'
    | 'child_action'
    | 'cross_project_dependency';

/**
 * Configuration for a linking column.
 */
export interface MondayLinkConfig {
    workspaceId: string;
    boardId: string;
    columnId: string;
    linkType: MondayLinkType;
    /** Target entity type in AutoArt */
    targetEntityType: 'template' | 'project' | 'subprocess' | 'action' | 'record';
    /** Target board ID if link always points to a specific board */
    targetBoardId?: string;
    /** Additional settings */
    settings?: Record<string, unknown>;
}

// ============================================================================
// DISCOVERY AND INFERENCE
// ============================================================================

/**
 * Board discovery result from Monday API.
 */
export interface MondayBoardDiscovery {
    boardId: string;
    boardName: string;
    itemCount: number;
    boardKind: string;
    workspaceName?: string;
    groups: Array<{
        groupId: string;
        groupTitle: string;
        itemCount?: number;
    }>;
    columns: Array<{
        columnId: string;
        columnTitle: string;
        columnType: string;
    }>;
    /** Inferred role based on heuristics */
    inferredRole: MondayBoardRole;
    /** Confidence of inference (0-1) */
    inferenceConfidence?: number; // 0.0 - 1.0
    inferenceReasons?: string[];  // Human-readable explanations
    /** Sample values from the board */
    sampleValues?: string[];
}

/**
 * Heuristics for inferring board/group/column roles.
 */
export interface MondayInferenceHeuristics {
    /** Board name patterns for each role */
    boardNamePatterns: Record<MondayBoardRole, RegExp[]>;
    /** Group name patterns for each role */
    groupNamePatterns: Record<MondayGroupRole, RegExp[]>;
    /** Column name patterns for each semantic role */
    columnNamePatterns: Record<MondayColumnSemanticRole, RegExp[]>;
    /** Monday column types that suggest semantic roles */
    columnTypeToRole: Record<string, MondayColumnSemanticRole>;
}

// ============================================================================
// DEFAULT HEURISTICS
// ============================================================================

/**
 * Default heuristics for inferring roles.
 */
export const DEFAULT_INFERENCE_HEURISTICS: MondayInferenceHeuristics = {
    boardNamePatterns: {
        project_board: [],  // Default if no other match
        action_board: [/tasks?$/i, /actions?$/i, /to.?do/i],
        template_board: [/template/i, /blueprint/i],
        reference_board: [/reference/i, /library/i, /lookup/i],
        overview_board: [/overview/i, /dashboard/i, /summary/i, /current.*projects/i],
        ignore: [/subitems?\s+of/i, /archive/i],
    },
    groupNamePatterns: {
        stage: [/^stage\s*\d/i, /phase\s*\d/i],
        subprocess: [/subprocess/i, /workstream/i],
        backlog: [/backlog/i, /triage/i, /inbox/i, /new/i],
        done: [/done/i, /complete/i, /finished/i, /archive/i],
        template_group: [/template/i],
        reference_group: [/reference/i, /resource/i, /file/i, /doc/i],
        archive: [/archive/i, /old/i],
        ignore: [],
    },
    columnNamePatterns: {
        title: [/^name$/i, /^title$/i, /^item$/i],
        description: [/^desc/i, /^notes?$/i, /^details?$/i],
        status: [/^status$/i, /^state$/i, /^progress$/i],
        due_date: [/^due/i, /deadline/i, /target.*date/i],
        assignee: [/^owner/i, /^pm$/i, /^manager/i, /^assigned/i, /^assignee/i],
        tags: [/^tags?$/i, /^labels?$/i],
        priority: [/^priority$/i, /^urgency$/i],
        estimate: [/^estimate/i, /^effort/i, /^points?$/i],
        identifier: [/^id$/i, /^identifier$/i, /^number$/i],
        fact: [],
        note: [],
        metric: [],
        template_name: [],
        template_key: [],
        link_to_template: [/template/i],
        link_to_project: [/project/i],
        link_to_subprocess: [],
        link_to_action: [],
        link_to_record: [],
        dependency: [/depend/i, /blocked.*by/i, /blocks?$/i],
        custom: [],
        ignore: [],
    },
    columnTypeToRole: {
        name: 'title',
        text: 'description',
        long_text: 'description',
        status: 'status',
        date: 'due_date',
        people: 'assignee',
        tags: 'tags',
        numbers: 'metric',
        board_relation: 'link_to_action',
        mirror: 'link_to_action',
        dependency: 'dependency',
    },
};
