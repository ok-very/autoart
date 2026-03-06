/**
 * ClickUp Webhooks resource
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpWebhook, CreateWebhookData } from '../types.js';

export class WebhooksResource {
    constructor(private client: ClickUpClient) {}

    /** Get all webhooks in a workspace */
    async list(teamId: string): Promise<{ webhooks: ClickUpWebhook[] }> {
        return this.client.get<{ webhooks: ClickUpWebhook[] }>(`/team/${teamId}/webhook`);
    }

    /** Create a webhook */
    async create(teamId: string, data: CreateWebhookData): Promise<{ webhook: ClickUpWebhook }> {
        return this.client.post<{ webhook: ClickUpWebhook }>(`/team/${teamId}/webhook`, data);
    }

    /** Update a webhook */
    async update(webhookId: string, data: Partial<CreateWebhookData>): Promise<{ webhook: ClickUpWebhook }> {
        return this.client.put<{ webhook: ClickUpWebhook }>(`/webhook/${webhookId}`, data);
    }

    /** Delete a webhook */
    async delete(webhookId: string): Promise<void> {
        await this.client.delete(`/webhook/${webhookId}`);
    }
}
