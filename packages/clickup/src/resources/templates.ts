/**
 * ClickUp Task Templates resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpTaskTemplate, ClickUpTask } from '../types.js';

export class TemplatesResource {
    constructor(private client: ClickUpClient) {}

    /** Get task templates in a workspace */
    async list(teamId: string, page?: number): Promise<{ templates: ClickUpTaskTemplate[] }> {
        return this.client.get<{ templates: ClickUpTaskTemplate[] }>(`/team/${teamId}/taskTemplate`, {
            page: page ?? 0,
        });
    }

    /** Create a task from a template */
    async createFromTemplate(listId: string, templateId: string, data: { name: string }): Promise<ClickUpTask> {
        return this.client.post<ClickUpTask>(`/list/${listId}/taskTemplate/${templateId}`, data);
    }
}
