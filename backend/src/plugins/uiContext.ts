/**
 * UI Context Plugin for Fastify
 *
 * Parses the x-ui-context header and attaches it to the request for logging.
 * This is purely diagnostic - missing context does NOT cause errors.
 *
 * @module plugins/uiContext
 */

import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export interface UIContext {
    component?: string;
    action?: string;
    elementId?: string;
    view?: string;
    timestamp?: number;
}

declare module 'fastify' {
    interface FastifyRequest {
        uiContext?: UIContext;
    }
}

const UI_CONTEXT_HEADER = 'x-ui-context';

export default fp(
    async (fastify) => {
        fastify.decorateRequest('uiContext', undefined);

        fastify.addHook('onRequest', async (request: FastifyRequest) => {
            const contextHeader = request.headers[UI_CONTEXT_HEADER];

            if (!contextHeader || typeof contextHeader !== 'string') {
                return; // No context - that's fine, it's optional
            }

            try {
                const context = JSON.parse(contextHeader) as UIContext;
                request.uiContext = context;
            } catch {
                // Invalid JSON - ignore, don't block the request
                request.log.debug('Invalid UI context header, ignoring');
            }
        });

        // Add hook to include UI context in logs for mutations
        fastify.addHook('onResponse', async (request, reply) => {
            // Only log context for mutations (POST, PATCH, PUT, DELETE)
            const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);

            if (isMutation && request.uiContext) {
                request.log.info({
                    msg: 'API mutation with UI context',
                    method: request.method,
                    url: request.url,
                    statusCode: reply.statusCode,
                    uiContext: request.uiContext,
                });
            }
        });
    },
    {
        name: 'ui-context',
        fastify: '5.x',
    }
);
