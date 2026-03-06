/**
 * ClickUp REST API Client
 *
 * Low-level HTTP wrapper with rate limiting, retries, and typed responses.
 * Base URL: https://api.clickup.com/api/v2
 */

import type { ClickUpClientConfig } from './types.js';

export class ClickUpApiError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly body?: unknown
    ) {
        super(message);
        this.name = 'ClickUpApiError';
    }
}

const DEFAULT_BASE_URL = 'https://api.clickup.com/api/v2';
const RATE_LIMIT_DELAY_MS = 1500;

export class ClickUpClient {
    private token: string;
    private baseUrl: string;
    private maxRetries: number;

    constructor(config: ClickUpClientConfig) {
        this.token = config.token;
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
        this.maxRetries = config.maxRetries ?? 3;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        query?: Record<string, string | number | boolean | undefined>
    ): Promise<T> {
        const url = new URL(`${this.baseUrl}${path}`);
        if (query) {
            for (const [key, val] of Object.entries(query)) {
                if (val !== undefined) url.searchParams.set(key, String(val));
            }
        }

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            const res = await fetch(url.toString(), {
                method,
                headers: {
                    'Authorization': this.token,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            // Rate limited — wait and retry
            if (res.status === 429) {
                const retryAfter = res.headers.get('retry-after');
                const delayMs = retryAfter
                    ? parseInt(retryAfter, 10) * 1000
                    : RATE_LIMIT_DELAY_MS * (attempt + 1);
                await this.sleep(delayMs);
                lastError = new ClickUpApiError('Rate limited', 429);
                continue;
            }

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                let parsed: unknown;
                try { parsed = JSON.parse(text); } catch { parsed = text; }
                throw new ClickUpApiError(
                    `ClickUp API ${method} ${path} failed: ${res.status} ${res.statusText}`,
                    res.status,
                    parsed
                );
            }

            // 204 No Content (delete operations)
            if (res.status === 204) return undefined as T;

            return (await res.json()) as T;
        }

        throw lastError ?? new ClickUpApiError('Max retries exceeded', 429);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Raw request for non-JSON bodies (e.g. multipart/form-data uploads).
     * Does not set Content-Type or stringify body — caller provides FormData directly.
     */
    async requestRaw<T>(
        method: string,
        path: string,
        body: unknown,
        query?: Record<string, string | number | boolean | undefined>
    ): Promise<T> {
        const url = new URL(`${this.baseUrl}${path}`);
        if (query) {
            for (const [key, val] of Object.entries(query)) {
                if (val !== undefined) url.searchParams.set(key, String(val));
            }
        }

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            const res = await fetch(url.toString(), {
                method,
                headers: { 'Authorization': this.token },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                body: body as any,
            });

            if (res.status === 429) {
                const retryAfter = res.headers.get('retry-after');
                const delayMs = retryAfter
                    ? parseInt(retryAfter, 10) * 1000
                    : RATE_LIMIT_DELAY_MS * (attempt + 1);
                await this.sleep(delayMs);
                lastError = new ClickUpApiError('Rate limited', 429);
                continue;
            }

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                let parsed: unknown;
                try { parsed = JSON.parse(text); } catch { parsed = text; }
                throw new ClickUpApiError(
                    `ClickUp API ${method} ${path} failed: ${res.status} ${res.statusText}`,
                    res.status,
                    parsed
                );
            }

            if (res.status === 204) return undefined as T;
            return (await res.json()) as T;
        }

        throw lastError ?? new ClickUpApiError('Max retries exceeded', 429);
    }

    // ── Public HTTP methods ───────────────────────────────────────────────

    async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
        return this.request<T>('GET', path, undefined, query);
    }

    async post<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
        return this.request<T>('POST', path, body, query);
    }

    async put<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
        return this.request<T>('PUT', path, body, query);
    }

    async delete<T = void>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
        return this.request<T>('DELETE', path, undefined, query);
    }
}
