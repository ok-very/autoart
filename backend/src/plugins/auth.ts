import fastifyJwt from '@fastify/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: { userId: string; email: string };
  }
}

export default fp(
  async (fastify) => {
    await fastify.register(fastifyJwt, {
      secret: env.JWT_SECRET,
      sign: {
        expiresIn: env.JWT_ACCESS_EXPIRES,
      },
    });

    fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
      }
    });

    fastify.decorate('authenticateOptional', async function (request: FastifyRequest, _reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        // Silently ignore - user is optional
      }
    });
  },
  { name: 'auth' }
);
