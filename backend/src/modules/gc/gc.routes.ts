/**
 * Garbage Collection Routes
 *
 * API endpoints for garbage collection monitoring and stats:
 * - GET /stats - Get stale session counts and oldest ages
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

const StatsQuerySchema = z.object({
    retention_days: z.coerce.number().int().positive().default(7),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function gcRoutes(app: FastifyInstance) {
    /**
     * Get garbage collection stats
     * Returns counts and oldest ages of stale sessions for monitoring
     */
    app.get('/stats', async (request, reply) => {
        const { retention_days } = StatsQuerySchema.parse(request.query);

        const { db } = await import('../../db/client.js');

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retention_days);

        // Get import session stats
        const importStats = await db
            .selectFrom('import_sessions')
            .select(({ fn }) => [
                fn.count<number>('id').as('stale_count'),
                fn.min('created_at').as('oldest_created_at'),
            ])
            .where('created_at', '<', cutoffDate)
            .executeTakeFirst();

        // Get export session stats
        const exportStats = await db
            .selectFrom('export_sessions')
            .select(({ fn }) => [
                fn.count<number>('id').as('stale_count'),
                fn.min('created_at').as('oldest_created_at'),
            ])
            .where('created_at', '<', cutoffDate)
            .executeTakeFirst();

        // Calculate oldest age in days
        const now = new Date();
        const importOldestAge = importStats?.oldest_created_at
            ? Math.floor((now.getTime() - new Date(importStats.oldest_created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        const exportOldestAge = exportStats?.oldest_created_at
            ? Math.floor((now.getTime() - new Date(exportStats.oldest_created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        return reply.send({
            retention_days,
            import_sessions: {
                stale_count: Number(importStats?.stale_count ?? 0),
                oldest_age_days: importOldestAge,
            },
            export_sessions: {
                stale_count: Number(exportStats?.stale_count ?? 0),
                oldest_age_days: exportOldestAge,
            },
        });
    });
}

export default gcRoutes;
