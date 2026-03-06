/**
 * ClickUp API v2 type definitions
 */

// ── Auth ──────────────────────────────────────────────────────────────────

export interface ClickUpClientConfig {
    /** Personal API token (pk_...) or OAuth access token */
    token: string;
    /** Base URL override (default: https://api.clickup.com/api/v2) */
    baseUrl?: string;
    /** Max retries on rate limit (default: 3) */
    maxRetries?: number;
    /** Workspace ID (required for Docs v3 API) */
    workspaceId?: string;
}

// ── Common ────────────────────────────────────────────────────────────────

export interface ClickUpUser {
    id: number;
    username: string;
    email?: string;
    color: string;
    profilePicture: string | null;
    initials?: string;
}

export interface ClickUpStatus {
    status: string;
    color: string;
    orderindex: number;
    type: string;
}

export interface ClickUpPriority {
    color: string;
    id: string;
    orderindex: string;
    priority: string;
}

// ── Workspace / Team ──────────────────────────────────────────────────────

export interface ClickUpTeam {
    id: string;
    name: string;
    color: string;
    avatar: string | null;
    members: Array<{ user: ClickUpUser }>;
}

// ── Spaces ────────────────────────────────────────────────────────────────

export interface ClickUpSpace {
    id: string;
    name: string;
    private: boolean;
    statuses: ClickUpStatus[];
    multiple_assignees: boolean;
    features: Record<string, { enabled: boolean }>;
}

// ── Folders ───────────────────────────────────────────────────────────────

export interface ClickUpFolder {
    id: string;
    name: string;
    orderindex: number;
    override_statuses: boolean;
    hidden: boolean;
    space: { id: string; name: string };
    task_count: string;
    lists: ClickUpList[];
}

// ── Lists ─────────────────────────────────────────────────────────────────

export interface ClickUpList {
    id: string;
    name: string;
    orderindex: number;
    content: string;
    status: { status: string; color: string };
    priority: { priority: string; color: string } | null;
    assignee: ClickUpUser | null;
    task_count: number | null;
    due_date: string | null;
    start_date: string | null;
    folder: { id: string; name: string; hidden: boolean; access: boolean };
    space: { id: string; name: string; access: boolean };
    statuses: ClickUpStatus[];
}

// ── Custom Fields ─────────────────────────────────────────────────────────

export interface ClickUpCustomFieldOption {
    id: string;
    name: string;
    color: string | null;
    orderindex: number;
}

export interface ClickUpCustomField {
    id: string;
    name: string;
    type: string;
    type_config: {
        options?: ClickUpCustomFieldOption[];
        [key: string]: unknown;
    };
    date_created: string;
    hide_from_guests: boolean;
    required: boolean;
}

