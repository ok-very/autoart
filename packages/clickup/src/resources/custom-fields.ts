/**
 * ClickUp Custom Fields resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpCustomField } from '../types.js';

export class CustomFieldsResource {
    constructor(private client: ClickUpClient) {}

    /** Get all accessible custom fields on a list */
    async list(listId: string): Promise<{ fields: ClickUpCustomField[] }> {
        return this.client.get<{ fields: ClickUpCustomField[] }>(`/list/${listId}/field`);
    }

    /** Set a custom field value on a task */
    async set(taskId: string, fieldId: string, value: unknown): Promise<void> {
        await this.client.post(`/task/${taskId}/field/${fieldId}`, { value });
    }

    /** Remove a custom field value from a task */
    async remove(taskId: string, fieldId: string): Promise<void> {
        await this.client.delete(`/task/${taskId}/field/${fieldId}`);
    }
}
