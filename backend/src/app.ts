import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { hierarchyRoutes } from './modules/hierarchy/hierarchy.routes.js';
import { recordsRoutes } from './modules/records/records.routes.js';
import { factKindsRoutes } from './modules/records/fact-kinds.routes.js';
import { referencesRoutes } from './modules/references/references.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { linksRoutes } from './modules/links/links.routes.js';
import { ingestionRoutes } from './modules/ingestion/ingestion.routes.js';
import { actionsRoutes } from './modules/actions/actions.routes.js';
import { actionReferencesRoutes } from './modules/actions/action-references.routes.js';
import { eventsRoutes } from './modules/events/events.routes.js';
import { workflowRoutes } from './modules/events/workflow.routes.js';
import { workflowSurfaceRoutes } from './modules/projections/workflow-surface.routes.js';
import { composerRoutes } from './modules/composer/composer.routes.js';
import { containersRoutes } from './modules/actions/containers.routes.js';
import { importsRoutes } from './modules/imports/imports.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Register plugins
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await fastify.register(cookie, {
    secret: env.JWT_SECRET,
    parseOptions: {},
  });

  await fastify.register(sensible);
  await fastify.register(authPlugin);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(hierarchyRoutes, { prefix: '/api/hierarchy' });
  await fastify.register(recordsRoutes, { prefix: '/api/records' });
  await fastify.register(referencesRoutes, { prefix: '/api/references' });
  await fastify.register(searchRoutes, { prefix: '/api/search' });
  await fastify.register(linksRoutes, { prefix: '/api/links' });
  await fastify.register(ingestionRoutes, { prefix: '/api/ingestion' });

  // Foundational model routes (Actions & Events)
  await fastify.register(actionsRoutes, { prefix: '/api/actions' });
  await fastify.register(actionReferencesRoutes, { prefix: '/api/actions' });
  await fastify.register(eventsRoutes, { prefix: '/api/events' });
  await fastify.register(workflowRoutes, { prefix: '/api/workflow' });
  await fastify.register(workflowSurfaceRoutes, { prefix: '/api/workflow' });

  // Composer - Task Builder on Actions + Events (replaces legacy task creation)
  await fastify.register(composerRoutes, { prefix: '/api/composer' });

  // Container actions - hierarchical structure (Process, Stage, Subprocess)
  await fastify.register(containersRoutes, { prefix: '/api/containers' });

  // Import sessions - new projection-driven import workflow
  await fastify.register(importsRoutes, { prefix: '/api/imports' });

  // Fact kind definitions - Definition Review UI
  await fastify.register(factKindsRoutes, { prefix: '/api' });

  // Global error handler
  fastify.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number; code?: string }, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
      });
    }

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : error.message;

    return reply.code(statusCode).send({
      error: error.code || 'ERROR',
      message,
    });
  });

  return fastify;
}
