/**
 * ClickUp Users resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpUser, InviteUserData, EditUserData } from '../types.js';

export class UsersResource {
    constructor(private client: ClickUpClient) {}

    /** Invite a user to a workspace */
    async invite(teamId: string, data: InviteUserData): Promise<{ user: ClickUpUser }> {
        return this.client.post<{ user: ClickUpUser }>(`/team/${teamId}/user`, data);
    }

    /** Get a user in a workspace */
    async get(teamId: string, userId: number): Promise<{ user: ClickUpUser }> {
        return this.client.get<{ user: ClickUpUser }>(`/team/${teamId}/user/${userId}`);
    }

    /** Edit a user on a workspace */
    async edit(teamId: string, userId: number, data: EditUserData): Promise<{ user: ClickUpUser }> {
        return this.client.put<{ user: ClickUpUser }>(`/team/${teamId}/user/${userId}`, data);
    }

    /** Remove a user from a workspace */
    async remove(teamId: string, userId: number): Promise<void> {
        await this.client.delete(`/team/${teamId}/user/${userId}`);
    }
}
