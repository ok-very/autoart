import type { FastifyInstance } from 'fastify';
import { previewIngestionSchema, runIngestionSchema } from './ingestion.schemas.js';
import * as ingestionService from './ingestion.service.js';
import type { ParserConfig } from './parser.types.js';

export async function ingestionRoutes(app: FastifyInstance) {
  /**
   * List available parsers.
   */
  app.get('/parsers', async (_request, reply) => {
    const parsers = ingestionService.getAvailableParsers();
    return reply.send({ parsers });
  });

  /**
   * Preview parsing (dry run).
   */
  app.post('/preview', async (request, reply) => {
    const parsed = previewIngestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { parserName, rawData, config } = parsed.data;

    try {
      const result = ingestionService.previewIngestion(
        parserName,
        rawData,
        config as ParserConfig | undefined
      );
      return reply.send(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  /**
   * Run full ingestion.
   */
  app.post('/import', async (request, reply) => {
    const parsed = runIngestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { parserName, rawData, config, targetProjectId } = parsed.data;
    const userId = (request.user as { id?: string })?.id;

    try {
      const result = await ingestionService.runIngestion({
        parserName,
        rawData,
        parserConfig: config as ParserConfig | undefined,
        targetProjectId: targetProjectId || undefined,
        userId,
      });

      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof Error && err.message.includes('Validation')) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
