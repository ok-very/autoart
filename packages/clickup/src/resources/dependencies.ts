/**
 * ClickUp Dependencies & Task Links resource
 *
 * Dependencies represent blocking relationships:
 *   - "depends_on": Task A waits for Task B (B blocks A)
 *   - "dependency_of": Task A blocks Task B (A blocks B)
 *
 * Task Links represent related-but-non-blocking references (bidirectional).
 */

import type { ClickUpClient } from '../client.js';
import type { AddDependencyData } from '../types.js';

export class DependenciesResource {
    constructor(private client: ClickUpClient) {}

    /**
     * Add a dependency to a task.
     * Use `depends_on` to make this task wait for another.
     * Use `dependency_of` to make this task block another.
     */
    async add(taskId: string, data: AddDependencyData): Promise<void> {
        await this.client.post(`/task/${taskId}/dependency`, data);
    }

    /**
     * Remove a dependency from a task.
     * Provide either `depends_on` or `dependency_of` to identify which relationship to remove.
     */
    async remove(taskId: string, params: { depends_on?: string; dependency_of?: string }): Promise<void> {
        await this.client.delete(`/task/${taskId}/dependency`, params as Record<string, string>);
    }

    /**
     * Link two tasks (bidirectional, non-blocking relationship).
     */
    async addLink(taskId: string, linkedTaskId: string): Promise<void> {
        await this.client.post(`/task/${taskId}/link/${linkedTaskId}`);
    }

    /**
     * Remove a link between two tasks.
     */
    async removeLink(taskId: string, linkedTaskId: string): Promise<void> {
        await this.client.delete(`/task/${taskId}/link/${linkedTaskId}`);
    }
}
