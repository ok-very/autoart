import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema, refreshSchema, RegisterInput, LoginInput, RefreshInput } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { AppError } from '../../utils/errors.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
    }

    try {
      const user = await authService.registerUser(parsed.data);
      const refreshToken = await authService.createSession(user.id);
      const accessToken = fastify.jwt.sign({ userId: user.id, email: user.email });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.code(201).send({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Login
  fastify.post('/login', async (request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation Error', details: parsed.error.flatten() });
    }

    try {
      const user = await authService.loginUser(parsed.data);
      const refreshToken = await authService.createSession(user.id);
      const accessToken = fastify.jwt.sign({ userId: user.id, email: user.email });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.send({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Refresh Token
  fastify.post('/refresh', async (request: FastifyRequest<{ Body: RefreshInput }>, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken || request.body?.refreshToken;

    if (!refreshToken) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'No refresh token provided' });
    }

    const payload = await authService.validateRefreshToken(refreshToken);
    if (!payload) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
    }

    // Rotate refresh token
    await authService.deleteSession(refreshToken);
    const newRefreshToken = await authService.createSession(payload.userId);
    const accessToken = fastify.jwt.sign(payload);

    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({ accessToken });
  });

  // Logout
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;

    if (refreshToken) {
      await authService.deleteSession(refreshToken);
    }

    reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return reply.send({ message: 'Logged out successfully' });
  });

  // Get current user
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authService.getUserById(request.user.userId);
    if (!user) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }
    return reply.send({ user });
  });

  // Search users (for @mentions)
  interface SearchUsersQuery {
    Querystring: { q?: string; limit?: string };
  }
  fastify.get<SearchUsersQuery>('/users/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query.q || '';
    const limit = Math.min(parseInt(request.query.limit || '10', 10), 50);

    if (query.length < 1) {
      return reply.send({ users: [] });
    }

    const users = await authService.searchUsers(query, limit);
    return reply.send({ users });
  });
}
