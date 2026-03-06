/**
 * ClickUp Spaces resource
 */

import type { ClickUpClient } from '../client.js';
import type {
    ClickUpSpace,
    ClickUpFolder,
    ClickUpTeam,
    ClickUpTask,
    ClickUpCustomRole,
    CreateFolderData,
    UpdateFolderData,
    GetFilteredTeamTasksParams,
    SharedHierarchy,
} from '../types.js';

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

    /** Create a folder in a space */
    async createFolder(spaceId: string, data: CreateFolderData): Promise<ClickUpFolder> {
        return this.client.post<ClickUpFolder>(`/space/${spaceId}/folder`, data);
    }

    /** Update a folder */
    async updateFolder(folderId: string, data: UpdateFolderData): Promise<ClickUpFolder> {
        return this.client.put<ClickUpFolder>(`/folder/${folderId}`, data);
    }

    /** Delete a folder */
    async deleteFolder(folderId: string): Promise<void> {
        await this.client.delete(`/folder/${folderId}`);
    }

    /** Get filtered tasks across all lists in a workspace */
    async getFilteredTeamTasks(teamId: string, params?: GetFilteredTeamTasksParams): Promise<{ tasks: ClickUpTask[] }> {
        return this.client.get<{ tasks: ClickUpTask[] }>(`/team/${teamId}/task`, params as Record<string, string | number | boolean | undefined>);
    }

    /** Get shared hierarchy (tasks, lists, folders shared with the user) */
    async getSharedHierarchy(teamId: string): Promise<SharedHierarchy> {
        return this.client.get<SharedHierarchy>(`/team/${teamId}/shared`);
    }

    /** Get custom roles in a workspace */
    async getCustomRoles(teamId: string): Promise<{ custom_roles: ClickUpCustomRole[] }> {
        return this.client.get<{ custom_roles: ClickUpCustomRole[] }>(`/team/${teamId}/customroles`);
    }
}
