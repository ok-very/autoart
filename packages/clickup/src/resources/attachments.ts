/**
 * ClickUp Attachments resource
 *
 * Requires Node 18+ for native FormData/Blob support.
 */

import type { ClickUpClient } from '../client.js';
import type { ClickUpAttachment } from '../types.js';

export class AttachmentsResource {
    constructor(private client: ClickUpClient) {}

    /**
     * Upload a file to a task as an attachment.
     * Uses multipart/form-data via the client's requestRaw method.
     *
     * @param file - A Blob, Buffer, or any value accepted by FormData.append
     * @param filename - The filename for the attachment
     */
    async upload(
        taskId: string,
        file: Blob | Buffer,
        filename: string,
        query?: { custom_task_ids?: boolean; team_id?: number }
    ): Promise<ClickUpAttachment> {
        const formData = new globalThis.FormData();
        const blob = file instanceof globalThis.Blob ? file : new globalThis.Blob([file]);
        formData.append('attachment', blob, filename);

        return this.client.requestRaw<ClickUpAttachment>(
            'POST',
            `/task/${taskId}/attachment`,
            formData,
            query as Record<string, string | number | boolean | undefined>
        );
    }
}
