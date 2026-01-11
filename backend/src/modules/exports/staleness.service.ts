/**
 * Staleness Detection Service
 *
 * Detects projects without recent updates.
 * Helps identify projects that may need attention before export.
 */

import { db } from '../../db/client.js';
import type { StaleProjectInfo } from './types.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Detect projects that haven't been updated recently.
 * 
 * @param projectIds - Project IDs to check
 * @param thresholdDays - Days since last update to consider stale (default 7)
 * @returns List of projects with staleness info
 */
export async function detectStaleProjects(
    projectIds: string[],
    thresholdDays: number = 7
): Promise<StaleProjectInfo[]> {
    const results: StaleProjectInfo[] = [];
    const now = new Date();

    for (const projectId of projectIds) {
        // Get project info
        const project = await db
            .selectFrom('hierarchy_nodes')
            .select(['id', 'title', 'metadata'])
            .where('id', '=', projectId)
            .where('type', '=', 'project')
            .executeTakeFirst();

        if (!project) continue;

        // Check if project is on hold (exclude from staleness)
        const metadata = project.metadata as Record<string, unknown> | null;
        const status = metadata?.status as string | undefined;
        if (status && status.toUpperCase().includes('HOLD')) {
            continue;
        }

        // Get most recent event/action for this project
        const recentEvent = await db
            .selectFrom('events')
            .select(['occurred_at'])
            .where('context_id', '=', projectId)
            .orderBy('occurred_at', 'desc')
            .limit(1)
            .executeTakeFirst();

        const recentAction = await db
            .selectFrom('actions')
            .select(['created_at'])
            .where('context_id', '=', projectId)
            .orderBy('created_at', 'desc')
            .limit(1)
            .executeTakeFirst();

        // Find most recent update
        let lastUpdateDate: Date;
        if (recentEvent && recentAction) {
            lastUpdateDate = recentEvent.occurred_at > recentAction.created_at
                ? recentEvent.occurred_at
                : recentAction.created_at;
        } else if (recentEvent) {
            lastUpdateDate = recentEvent.occurred_at;
        } else if (recentAction) {
            lastUpdateDate = recentAction.created_at;
        } else {
            // No events or actions - use project creation date
            const createdAt = await db
                .selectFrom('hierarchy_nodes')
                .select(['created_at'])
                .where('id', '=', projectId)
                .executeTakeFirst();

            lastUpdateDate = createdAt?.created_at ?? now;
        }

        // Calculate staleness
        const daysSinceUpdate = Math.floor(
            (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const isStale = daysSinceUpdate > thresholdDays;

        results.push({
            projectId: project.id,
            projectName: project.title ?? 'Untitled Project',
            lastUpdateDate,
            daysSinceUpdate,
            isStale,
        });
    }

    return results;
}

/**
 * Get only stale projects (convenience filter).
 */
export async function getStaleProjects(
    projectIds: string[],
    thresholdDays: number = 7
): Promise<StaleProjectInfo[]> {
    const all = await detectStaleProjects(projectIds, thresholdDays);
    return all.filter(p => p.isStale);
}

/**
 * Get staleness summary statistics.
 */
export async function getStalenessSummary(
    projectIds: string[],
    thresholdDays: number = 7
): Promise<{
    total: number;
    stale: number;
    fresh: number;
    averageDaysSinceUpdate: number;
}> {
    const all = await detectStaleProjects(projectIds, thresholdDays);
    const stale = all.filter(p => p.isStale);
    const avgDays = all.length > 0
        ? Math.round(all.reduce((sum, p) => sum + p.daysSinceUpdate, 0) / all.length)
        : 0;

    return {
        total: all.length,
        stale: stale.length,
        fresh: all.length - stale.length,
        averageDaysSinceUpdate: avgDays,
    };
}
