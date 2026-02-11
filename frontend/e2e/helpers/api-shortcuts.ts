/**
 * API Shortcut Helpers
 *
 * Direct API calls for fast test setup/teardown.
 * Skips UI for non-tested steps (e.g. seed a session via API,
 * then test only the execution UI).
 *
 * Uses Playwright's APIRequestContext which shares cookies/auth
 * with the browser context.
 *
 * Backend API prefix: /api/imports
 */

import type { APIRequestContext } from '@playwright/test';

// ============================================================================
// TYPES (mirror relevant backend response shapes)
// ============================================================================

export interface ApiImportSession {
    id: string;
    parser_name: string;
    status: string;
    created_at: string;
}

export interface ApiImportPlan {
    sessionId: string;
    containers: unknown[];
    items: unknown[];
    validationIssues: unknown[];
    classifications: unknown[];
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create an import session directly via API.
 * Bypasses the UI file upload / paste flow.
 */
export async function createImportSessionViaAPI(
    request: APIRequestContext,
    csvData: string,
    parserName: string = 'monday',
): Promise<ApiImportSession> {
    const response = await request.post('/api/imports/sessions', {
        data: {
            parserName,
            rawData: csvData,
        },
    });

    if (!response.ok()) {
        throw new Error(`Failed to create session: ${response.status()} ${await response.text()}`);
    }

    return response.json();
}

/**
 * Generate an import plan for a session via API.
 */
export async function generatePlanViaAPI(
    request: APIRequestContext,
    sessionId: string,
): Promise<ApiImportPlan> {
    const response = await request.post(`/api/imports/sessions/${sessionId}/plan`, {
        data: {},
    });

    if (!response.ok()) {
        throw new Error(`Failed to generate plan: ${response.status()} ${await response.text()}`);
    }

    return response.json();
}

/**
 * Execute an import session via API.
 */
export async function executeImportViaAPI(
    request: APIRequestContext,
    sessionId: string,
): Promise<unknown> {
    const response = await request.post(`/api/imports/sessions/${sessionId}/execute`, {
        data: {},
    });

    if (!response.ok()) {
        throw new Error(`Failed to execute import: ${response.status()} ${await response.text()}`);
    }

    return response.json();
}

/**
 * Delete stale import sessions (cleanup).
 */
export async function cleanupStaleSessions(
    request: APIRequestContext,
    olderThanDays: number = 1,
): Promise<{ deleted_count: number }> {
    const response = await request.delete(
        `/api/imports/sessions/stale?older_than_days=${olderThanDays}`,
    );

    if (!response.ok()) {
        throw new Error(`Failed to cleanup sessions: ${response.status()} ${await response.text()}`);
    }

    return response.json();
}
