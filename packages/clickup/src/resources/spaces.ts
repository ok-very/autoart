/**
 * ClickUp Spaces resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpSpace, ClickUpFolder, ClickUpTeam } from '../types.js';

export class SpacesResource {
    constructor(private client: ClickUpClient) {}

    /** Get all teams/workspaces the token has access to */
    async getTeams(): Promise<{ teams: ClickUpTeam[] }> {
        return this.client.get<{ teams: ClickUpTeam[] }>('/team');
    }

    /** Get all spaces in a workspace */
    async list(teamId: string, archived?: boolean): Promise<{ spaces: ClickUpSpace[] }> {
        return this.client.get<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`, {
            archived: archived ?? false,
        });
    }

    /** Get a single space */
    async get(spaceId: string): Promise<ClickUpSpace> {
        return this.client.get<ClickUpSpace>(`/space/${spaceId}`);
    }

    /** Get all folders in a space */
    async getFolders(spaceId: string, archived?: boolean): Promise<{ folders: ClickUpFolder[] }> {
        return this.client.get<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`, {
            archived: archived ?? false,
        });
    }

    /** Get a single folder */
    async getFolder(folderId: string): Promise<ClickUpFolder> {
        return this.client.get<ClickUpFolder>(`/folder/${folderId}`);
    }
}
