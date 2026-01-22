/**
 * Runner Routes
 * 
 * Proxy endpoints for AutoHelper runner invocation.
 * All endpoints require authentication to prevent unauthorized workflow execution.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

const RunnerInvokeBodySchema = z.object({
    runner_id: z.enum(['autocollector']),
    config: z.record(z.string(), z.unknown()),
    output_folder: z.string().min(1),
    context_id: z.string().optional(),
});

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTOHELPER_TIMEOUT_MS = 30_000; // 30 seconds for status/invoke
const AUTOHELPER_STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for SSE stream

// =============================================================================
// ERRORS
// =============================================================================

class GatewayTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GatewayTimeoutError';
    }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a fetch with timeout using AbortController.
 * Throws GatewayTimeoutError on timeout to distinguish from other errors.
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new GatewayTimeoutError(`Request timed out after ${timeoutMs}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

// =============================================================================
// ROUTES
// =============================================================================

export async function runnerRoutes(app: FastifyInstance) {
    /**
     * Get runner status from AutoHelper
     * Requires authentication
     */
    app.get('/runner/status', {
        preHandler: app.authenticate
    }, async (_request, reply) => {
        try {
            const autohelperUrl = process.env.AUTOHELPER_URL || 'http://localhost:8100';
            const response = await fetchWithTimeout(
                `${autohelperUrl}/runner/status`,
                {},
                AUTOHELPER_TIMEOUT_MS
            );

            if (!response.ok) {
                return reply.status(502).send({
                    error: 'AutoHelper unavailable',
                    details: await response.text()
                });
            }

            return reply.send(await response.json());
        } catch (err) {
            // Distinguish timeout from other errors
            if (err instanceof GatewayTimeoutError) {
                return reply.status(504).send({
                    error: 'Gateway Timeout',
                    code: 'GATEWAY_TIMEOUT',
                    details: err.message
                });
            }
            return reply.status(502).send({
                error: 'Failed to connect to AutoHelper',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });

    /**
     * Invoke a runner via AutoHelper
     * Requires authentication to prevent unauthorized workflow execution
     */
    app.post('/runner/invoke', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const body = RunnerInvokeBodySchema.parse(request.body);

        try {
            const autohelperUrl = process.env.AUTOHELPER_URL || 'http://localhost:8100';

            const response = await fetchWithTimeout(
                `${autohelperUrl}/runner/invoke`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                },
                AUTOHELPER_TIMEOUT_MS
            );

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
            // Distinguish timeout from other errors
            if (err instanceof GatewayTimeoutError) {
                return reply.status(504).send({
                    error: 'Gateway Timeout',
                    code: 'GATEWAY_TIMEOUT',
                    details: err.message
                });
            }
            return reply.status(502).send({
                error: 'Failed to invoke runner',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });

    /**
     * Stream runner progress via SSE
     * Requires authentication, uses extended timeout for long-running streams
     */
    app.post('/runner/invoke/stream', {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const body = RunnerInvokeBodySchema.parse(request.body);

        try {
            const autohelperUrl = process.env.AUTOHELPER_URL || 'http://localhost:8100';

            const response = await fetchWithTimeout(
                `${autohelperUrl}/runner/invoke/stream`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                },
                AUTOHELPER_STREAM_TIMEOUT_MS
            );

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
            // Distinguish timeout from other errors
            if (err instanceof GatewayTimeoutError) {
                return reply.status(504).send({
                    error: 'Gateway Timeout',
                    code: 'GATEWAY_TIMEOUT',
                    details: err.message
                });
            }
            return reply.status(502).send({
                error: 'Failed to stream runner',
                details: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    });
}

export default runnerRoutes;
