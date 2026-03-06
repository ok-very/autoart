/**
 * ClickUp Docs resource (v3 API)
 *
 * Uses path trick: /../v3/workspaces/{wid}/docs to resolve against v2 base URL.
 * URL normalization converts /api/v2/../v3/ → /api/v3/
 */

import type { ClickUpClient } from '../client.js';
import type {
    ClickUpDoc,
    ClickUpDocPage,
    CreateDocData,
    CreateDocPageData,
    UpdateDocPageData,
} from '../types.js';

export class DocsResource {
    constructor(
        private client: ClickUpClient,
        private workspaceId: string
    ) {}

    private v3(path: string): string {
        return `/../v3/workspaces/${this.workspaceId}${path}`;
    }

    /** Search docs in the workspace */
    async search(query?: string): Promise<{ docs: ClickUpDoc[] }> {
        return this.client.get<{ docs: ClickUpDoc[] }>(this.v3('/docs'), query ? { query } : undefined);
    }

    /** Get a single doc */
    async get(docId: string): Promise<ClickUpDoc> {
        return this.client.get<ClickUpDoc>(this.v3(`/docs/${docId}`));
    }

    /** Create a doc */
    async create(data: CreateDocData): Promise<ClickUpDoc> {
        return this.client.post<ClickUpDoc>(this.v3('/docs'), data);
    }

    /** Get all pages in a doc */
    async getPages(docId: string, maxDepth?: number): Promise<{ pages: ClickUpDocPage[] }> {
        return this.client.get<{ pages: ClickUpDocPage[] }>(this.v3(`/docs/${docId}/pages`), {
            max_page_depth: maxDepth ?? -1,
        });
    }

    /** Get a single page */
    async getPage(docId: string, pageId: string, contentFormat?: 'text/md' | 'text/html'): Promise<ClickUpDocPage> {
        return this.client.get<ClickUpDocPage>(this.v3(`/docs/${docId}/pages/${pageId}`), {
            content_format: contentFormat,
        });
    }

    /** Create a page in a doc */
    async createPage(docId: string, data: CreateDocPageData): Promise<ClickUpDocPage> {
        return this.client.post<ClickUpDocPage>(this.v3(`/docs/${docId}/pages`), data);
    }

    /** Update a page */
    async updatePage(docId: string, pageId: string, data: UpdateDocPageData): Promise<ClickUpDocPage> {
        return this.client.put<ClickUpDocPage>(this.v3(`/docs/${docId}/pages/${pageId}`), data);
    }
}
