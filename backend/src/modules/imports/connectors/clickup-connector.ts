/**
 * ClickUp Connector
 *
 * Data normalization layer that fetches ClickUp workspace data
 * and yields normalized ClickUpDataNode objects for the import pipeline.
 *
 * Hierarchy: Workspace → Space → Folder → List → Task → Subtask
 */

import { ClickUp, type ClickUpTask, type ClickUpCustomFieldValue } from '@autoart/clickup';

// ── Data Node Types ───────────────────────────────────────────────────────

export interface ClickUpColumnValue {
    id: string;
    name: string;
    type: string;
    value: unknown;
}

export interface ClickUpDataNode {
    type: 'space' | 'folder' | 'list' | 'task' | 'subtask';
    id: string;
    name: string;
    columnValues: ClickUpColumnValue[];
    children: ClickUpDataNode[];
    metadata: {
        spaceId?: string;
        spaceName?: string;
        folderId?: string;
        folderName?: string;
        listId?: string;
        listName?: string;
        parentTaskId?: string;
        status?: string;
        statusType?: string;
        creator?: { id: string; name: string };
        createdAt?: string;
        updatedAt?: string;
        url?: string;
        description?: string;
        isMilestone?: boolean;
        priority?: string;
        tags?: string[];
    };
}

export interface ClickUpListSchema {
    listId: string;
    listName: string;
    taskCount: number;
    statuses: Array<{ status: string; color: string; type: string }>;
    customFields: Array<{
        id: string;
        name: string;
        type: string;
        options?: Array<{ id: string; name: string; color: string | null }>;
    }>;
}

// ── Connector ─────────────────────────────────────────────────────────────

export class ClickUpConnector {
    private client: ClickUp;

    constructor(token: string) {
        this.client = new ClickUp({ token });
    }

    /**
     * Discover schema for a list (fields, statuses, task count).
     * Lightweight call for pre-import UI.
     */
    async discoverListSchema(listId: string): Promise<ClickUpListSchema> {
        const [list, { fields }] = await Promise.all([
            this.client.lists.get(listId),
            this.client.customFields.list(listId),
        ]);

        return {
            listId: list.id,
            listName: list.name,
            taskCount: list.task_count ?? 0,
            statuses: list.statuses.map(s => ({
                status: s.status,
                color: s.color,
                type: s.type,
            })),
            customFields: fields.map(f => ({
                id: f.id,
                name: f.name,
                type: f.type,
                options: f.type_config.options?.map(o => ({
                    id: o.id,
                    name: o.name,
                    color: o.color,
                })),
            })),
        };
    }

    /**
     * Fetch all tasks from a list as a flat array of ClickUpDataNodes.
     * Yields nodes one at a time for memory efficiency.
     */
    async *traverseHierarchy(
        listId: string,
        config?: { includeSubtasks?: boolean }
    ): AsyncGenerator<ClickUpDataNode> {
        const includeSubtasks = config?.includeSubtasks ?? true;
        const list = await this.client.lists.get(listId);

        // Yield the list node itself
        yield {
            type: 'list',
            id: list.id,
            name: list.name,
            columnValues: [],
            children: [],
            metadata: {
                spaceId: list.space.id,
                spaceName: list.space.name,
                folderId: list.folder.id,
                folderName: list.folder.name,
                listId: list.id,
                listName: list.name,
            },
        };

        // Paginate through all tasks
        let page = 0;
        while (true) {
            const { tasks } = await this.client.tasks.list(listId, {
                page,
                subtasks: includeSubtasks,
                include_closed: true,
            });

            if (!tasks || tasks.length === 0) break;

            for (const task of tasks) {
                yield this.taskToNode(task, list);
            }

            page++;
        }
    }

    /**
     * Fetch all lists in a space and yield all their tasks.
     * For full workspace migrations.
     */
    async *traverseSpace(
        spaceId: string,
        config?: { includeSubtasks?: boolean }
    ): AsyncGenerator<ClickUpDataNode> {
        // Get folders with their lists
        const { folders } = await this.client.spaces.getFolders(spaceId);

        for (const folder of folders) {
            // Yield folder node
            yield {
                type: 'folder',
                id: folder.id,
                name: folder.name,
                columnValues: [],
                children: [],
                metadata: {
                    spaceId,
                    folderId: folder.id,
                    folderName: folder.name,
                },
            };

            // Traverse each list in the folder
            for (const list of folder.lists) {
                yield* this.traverseHierarchy(list.id, config);
            }
        }

        // Also get folderless lists
        const { lists } = await this.client.lists.listInSpace(spaceId);
        for (const list of lists) {
            yield* this.traverseHierarchy(list.id, config);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private taskToNode(task: ClickUpTask, list: { id: string; name: string; space: { id: string; name?: string }; folder: { id: string; name?: string } }): ClickUpDataNode {
        const columnValues: ClickUpColumnValue[] = task.custom_fields?.map(
            (cf: ClickUpCustomFieldValue) => ({
                id: cf.id,
                name: cf.name,
                type: cf.type,
                value: cf.value,
            })
        ) ?? [];

        return {
            type: task.parent ? 'subtask' : 'task',
            id: task.id,
            name: task.name,
            columnValues,
            children: [],
            metadata: {
                spaceId: list.space.id,
                spaceName: list.space.name,
                folderId: list.folder.id,
                folderName: list.folder.name,
                listId: list.id,
                listName: list.name,
                parentTaskId: task.parent ?? undefined,
                status: task.status?.status,
                statusType: task.status?.type,
                creator: task.creator
                    ? { id: String(task.creator.id), name: task.creator.username }
                    : undefined,
                createdAt: task.date_created,
                updatedAt: task.date_updated,
                url: task.url,
                description: task.description ?? undefined,
                priority: task.priority?.priority,
                tags: task.tags?.map(t => t.name),
            },
        };
    }
}
