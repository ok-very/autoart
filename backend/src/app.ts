import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { actionReferencesRoutes } from './modules/actions/action-references.routes.js';
import { actionTypesRoutes } from './modules/actions/action-types.routes.js';
import { actionsRoutes } from './modules/actions/actions.routes.js';
import { containersRoutes } from './modules/actions/containers.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { composerRoutes } from './modules/composer/composer.routes.js';
import { eventsRoutes } from './modules/events/events.routes.js';
import { workflowRoutes } from './modules/events/workflow.routes.js';
import { hierarchyRoutes } from './modules/hierarchy/hierarchy.routes.js';
import { importsRoutes } from './modules/imports/imports.routes.js';
import { linksRoutes } from './modules/links/links.routes.js';
import { factKindsRoutes } from './modules/records/fact-kinds.routes.js';
import { recordsRoutes } from './modules/records/records.routes.js';
import { referencesRoutes } from './modules/references/references.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { workflowSurfaceRoutes } from './modules/projections/workflow-surface.routes.js';
import { connectionsRoutes } from './modules/imports/connections.routes.js';
import { mondayWorkspaceRoutes } from './modules/imports/monday/monday-workspace.routes.js';
import { definitionsRoutes } from './modules/definitions/index.js';
import { runnerRoutes } from './modules/runner/runner.routes.js';
import { intakeRoutes, intakePublicRoutes } from './modules/intake/intake.routes.js';
import { exportsRoutes } from './modules/exports/exports.routes.js';
import { gcRoutes } from './modules/gc/gc.routes.js';
import authPlugin from './plugins/auth.js';
import { errorHandler, notFoundHandler } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';

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

  // Parse and log CORS origins for debugging
  const corsOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
  console.log('CORS origins configured:', JSON.stringify(corsOrigins));

  await fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
  // ingestion routes deprecated - use /api/imports instead

  // Foundational model routes (Actions & Events)
  await fastify.register(actionsRoutes, { prefix: '/api/actions' });
  await fastify.register(actionReferencesRoutes, { prefix: '/api/actions' });
  await fastify.register(actionTypesRoutes, { prefix: '/api/action-types' });
  await fastify.register(eventsRoutes, { prefix: '/api/events' });
  await fastify.register(workflowRoutes, { prefix: '/api/workflow' });
  await fastify.register(workflowSurfaceRoutes, { prefix: '/api/workflow' });

  // Composer - Task Builder on Actions + Events (replaces legacy task creation)
  await fastify.register(composerRoutes, { prefix: '/api/composer' });

  // Container actions - hierarchical structure (Process, Stage, Subprocess)
  await fastify.register(containersRoutes, { prefix: '/api/containers' });

  // Import sessions - new projection-driven import workflow
  await fastify.register(importsRoutes, { prefix: '/api/imports' });

  // External connections management (Monday, Google OAuth)
  await fastify.register(connectionsRoutes, { prefix: '/api' });

  // Monday workspace configuration (advanced import path)
  await fastify.register(mondayWorkspaceRoutes, { prefix: '/api/monday' });

  // Fact kind definitions - Definition Review UI
  await fastify.register(factKindsRoutes, { prefix: '/api' });

  // Soft-intrinsic definitions (action types, workflow statuses)
  await fastify.register(definitionsRoutes, { prefix: '/api/definitions' });

  // Runner proxy to AutoHelper
  await fastify.register(runnerRoutes, { prefix: '/api' });

  // Export sessions - export workflow
  await fastify.register(exportsRoutes, { prefix: '/api/exports' });

  // Garbage collection stats and monitoring
  await fastify.register(gcRoutes, { prefix: '/api/gc' });

  // Intake forms (admin + public routes)
  await fastify.register(intakeRoutes, { prefix: '/api/intake' });
  await fastify.register(intakePublicRoutes, { prefix: '/public/intake' });

  // Mail module now handled by AutoHelper service on port 8000

  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'App initialized');

  return fastify;
}
