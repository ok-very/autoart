/**
 * AutoHelper Routes
 *
 * Endpoints for the AutoHelper settings bridge:
 * - Frontend-facing: Settings CRUD, status, command queueing
 * - AutoHelper-facing: Poll, heartbeat, command acknowledgment
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as autohelperService from './autohelper.service.js';
import { validateLinkKey, revokeLinkKeyByValue } from '../imports/connections.service.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const SettingsUpdateSchema = z.object({
  allowed_roots: z.array(z.string()).optional(),
  excludes: z.array(z.string()).optional(),
  mail_enabled: z.boolean().optional(),
  mail_poll_interval: z.number().int().min(5).max(3600).optional(),
  crawl_depth: z.number().int().min(1).max(100).optional(),
  min_width: z.number().int().min(1).optional(),
  max_width: z.number().int().min(1).optional(),
  min_height: z.number().int().min(1).optional(),
  max_height: z.number().int().min(1).optional(),
  min_filesize_kb: z.number().int().min(0).optional(),
  max_filesize_kb: z.number().int().min(0).optional(),
});

const QueueCommandSchema = z.object({
  commandType: z.enum([
    'rescan_index',
    'rebuild_index',
    'run_collector',
    'start_mail',
    'stop_mail',
    'run_gc',
  ]),
  payload: z
    .object({
      url: z.string().url().optional(),
      output_path: z.string().optional(),
    })
    .optional(),
});

const HeartbeatSchema = z.object({
  status: z.object({
    database: z
      .object({
        connected: z.boolean(),
        path: z.string(),
        migration_status: z.string(),
      })
      .optional(),
    roots: z
      .array(
        z.object({
          path: z.string(),
          accessible: z.boolean(),
          file_count: z.number().nullish(),
        })
      )
      .optional(),
    runner: z
      .object({
        active: z.boolean(),
        current_runner: z.string().nullish(),
      })
      .optional(),
    mail: z
      .object({
        enabled: z.boolean(),
        running: z.boolean(),
      })
      .optional(),
    index: z
      .object({
        status: z.string(),
        total_files: z.number().nullish(),
        last_run: z.string().nullish(),
      })
      .optional(),
    gc: z
      .object({
        enabled: z.boolean(),
        last_run: z.string().nullish(),
      })
      .optional(),
  }),
});

const AckCommandSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract and validate AutoHelper link key from request header.
 * Returns userId if valid, null otherwise.
 */
async function getAutoHelperUserId(
  request: { headers: Record<string, string | string[] | undefined> }
): Promise<string | null> {
  const keyHeader = request.headers['x-autohelper-key'];
  const key = Array.isArray(keyHeader) ? keyHeader[0] ?? '' : keyHeader ?? '';

  if (!key) {
    return null;
  }

  return validateLinkKey(key);
}

// ============================================================================
// ROUTES
// ============================================================================

export async function autohelperRoutes(app: FastifyInstance) {
  // ==========================================================================
  // FRONTEND-FACING ROUTES (authenticated)
  // ==========================================================================

  /**
   * Get settings for current user.
   */
  app.get(
    '/autohelper/settings',
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { settings, version } = await autohelperService.getSettings(userId);

      return reply.send({ settings, version });
    }
  );

  /**
   * Update settings (partial merge), bump version.
   */
  app.put(
    '/autohelper/settings',
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const updates = SettingsUpdateSchema.parse(request.body);

      const { settings, version } = await autohelperService.updateSettings(
        userId,
        updates
      );

      return reply.send({ settings, version });
    }
  );

  /**
   * Get cached status + last seen + pending commands.
   */
  app.get(
    '/autohelper/status',
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { status, lastSeen, pendingCommands } =
        await autohelperService.getStatus(userId);

      return reply.send({
        status,
        lastSeen: lastSeen?.toISOString() ?? null,
        pendingCommands,
      });
    }
  );

  /**
   * Queue a command for AutoHelper execution.
   */
  app.post(
    '/autohelper/commands',
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { commandType, payload } = QueueCommandSchema.parse(request.body);

      const command = await autohelperService.queueCommand(
        userId,
        commandType,
        payload
      );

      return reply.status(201).send({
        id: command.id,
        type: command.command_type,
        status: command.status,
      });
    }
  );

  /**
   * Get command status + result.
   */
  app.get(
    '/autohelper/commands/:id',
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const command = await autohelperService.getCommand(id);

      if (!command) {
        return reply.status(404).send({ error: 'Command not found' });
      }

      // Verify ownership
      if (command.user_id !== request.user.userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      return reply.send({
        id: command.id,
        type: command.command_type,
        status: command.status,
        payload: command.payload,
        result: command.result,
        createdAt: command.created_at.toISOString(),
        acknowledgedAt: command.acknowledged_at?.toISOString() ?? null,
      });
    }
  );

  // ==========================================================================
  // AUTOHELPER-FACING ROUTES (X-AutoHelper-Key auth)
  // ==========================================================================

  /**
   * Poll for settings + pending commands.
   * AutoHelper calls this every 5 seconds.
   */
  app.get('/autohelper/poll', async (request, reply) => {
    const userId = await getAutoHelperUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Invalid or missing link key',
        message: 'Re-pair with AutoArt to get a valid link key',
      });
    }

    const { settings, settingsVersion, commands } =
      await autohelperService.poll(userId);

    return reply.send({
      settings,
      settingsVersion,
      commands: commands.map((c) => ({
        id: c.id,
        type: c.command_type,
        payload: c.payload,
      })),
    });
  });

  /**
   * Report status (heartbeat).
   * AutoHelper calls this every 5 seconds with current status.
   */
  app.post('/autohelper/heartbeat', async (request, reply) => {
    const userId = await getAutoHelperUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Invalid or missing link key',
      });
    }

    const { status } = HeartbeatSchema.parse(request.body);

    await autohelperService.updateStatus(userId, status);

    return reply.send({ ok: true });
  });

  /**
   * Mark command as running.
   */
  app.post('/autohelper/commands/:id/start', async (request, reply) => {
    const userId = await getAutoHelperUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Invalid or missing link key',
      });
    }

    const { id } = request.params as { id: string };
    const command = await autohelperService.getCommand(id);

    if (!command) {
      return reply.status(404).send({ error: 'Command not found' });
    }

    if (command.user_id !== userId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    await autohelperService.markCommandRunning(id);

    return reply.send({ ok: true });
  });

  /**
   * Acknowledge command completion.
   */
  app.post('/autohelper/commands/:id/ack', async (request, reply) => {
    const userId = await getAutoHelperUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Invalid or missing link key',
      });
    }

    const { id } = request.params as { id: string };
    const command = await autohelperService.getCommand(id);

    if (!command) {
      return reply.status(404).send({ error: 'Command not found' });
    }

    if (command.user_id !== userId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const { success, result } = AckCommandSchema.parse(request.body);

    await autohelperService.acknowledgeCommand(id, success, result);

    return reply.send({ ok: true });
  });

  /**
   * AutoHelper self-unpair: revoke its own link key.
   * Called by tray when user clicks Unpair.
   */
  app.delete('/autohelper/unpair', async (request, reply) => {
    const keyHeader = request.headers['x-autohelper-key'];
    const key = Array.isArray(keyHeader) ? keyHeader[0] ?? '' : keyHeader ?? '';

    if (!key) {
      return reply.status(400).send({ error: 'Missing x-autohelper-key header' });
    }

    const revoked = await revokeLinkKeyByValue(key);

    return reply.send({ revoked });
  });
}

export default autohelperRoutes;
