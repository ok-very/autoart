/**
 * ClickUp Views resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpView, ClickUpTask } from '../types.js';

export class ViewsResource {
    constructor(private client: ClickUpClient) {}

    /** Get views at the Everything level of a workspace */
    async getTeamViews(teamId: string): Promise<{ views: ClickUpView[] }> {
        return this.client.get<{ views: ClickUpView[] }>(`/team/${teamId}/view`);
    }

    /** Get views in a space */
    async getSpaceViews(spaceId: string): Promise<{ views: ClickUpView[] }> {
        return this.client.get<{ views: ClickUpView[] }>(`/space/${spaceId}/view`);
    }

    /** Get views in a folder */
    async getFolderViews(folderId: string): Promise<{ views: ClickUpView[] }> {
        return this.client.get<{ views: ClickUpView[] }>(`/folder/${folderId}/view`);
    }

    /** Get views in a list */
    async getListViews(listId: string): Promise<{ views: ClickUpView[] }> {
        return this.client.get<{ views: ClickUpView[] }>(`/list/${listId}/view`);
    }

    /** Get a single view */
    async get(viewId: string): Promise<{ view: ClickUpView }> {
        return this.client.get<{ view: ClickUpView }>(`/view/${viewId}`);
    }

    /** Get tasks for a view */
    async getTasks(viewId: string, page?: number): Promise<{ tasks: ClickUpTask[]; last_page: boolean }> {
        return this.client.get<{ tasks: ClickUpTask[]; last_page: boolean }>(`/view/${viewId}/task`, {
            page: page ?? 0,
        });
    }
}
