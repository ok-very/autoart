/**
 * ClickUp Comments resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpComment, CreateCommentData, UpdateCommentData } from '../types.js';

export class CommentsResource {
    constructor(private client: ClickUpClient) {}

    /** Get comments on a task */
    async getTaskComments(
        taskId: string,
        params?: { start?: number; start_id?: string; custom_task_ids?: boolean; team_id?: number }
    ): Promise<{ comments: ClickUpComment[] }> {
        return this.client.get<{ comments: ClickUpComment[] }>(`/task/${taskId}/comment`, params as Record<string, string | number | boolean>);
    }

    /** Create a comment on a task */
    async createTaskComment(taskId: string, data: CreateCommentData): Promise<ClickUpComment> {
        return this.client.post<ClickUpComment>(`/task/${taskId}/comment`, data);
    }

    /** Get comments on a list */
    async getListComments(listId: string, params?: { start?: number; start_id?: string }): Promise<{ comments: ClickUpComment[] }> {
        return this.client.get<{ comments: ClickUpComment[] }>(`/list/${listId}/comment`, params as Record<string, string | number | boolean>);
    }

    /** Create a comment on a list */
    async createListComment(listId: string, data: CreateCommentData): Promise<ClickUpComment> {
        return this.client.post<ClickUpComment>(`/list/${listId}/comment`, data);
    }

    /** Get comments on a chat view */
    async getViewComments(viewId: string, params?: { start?: number; start_id?: string }): Promise<{ comments: ClickUpComment[] }> {
        return this.client.get<{ comments: ClickUpComment[] }>(`/view/${viewId}/comment`, params as Record<string, string | number | boolean>);
    }

    /** Create a comment on a chat view */
    async createViewComment(viewId: string, data: CreateCommentData): Promise<ClickUpComment> {
        return this.client.post<ClickUpComment>(`/view/${viewId}/comment`, data);
    }

    /** Update a comment */
    async update(commentId: string, data: UpdateCommentData): Promise<void> {
        await this.client.put(`/comment/${commentId}`, data);
    }

    /** Delete a comment */
    async delete(commentId: string): Promise<void> {
        await this.client.delete(`/comment/${commentId}`);
    }
}
