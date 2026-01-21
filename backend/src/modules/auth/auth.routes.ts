import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { registerSchema, loginSchema, RegisterInput, LoginInput, RefreshInput } from './auth.schemas.js';
import * as authService from './auth.service.js';
import * as oauthService from './oauth.service.js';
import * as settingsService from './settings.service.js';
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

      return reply.code(201).send({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        refreshToken,
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

      return reply.send({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        refreshToken,
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
    const refreshToken = request.body?.refreshToken;

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

    return reply.send({ accessToken, refreshToken: newRefreshToken });
  });

  // Logout
  fastify.post('/logout', async (request: FastifyRequest<{ Body: { refreshToken?: string } }>, reply: FastifyReply) => {
    const refreshToken = request.body?.refreshToken;

    if (refreshToken) {
      await authService.deleteSession(refreshToken);
    }

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

  // Update current user profile
  interface UpdateMeBody {
    Body: { name?: string };
  }
  fastify.patch<UpdateMeBody>('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { name } = request.body || {};

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 1)) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Name must be a non-empty string' });
    }

    const user = await authService.updateUser(request.user.userId, { name: name?.trim() });
    if (!user) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }
    return reply.send({ user });
  });

  // Get current user's active sessions
  fastify.get('/me/sessions', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sessions = await authService.getUserSessions(request.user.userId);
    return reply.send({ sessions });
  });

  // Sign out everywhere (delete all sessions for current user)
  fastify.delete('/me/sessions', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    await authService.deleteAllUserSessions(request.user.userId);
    return reply.send({ message: 'All sessions revoked' });
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

  // ============================================================================
  // GOOGLE OAUTH ENDPOINTS
  // ============================================================================

  // Initiate Google OAuth flow
  fastify.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { url, state } = oauthService.getGoogleAuthUrl();
      return reply.send({ url, state });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Handle Google OAuth callback
  interface GoogleCallbackQuery {
    Querystring: { code?: string; state?: string; error?: string };
  }
  fastify.get<GoogleCallbackQuery>('/google/callback', async (request, reply) => {
    const { code, state, error } = request.query;

    // User denied consent
    if (error) {
      return reply.code(400).send({ error: 'OAUTH_DENIED', message: 'User denied consent' });
    }

    if (!code || !state) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Missing code or state parameter' });
    }

    try {
      const { user } = await oauthService.handleGoogleCallback(code, state);
      const refreshToken = await authService.createSession(user.id);
      const accessToken = fastify.jwt.sign({ userId: user.id, email: user.email });

      return reply.send({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        refreshToken,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // ============================================================================
  // ADMIN ENDPOINTS
  // ============================================================================

  // List all users (admin)
  fastify.get('/admin/users', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Add admin role check when roles are implemented
    const users = await authService.listAllUsers();
    return reply.send({ users });
  });

  // Soft delete user (admin)
  interface DeleteUserParams {
    Params: { id: string };
  }
  fastify.delete<DeleteUserParams>('/admin/users/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const deletedBy = request.user.userId;

    // Prevent self-deletion
    if (id === deletedBy) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Cannot delete your own account' });
    }

    const result = await authService.softDeleteUser(id, deletedBy);

    if (!result) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found or already deleted' });
    }

    return reply.send({ message: 'User deleted successfully', user: result });
  });

  // ============================================================================
  // USER SETTINGS ENDPOINTS
  // ============================================================================

  // Get all user settings
  fastify.get('/me/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const settings = await settingsService.getSettings(request.user.userId);
    return reply.send({ settings });
  });

  // Get specific setting
  interface GetSettingParams {
    Params: { key: string };
  }
  fastify.get<GetSettingParams>('/me/settings/:key', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { key } = request.params;
    const value = await settingsService.getSetting(
      request.user.userId,
      key as settingsService.SettingKey
    );
    return reply.send({ key, value });
  });

  // Set a setting
  interface SetSettingParams {
    Params: { key: string };
    Body: { value: unknown };
  }
  fastify.put<SetSettingParams>('/me/settings/:key', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { key } = request.params;
    const { value } = request.body;

    const setting = await settingsService.setSetting(
      request.user.userId,
      key as settingsService.SettingKey,
      value
    );
    return reply.send({ key: setting.setting_key, value: setting.setting_value });
  });

  // Delete a setting
  fastify.delete<GetSettingParams>('/me/settings/:key', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { key } = request.params;
    await settingsService.deleteSetting(
      request.user.userId,
      key as settingsService.SettingKey
    );
    return reply.code(204).send();
  });
}
