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
import { CommentsResource } from './resources/comments.js';
import { AttachmentsResource } from './resources/attachments.js';
import { ChecklistsResource } from './resources/checklists.js';
import { TimeTrackingResource } from './resources/time-tracking.js';
import { TagsResource } from './resources/tags.js';
import { GoalsResource } from './resources/goals.js';
import { WebhooksResource } from './resources/webhooks.js';
import { ViewsResource } from './resources/views.js';
import { MembersResource } from './resources/members.js';
import { UsersResource } from './resources/users.js';
import { TemplatesResource } from './resources/templates.js';
import { DocsResource } from './resources/docs.js';
import { DependenciesResource } from './resources/dependencies.js';
import type { ClickUpClientConfig } from './types.js';

export class ClickUp {
    public readonly tasks: TasksResource;
    public readonly lists: ListsResource;
    public readonly customFields: CustomFieldsResource;
    public readonly spaces: SpacesResource;
    public readonly comments: CommentsResource;
    public readonly attachments: AttachmentsResource;
    public readonly checklists: ChecklistsResource;
    public readonly timeTracking: TimeTrackingResource;
    public readonly tags: TagsResource;
    public readonly goals: GoalsResource;
    public readonly webhooks: WebhooksResource;
    public readonly views: ViewsResource;
    public readonly members: MembersResource;
    public readonly users: UsersResource;
    public readonly templates: TemplatesResource;
    public readonly dependencies: DependenciesResource;

    /** Docs resource (v3 API). Only available if workspaceId was provided in config. */
    public readonly docs: DocsResource | undefined;

    /** Expose the raw client for advanced/custom requests */
    public readonly client: ClickUpClient;

    constructor(config: ClickUpClientConfig) {
        this.client = new ClickUpClient(config);
        this.tasks = new TasksResource(this.client);
        this.lists = new ListsResource(this.client);
        this.customFields = new CustomFieldsResource(this.client);
        this.spaces = new SpacesResource(this.client);
        this.comments = new CommentsResource(this.client);
        this.attachments = new AttachmentsResource(this.client);
        this.checklists = new ChecklistsResource(this.client);
        this.timeTracking = new TimeTrackingResource(this.client);
        this.tags = new TagsResource(this.client);
        this.goals = new GoalsResource(this.client);
        this.webhooks = new WebhooksResource(this.client);
        this.views = new ViewsResource(this.client);
        this.members = new MembersResource(this.client);
        this.users = new UsersResource(this.client);
        this.templates = new TemplatesResource(this.client);
        this.dependencies = new DependenciesResource(this.client);
        this.docs = config.workspaceId
            ? new DocsResource(this.client, config.workspaceId)
            : undefined;
    }
}
