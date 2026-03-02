/**
 * ClickUp Lists resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpList } from '../types.js';

export class ListsResource {
    constructor(private client: ClickUpClient) {}

    /** Get a single list */
    async get(listId: string): Promise<ClickUpList> {
        return this.client.get<ClickUpList>(`/list/${listId}`);
    }

    /** Get all lists in a folder */
    async listInFolder(folderId: string, archived?: boolean): Promise<{ lists: ClickUpList[] }> {
        return this.client.get<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, {
            archived: archived ?? false,
        });
    }

    /** Get folderless lists in a space */
    async listInSpace(spaceId: string, archived?: boolean): Promise<{ lists: ClickUpList[] }> {
        return this.client.get<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`, {
            archived: archived ?? false,
        });
    }

    /** Create a list in a folder */
    async createInFolder(folderId: string, data: { name: string; content?: string; status?: string }): Promise<ClickUpList> {
        return this.client.post<ClickUpList>(`/folder/${folderId}/list`, data);
    }

    /** Create a folderless list in a space */
    async createInSpace(spaceId: string, data: { name: string; content?: string; status?: string }): Promise<ClickUpList> {
        return this.client.post<ClickUpList>(`/space/${spaceId}/list`, data);
    }

    /** Update a list */
    async update(listId: string, data: { name?: string; content?: string; status?: string }): Promise<ClickUpList> {
        return this.client.put<ClickUpList>(`/list/${listId}`, data);
    }

    /** Delete a list */
    async delete(listId: string): Promise<void> {
        return this.client.delete(`/list/${listId}`);
    }
}
