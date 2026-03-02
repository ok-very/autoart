/**
 * ClickUp Tasks resource
 */

import type { ClickUpClient } from '../client.js';
import type {
    ClickUpTask,
    CreateTaskData,
    UpdateTaskData,
    GetTasksParams,
} from '../types.js';

export class TasksResource {
    constructor(private client: ClickUpClient) {}

    /** Get a single task by ID */
    async get(taskId: string, query?: { include_subtasks?: boolean }): Promise<ClickUpTask> {
        return this.client.get<ClickUpTask>(`/task/${taskId}`, query as Record<string, string | boolean>);
    }

    /** Get tasks in a list (paginated, 100 per page) */
    async list(listId: string, params?: GetTasksParams): Promise<{ tasks: ClickUpTask[] }> {
        const query: Record<string, string | number | boolean | undefined> = {};
        if (params) {
            if (params.archived !== undefined) query.archived = params.archived;
            if (params.page !== undefined) query.page = params.page;
            if (params.order_by) query.order_by = params.order_by;
            if (params.reverse !== undefined) query.reverse = params.reverse;
            if (params.subtasks !== undefined) query.subtasks = params.subtasks;
            if (params.include_closed !== undefined) query.include_closed = params.include_closed;
            if (params.statuses) query.statuses = params.statuses as unknown as string;
        }
        return this.client.get<{ tasks: ClickUpTask[] }>(`/list/${listId}/task`, query);
    }

    /** Create a task in a list */
    async create(listId: string, data: CreateTaskData): Promise<ClickUpTask> {
        return this.client.post<ClickUpTask>(`/list/${listId}/task`, data);
    }

    /** Update a task */
    async update(taskId: string, data: UpdateTaskData): Promise<ClickUpTask> {
        return this.client.put<ClickUpTask>(`/task/${taskId}`, data);
    }

    /** Delete a task */
    async delete(taskId: string): Promise<void> {
        return this.client.delete(`/task/${taskId}`);
    }

    /**
     * Create a task with subtasks in one call.
     * Creates parent first, then subtasks sequentially (ClickUp requires parent ID).
     * Returns [parent, ...subtasks].
     */
    async createWithSubtasks(
        listId: string,
        parent: CreateTaskData,
        subtasks: CreateTaskData[]
    ): Promise<ClickUpTask[]> {
        const parentTask = await this.create(listId, parent);
        const results: ClickUpTask[] = [parentTask];

        for (const sub of subtasks) {
            const child = await this.create(listId, {
                ...sub,
                parent: parentTask.id,
            });
            results.push(child);
        }

        return results;
    }
}
