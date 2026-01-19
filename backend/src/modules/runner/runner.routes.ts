/**
 * Runner Routes
 * 
 * Proxy endpoints for AutoHelper runner invocation.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

const RunnerInvokeBodySchema = z.object({
    runner_id: z.enum(['autocollector']),
    config: z.record(z.unknown()),
    output_folder: z.string().min(1),
    context_id: z.string().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function runnerRoutes(app: FastifyInstance) {
    /**
     * Get runner status from AutoHelper
     */
    app.get('/runner/status', async (_request, reply) => {
        try {
            const autohelperUrl = process.env.AUTOHELPER_URL || 'http://localhost:8100';
            const response = await fetch(`${autohelperUrl}/runner/status`);

            if (!response.ok) {
                return reply.status(502).send({
                    error: 'AutoHelper unavailable',
                    details: await response.text()
                });
            }

            return reply.send(await response.json());
        } catch (err) {
            return reply.status(502).send({
                error: 'Failed to connect to AutoHelper',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });

    /**
     * Invoke a runner via AutoHelper
     */
    app.post('/runner/invoke', async (request, reply) => {
        const body = RunnerInvokeBodySchema.parse(request.body);

        try {
            const autohelperUrl = process.env.AUTOHELPER_URL || 'http://localhost:8100';

            const response = await fetch(`${autohelperUrl}/runner/invoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return reply.status(response.status).send({
                    error: 'Runner invocation failed',
                    details: errorText
                });
            }

            const result = await response.json();
            return reply.send(result);

        } catch (err) {
            return reply.status(502).send({
                error: 'Failed to invoke runner',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });

    /**
     * Stream runner progress via SSE
     */
    app.post('/runner/invoke/stream', async (request, reply) => {
        const body = RunnerInvokeBodySchema.parse(request.body);

        try {
            const autohelperUrl = process.env.AUTOHELPER_URL || 'http://localhost:8100';

            const response = await fetch(`${autohelperUrl}/runner/invoke/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                return reply.status(response.status).send({
                    error: 'Runner stream failed'
                });
            }

            // Forward SSE stream
            reply.raw.setHeader('Content-Type', 'text/event-stream');
            reply.raw.setHeader('Cache-Control', 'no-cache');
            reply.raw.setHeader('Connection', 'keep-alive');

            const reader = response.body?.getReader();
            if (!reader) {
                return reply.status(500).send({ error: 'No response body' });
            }

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                reply.raw.write(decoder.decode(value));
            }

            reply.raw.end();

        } catch (err) {
            return reply.status(502).send({
                error: 'Failed to stream runner',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });
}

export default runnerRoutes;
