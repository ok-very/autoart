/**
 * Mail Routes
 *
 * API endpoints for email listing and triage updates.
 */

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import {
    ListEmailsResponseSchema,
    UpdateTriageBodySchema,
    EmailParamsSchema,
    EmailSchema,
} from './mail.schema.js';
import * as mailService from './mail.service.js';

export async function mailRoutes(fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    /**
     * GET /api/mail/emails
     * List all emails
     */
    app.get(
        '/emails',
        {
            schema: {
                response: {
                    200: ListEmailsResponseSchema,
                },
            },
        },
        async () => {
            return mailService.listEmails();
        }
    );

    /**
     * GET /api/mail/emails/:id
     * Get a single email
     */
    app.get(
        '/emails/:id',
        {
            schema: {
                params: EmailParamsSchema,
                response: {
                    200: EmailSchema,
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params;
            const email = await mailService.getEmailById(id);
            if (!email) {
                return reply.notFound(`Email ${id} not found`);
            }
            return email;
        }
    );

    /**
     * POST /api/mail/emails/:id/triage
     * Update triage status
     */
    app.post(
        '/emails/:id/triage',
        {
            schema: {
                params: EmailParamsSchema,
                body: UpdateTriageBodySchema,
                response: {
                    200: EmailSchema,
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params;
            const update = request.body;
            const email = await mailService.updateTriage(id, update);
            if (!email) {
                return reply.notFound(`Email ${id} not found`);
            }
            return email;
        }
    );
}
