/**
 * ClickUp Tags resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpTag, CreateTagData } from '../types.js';

export class TagsResource {
    constructor(private client: ClickUpClient) {}

    /** Get all tags in a space */
    async list(spaceId: string): Promise<{ tags: ClickUpTag[] }> {
        return this.client.get<{ tags: ClickUpTag[] }>(`/space/${spaceId}/tag`);
    }

    /** Create a tag in a space */
    async create(spaceId: string, data: CreateTagData): Promise<void> {
        await this.client.post(`/space/${spaceId}/tag`, data);
    }

    /** Delete a tag from a space */
    async delete(spaceId: string, tagName: string): Promise<void> {
        await this.client.delete(`/space/${spaceId}/tag/${encodeURIComponent(tagName)}`);
    }

    /** Add a tag to a task */
    async addToTask(taskId: string, tagName: string): Promise<void> {
        await this.client.post(`/task/${taskId}/tag/${encodeURIComponent(tagName)}`);
    }

    /** Remove a tag from a task */
    async removeFromTask(taskId: string, tagName: string): Promise<void> {
        await this.client.delete(`/task/${taskId}/tag/${encodeURIComponent(tagName)}`);
    }
}
