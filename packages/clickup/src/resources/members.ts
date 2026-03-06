/**
 * ClickUp Members resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpMember } from '../types.js';

export class MembersResource {
    constructor(private client: ClickUpClient) {}

    /** Get members with access to a task */
    async getTaskMembers(taskId: string): Promise<{ members: ClickUpMember[] }> {
        return this.client.get<{ members: ClickUpMember[] }>(`/task/${taskId}/member`);
    }

    /** Get members with access to a list */
    async getListMembers(listId: string): Promise<{ members: ClickUpMember[] }> {
        return this.client.get<{ members: ClickUpMember[] }>(`/list/${listId}/member`);
    }
}
