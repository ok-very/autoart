export type MondayBoardRole =
    | 'project_board'
    | 'action_board'
    | 'template_board'
    | 'reference_board'
    | 'overview_board'
    | 'ignore';

export type MondayGroupRole =
    | 'stage'
    | 'subprocess'
    | 'backlog'
    | 'done'
    | 'archive'
    | 'template_group'
    | 'reference_group'
    | 'ignore';

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

export interface MondayBoardConfigSettings {
    projectTitleOverride?: string; // Custom title for the created project (if different from boardName)
    treatSubitemsAs?: 'child_actions' | 'subtasks' | 'ignore';
    defaultGroupRole?: MondayGroupRole;
    [key: string]: unknown;
}

export interface MondayBoardConfig {
    id?: string; // DB ID
    workspaceId?: string;
    boardId: string; // External ID
    boardName: string;
    role: MondayBoardRole;
    linkedProjectId?: string;
    templateScope?: 'global' | 'project';
    syncDirection: 'import' | 'export' | 'sync' | 'pull';
    syncEnabled: boolean;
    settings?: MondayBoardConfigSettings;
    groups: MondayGroupConfig[];
    columns: MondayColumnConfig[];
}

export type MondayStageKind = 'todo' | 'in_progress' | 'blocked' | 'done' | 'archive';

export interface MondayGroupConfig {
    boardId: string;
    groupId: string;
    groupTitle: string;
    role: MondayGroupRole;
    stageOrder?: number;
    stageKind?: MondayStageKind;
    subprocessNameOverride?: string;
    settings?: Record<string, any>;
}

export interface MondayColumnConfig {
    boardId: string;
    columnId: string;
    columnTitle: string;
    columnType: string;
    semanticRole: MondayColumnSemanticRole;
    localFieldKey?: string;
    factKindId?: string;
    renderHint?: string;
    isRequired?: boolean;
    multiValued?: boolean;
    settings?: Record<string, any>;
    inferenceSource?: 'type_match' | 'name_pattern' | 'combined' | 'manual' | 'default';
    inferenceConfidence?: number;
    inferenceReasons?: string[];
    sampleValues?: string[];
}
