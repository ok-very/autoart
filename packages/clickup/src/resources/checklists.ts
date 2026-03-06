/**
 * ClickUp Checklists resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpChecklist, CreateChecklistItemData, UpdateChecklistItemData } from '../types.js';

export class ChecklistsResource {
    constructor(private client: ClickUpClient) {}

    /** Create a checklist on a task */
    async create(taskId: string, data: { name: string }): Promise<{ checklist: ClickUpChecklist }> {
        return this.client.post<{ checklist: ClickUpChecklist }>(`/task/${taskId}/checklist`, data);
    }

    /** Rename or reorder a checklist */
    async update(checklistId: string, data: { name?: string; position?: number }): Promise<{ checklist: ClickUpChecklist }> {
        return this.client.put<{ checklist: ClickUpChecklist }>(`/checklist/${checklistId}`, data);
    }

    /** Delete a checklist */
    async delete(checklistId: string): Promise<void> {
        await this.client.delete(`/checklist/${checklistId}`);
    }

    /** Create a checklist item */
    async createItem(checklistId: string, data: CreateChecklistItemData): Promise<{ checklist: ClickUpChecklist }> {
        return this.client.post<{ checklist: ClickUpChecklist }>(`/checklist/${checklistId}/checklist_item`, data);
    }

    /** Update a checklist item (rename, resolve, reassign, reparent) */
    async updateItem(
        checklistId: string,
        itemId: string,
        data: UpdateChecklistItemData
    ): Promise<{ checklist: ClickUpChecklist }> {
        return this.client.put<{ checklist: ClickUpChecklist }>(`/checklist/${checklistId}/checklist_item/${itemId}`, data);
    }

    /** Delete a checklist item */
    async deleteItem(checklistId: string, itemId: string): Promise<void> {
        await this.client.delete(`/checklist/${checklistId}/checklist_item/${itemId}`);
    }
}
