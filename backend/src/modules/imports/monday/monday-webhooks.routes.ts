import { FastifyPluginAsync } from 'fastify';
import { mondaySyncService } from './monday-sync.service.js';

// Define types locally for now
interface MondayChallengeBody {
    challenge: string;
}

interface MondayEventBody {
    event: {
        type: string;
        value?: unknown;
        pulseId?: number;
        boardId?: number;
        columnId?: string;
        userId?: number;
        originalTriggerUuid?: string;
    };
}

const MondayWebhookRoutes: FastifyPluginAsync = async (fastify) => {

    // POST /api/webhooks/monday
    // This endpoint handles both the initial challenge verification AND the actual event notifications.
    fastify.post('/', async (request, _reply) => {
        const body = request.body as MondayChallengeBody & MondayEventBody;

        // 1. Challenge Handling (Verification)
        // When you first add a webhook URL in Monday, it sends a payload with a 'challenge' field.
        // We must return this challenge exactly as received to confirm ownership.
        if (body.challenge) {
            return { challenge: body.challenge };
        }

        // 2. Event Processing
        // If it's not a challenge, it's a notification event.
        // We forward this to the sync service for asynchronous processing.
        if (body.event) {
            request.log.info({ event: body.event }, 'Received Monday webhook event');

            mondaySyncService.handleWebhookEvent(body.event)
                .catch(err => {
                    request.log.error({ err, event: body.event }, 'Failed to process Monday webhook event');
                });
        }

        return { success: true };
    });
};

export default MondayWebhookRoutes;