export interface ClickUpCustomFieldValue {
    id: string;
    name: string;
    type: string;
    type_config: Record<string, unknown>;
    value: unknown;
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export interface ClickUpTask {
    id: string;
    custom_id: string | null;
    name: string;
    text_content: string | null;
    description: string | null;
    status: ClickUpStatus;
    orderindex: string;
    date_created: string;
    date_updated: string;
    date_closed: string | null;
    date_done: string | null;
    creator: ClickUpUser;
    assignees: ClickUpUser[];
    tags: Array<{ name: string; tag_fg: string; tag_bg: string }>;
    parent: string | null;
    priority: ClickUpPriority | null;
    due_date: string | null;
    start_date: string | null;
    points: number | null;
    time_estimate: number | null;
    time_spent: number | null;
    custom_fields: ClickUpCustomFieldValue[];
    list: { id: string; name?: string };
    folder: { id: string; name?: string };
    space: { id: string };
    url: string;
}

export interface CreateTaskData {
    name: string;
    description?: string;
    markdown_content?: string;
    parent?: string | null;
    assignees?: number[];
    tags?: string[];
    status?: string;
    priority?: number | null;
    due_date?: number;
    due_date_time?: boolean;
    start_date?: number;
    start_date_time?: boolean;
    time_estimate?: number;
    notify_all?: boolean;
    custom_fields?: Array<{ id: string; value: unknown }>;
}

export interface UpdateTaskData {
    name?: string;
    description?: string;
    markdown_content?: string;
    assignees?: { add?: number[]; rem?: number[] };
    status?: string;
    priority?: number | null;
    due_date?: number | null;
    due_date_time?: boolean;
    start_date?: number | null;
    start_date_time?: boolean;
    time_estimate?: number | null;
    parent?: string | null;
}

export interface GetTasksParams {
    archived?: boolean;
    page?: number;
    order_by?: string;
    reverse?: boolean;
    subtasks?: boolean;
    statuses?: string[];
    include_closed?: boolean;
    assignees?: number[];
    due_date_gt?: number;
    due_date_lt?: number;
    date_created_gt?: number;
    date_created_lt?: number;
    date_updated_gt?: number;
    date_updated_lt?: number;
    custom_fields?: string;
}

// ── Comments ─────────────────────────────────────────────────────────────

export interface ClickUpComment {
    id: string;
    comment: Array<{ text: string; [key: string]: unknown }>;
    comment_text: string;
    user: ClickUpUser;
    assignee: ClickUpUser | null;
    assigned_by: ClickUpUser | null;
    resolved_date: string | null;
    date: string;
}

export interface CreateCommentData {
    comment_text: string;
    assignee?: number;
    notify_all?: boolean;
}

export interface UpdateCommentData {
    comment_text?: string;
    assignee?: number;
    resolved?: boolean;
}

// ── Attachments ──────────────────────────────────────────────────────────

export interface ClickUpAttachment {
    id: string;
    version: string;
    date: number;
    title: string;
    extension: string;
    thumbnail_small: string | null;
    thumbnail_large: string | null;
    url: string;
}

// ── Checklists ───────────────────────────────────────────────────────────

export interface ClickUpChecklistItem {
    id: string;
    name: string;
    orderindex: number;
    assignee: ClickUpUser | null;
    group_assignee: unknown | null;
    resolved: boolean;
    parent: string | null;
    date_created: string;
    children: ClickUpChecklistItem[];
}

export interface ClickUpChecklist {
    id: string;
    task_id: string;
    name: string;
    date_created: string;
    orderindex: number;
    creator: number;
    resolved: number;
    unresolved: number;
    items: ClickUpChecklistItem[];
}

export interface CreateChecklistItemData {
    name: string;
    assignee?: number;
}

export interface UpdateChecklistItemData {
    name?: string;
    assignee?: number | null;
    resolved?: boolean;
    parent?: string | null;
}

// ── Time Tracking ────────────────────────────────────────────────────────

export interface ClickUpTimeEntry {
    id: string;
    task: { id: string; name: string; status: ClickUpStatus; custom_id: string | null } | null;
    wid: string;
    user: ClickUpUser;
    billable: boolean;
    start: string;
    end: string;
    duration: string;
    description: string;
    tags: Array<{ name: string; tag_bg: string; tag_fg: string }>;
    source: string | null;
    at: string;
}

export interface CreateTimeEntryData {
    description?: string;
    tags?: Array<{ name: string; tag_bg?: string; tag_fg?: string }>;
    start: number;
    stop?: number;
    duration: number;
    billable?: boolean;
    tid?: string;
}

export interface UpdateTimeEntryData {
    description?: string;
    tags?: Array<{ name: string; tag_bg?: string; tag_fg?: string }>;
    start?: number;
    end?: number;
    duration?: number;
    billable?: boolean;
    tid?: string;
}

export interface GetTimeEntriesParams {
    start_date?: number;
    end_date?: number;
    assignee?: number;
    include_task_tags?: boolean;
    include_location_names?: boolean;
    space_id?: number;
    folder_id?: number;
    list_id?: number;
    task_id?: string;
    custom_task_ids?: boolean;
}

// ── Tags ─────────────────────────────────────────────────────────────────

export interface ClickUpTag {
    name: string;
    tag_fg: string;
    tag_bg: string;
}

export interface CreateTagData {
    tag: { name: string; tag_bg: string; tag_fg: string };
}

// ── Goals ────────────────────────────────────────────────────────────────

export interface ClickUpKeyResult {
    id: string;
    goal_id: string;
    name: string;
    creator: number;
    owner: ClickUpUser;
    type: string;
    steps_start: number;
    steps_end: number;
    steps_current: number;
    unit: string;
    task_ids: string[];
    list_ids: string[];
}

export interface ClickUpGoal {
    id: string;
    name: string;
    team_id: string;
    date_created: string;
    start_date: string | null;
    due_date: string | null;
    description: string;
    private: boolean;
    archived: boolean;
    creator: number;
    color: string;
    pretty_url: string;
    multiple_owners: boolean;
    owners: Array<{ id: number; username: string; email: string }>;
    key_results: ClickUpKeyResult[];
    percent_completed: number;
}

export interface CreateGoalData {
    name: string;
    due_date?: number;
    description?: string;
    multiple_owners?: boolean;
    owners?: number[];
    color?: string;
}

export interface CreateKeyResultData {
    name: string;
    owners?: number[];
    type: string;
    steps_start: number;
    steps_end: number;
    unit: string;
    task_ids?: string[];
    list_ids?: string[];
}

// ── Webhooks ─────────────────────────────────────────────────────────────

export type WebhookEvent =
    | '*'
    | 'taskCreated' | 'taskUpdated' | 'taskDeleted'
    | 'taskPriorityUpdated' | 'taskStatusUpdated' | 'taskAssigneeUpdated'
    | 'taskDueDateUpdated' | 'taskTagUpdated' | 'taskMoved'
    | 'taskCommentPosted' | 'taskCommentUpdated'
    | 'taskTimeEstimateUpdated' | 'taskTimeTrackedUpdated'
    | 'listCreated' | 'listUpdated' | 'listDeleted'
    | 'folderCreated' | 'folderUpdated' | 'folderDeleted'
    | 'spaceCreated' | 'spaceUpdated' | 'spaceDeleted'
    | 'goalCreated' | 'goalUpdated' | 'goalDeleted'
    | 'keyResultCreated' | 'keyResultUpdated' | 'keyResultDeleted';

export interface ClickUpWebhook {
    id: string;
    userid: number;
    team_id: string;
    endpoint: string;
    client_id: string | null;
    events: WebhookEvent[];
    task_id: string | null;
    list_id: string | null;
    folder_id: string | null;
    space_id: string | null;
    health: { status: string; fail_count: number };
    secret: string;
}

export interface CreateWebhookData {
    endpoint: string;
    events: WebhookEvent[];
    task_id?: string;
    list_id?: string;
    folder_id?: string;
    space_id?: string;
}

// ── Views ────────────────────────────────────────────────────────────────

export interface ClickUpView {
    id: string;
    name: string;
    type: string;
    parent: { id: string; type: number };
    grouping: Record<string, unknown>;
    divide: Record<string, unknown>;
    sorting: Record<string, unknown>;
    filters: Record<string, unknown>;
    columns: Record<string, unknown>;
    team_sidebar: Record<string, unknown>;
    settings: Record<string, unknown>;
}

// ── Members ──────────────────────────────────────────────────────────────

export interface ClickUpMember {
    id: number;
    username: string;
    email: string;
    color: string;
    profilePicture: string | null;
    initials: string;
    role: number;
    last_active: string | null;
}

// ── Users ────────────────────────────────────────────────────────────────

export interface InviteUserData {
    email: string;
    admin?: boolean;
}

export interface EditUserData {
    username?: string;
    custom_role?: number;
    admin?: boolean;
}

// ── Templates ────────────────────────────────────────────────────────────

export interface ClickUpTaskTemplate {
    id: string;
    name: string;
    custom_fields: ClickUpCustomFieldValue[];
    date_created: string;
    creator: ClickUpUser;
}

// ── Docs (v3 API) ────────────────────────────────────────────────────────

export interface ClickUpDoc {
    id: string;
    name: string;
    workspace_id: string;
    parent: { id: string; type: number } | null;
    date_created: string;
    date_updated: string;
    creator: number;
    deleted: boolean;
}

export interface ClickUpDocPage {
    id: string;
    name: string;
    content: string;
    orderindex: number;
    date_created: string;
    date_updated: string;
    sub_title?: string;
    pages?: ClickUpDocPage[];
}

export interface CreateDocData {
    name: string;
    parent: { id: string; type: string };
    visibility: 'PUBLIC' | 'PRIVATE';
    create_page?: boolean;
}

export interface CreateDocPageData {
    name: string;
    content: string;
    content_format?: 'text/md' | 'text/plain';
    parent_page_id?: string;
    sub_title?: string;
}

export interface UpdateDocPageData {
    name?: string;
    content?: string;
    content_format?: 'text/md' | 'text/plain';
    content_edit_mode?: 'replace' | 'append' | 'prepend';
    sub_title?: string;
}

// ── Folders (CUD) ────────────────────────────────────────────────────────

export interface CreateFolderData {
    name: string;
}

export interface UpdateFolderData {
    name?: string;
}

// ── Filtered Team Tasks ──────────────────────────────────────────────────

export interface GetFilteredTeamTasksParams extends GetTasksParams {
    list_ids?: number[];
    space_ids?: number[];
    project_ids?: number[];
    include_closed?: boolean;
}

// ── Shared Hierarchy ─────────────────────────────────────────────────────

export interface SharedHierarchy {
    shared: {
        tasks: Array<{ id: string; name: string }>;
        lists: Array<{ id: string; name: string }>;
        folders: Array<{ id: string; name: string }>;
    };
}

// ── Roles ────────────────────────────────────────────────────────────────

export interface ClickUpCustomRole {
    id: number;
    name: string;
    role_type: number;
    date_created: string;
}

// ── Dependencies ─────────────────────────────────────────────────────────

export interface ClickUpDependency {
    task_id: string;
    depends_on: string;
    type: number;
    date_created: string;
    userid: string;
    workspace_id: string;
    chain_id?: string;
}

export interface AddDependencyData {
    /** Task ID that this task depends on (waiting for) */
    depends_on?: string;
    /** Task ID that this task blocks */
    dependency_of?: string;
}

export interface ClickUpTaskLink {
    task_id: string;
    link_id: string;
    date_created: string;
    userid: string;
    workspace_id: string;
}

// ── API Responses ─────────────────────────────────────────────────────────

export interface ClickUpListResponse<T> {
    tasks?: T[];
    spaces?: T[];
    folders?: T[];
    lists?: T[];
    teams?: T[];
    fields?: T[];
}
