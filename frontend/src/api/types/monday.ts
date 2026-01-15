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
    | 'template_group'
    | 'reference_group'
    | 'ignore';

export type MondayColumnSemanticRole =
    | 'title'
    | 'description'
    | 'status'
    | 'dueDate'
    | 'startDate'
    | 'assignee'
    | 'priority'
    | 'tags'
    | 'effort'
    | 'cost'
    | 'link_to_project'
    | 'link_to_subprocess'
    | 'link_to_action'
    | 'link_to_record'
    | 'link_to_template'
    | 'dependency' // implicit link to same type
    | 'custom'
    | 'ignore';

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
    settings?: Record<string, any>;
    groups: MondayGroupConfig[];
    columns: MondayColumnConfig[];
}

export interface MondayGroupConfig {
    boardId: string;
    groupId: string;
    groupTitle: string;
    role: MondayGroupRole;
    stageOrder?: number;
    stageKind?: 'todo' | 'doing' | 'done';
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
}
