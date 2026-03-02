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

// ── API Responses ─────────────────────────────────────────────────────────

export interface ClickUpListResponse<T> {
    tasks?: T[];
    spaces?: T[];
    folders?: T[];
    lists?: T[];
    teams?: T[];
    fields?: T[];
}
