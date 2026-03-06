/**
 * ClickUp Goals resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpGoal, ClickUpKeyResult, CreateGoalData, CreateKeyResultData } from '../types.js';

export class GoalsResource {
    constructor(private client: ClickUpClient) {}

    /** Get all goals in a workspace */
    async list(teamId: string): Promise<{ goals: ClickUpGoal[] }> {
        return this.client.get<{ goals: ClickUpGoal[] }>(`/team/${teamId}/goal`);
    }

    /** Get a single goal */
    async get(goalId: string): Promise<{ goal: ClickUpGoal }> {
        return this.client.get<{ goal: ClickUpGoal }>(`/goal/${goalId}`);
    }

    /** Create a goal */
    async create(teamId: string, data: CreateGoalData): Promise<{ goal: ClickUpGoal }> {
        return this.client.post<{ goal: ClickUpGoal }>(`/team/${teamId}/goal`, data);
    }

    /** Update a goal */
    async update(goalId: string, data: Partial<CreateGoalData>): Promise<{ goal: ClickUpGoal }> {
        return this.client.put<{ goal: ClickUpGoal }>(`/goal/${goalId}`, data);
    }

    /** Delete a goal */
    async delete(goalId: string): Promise<void> {
        await this.client.delete(`/goal/${goalId}`);
    }

    /** Create a key result (target) on a goal */
    async createKeyResult(goalId: string, data: CreateKeyResultData): Promise<{ key_result: ClickUpKeyResult }> {
        return this.client.post<{ key_result: ClickUpKeyResult }>(`/goal/${goalId}/key_result`, data);
    }

    /** Update a key result */
    async updateKeyResult(keyResultId: string, data: Partial<CreateKeyResultData>): Promise<{ key_result: ClickUpKeyResult }> {
        return this.client.put<{ key_result: ClickUpKeyResult }>(`/key_result/${keyResultId}`, data);
    }

    /** Delete a key result */
    async deleteKeyResult(keyResultId: string): Promise<void> {
        await this.client.delete(`/key_result/${keyResultId}`);
    }
}
