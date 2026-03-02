/**
 * ClickUp — High-level API client
 *
 * Usage:
 *   const clickup = new ClickUp({ token: 'pk_...' });
 *   const task = await clickup.tasks.create(listId, { name: 'My Task' });
 */

import { ClickUpClient } from './client.js';
import { TasksResource } from './resources/tasks.js';
import { ListsResource } from './resources/lists.js';
import { CustomFieldsResource } from './resources/custom-fields.js';
import { SpacesResource } from './resources/spaces.js';
import type { ClickUpClientConfig } from './types.js';

export class ClickUp {
    public readonly tasks: TasksResource;
    public readonly lists: ListsResource;
    public readonly customFields: CustomFieldsResource;
    public readonly spaces: SpacesResource;

    /** Expose the raw client for advanced/custom requests */
    public readonly client: ClickUpClient;

    constructor(config: ClickUpClientConfig) {
        this.client = new ClickUpClient(config);
        this.tasks = new TasksResource(this.client);
        this.lists = new ListsResource(this.client);
        this.customFields = new CustomFieldsResource(this.client);
        this.spaces = new SpacesResource(this.client);
    }
}
