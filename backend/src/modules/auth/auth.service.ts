import bcrypt from 'bcryptjs';

import { generateId } from '@autoart/shared';

import type { RegisterInput, LoginInput } from './auth.schemas.js';
import { db } from '../../db/client.js';
import { ConflictError, UnauthorizedError } from '../../utils/errors.js';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_DAYS = 7;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserPayload {
  userId: string;
  email: string;
}

export async function registerUser(input: RegisterInput) {
  // Check if email exists
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', input.email.toLowerCase())
    .executeTakeFirst();

  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await db
    .insertInto('users')
    .values({
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      name: input.name,
    })
    .returning(['id', 'email', 'name', 'role', 'avatar_url', 'created_at'])
    .executeTakeFirstOrThrow();

  return user;
}

export async function loginUser(input: LoginInput) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'email', 'name', 'role', 'avatar_url', 'password_hash', 'deleted_at'])
    .where('email', '=', input.email.toLowerCase())
    .executeTakeFirst();

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Reject deleted users
  if (user.deleted_at) {
    throw new UnauthorizedError('Account has been deactivated');
  }

  const passwordValid = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar_url: user.avatar_url,
  };
}

export async function createSession(userId: string): Promise<string> {
  const refreshToken = generateId();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await db
    .insertInto('sessions')
    .values({
      user_id: userId,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    })
    .execute();

  return refreshToken;
}

export async function validateRefreshToken(refreshToken: string): Promise<UserPayload | null> {
  const session = await db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .select(['users.id as userId', 'users.email', 'users.deleted_at', 'sessions.expires_at'])
    .where('sessions.refresh_token', '=', refreshToken)
    .executeTakeFirst();

  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }

  // Reject deleted users
  if (session.deleted_at) {
    return null;
  }

  return {
    userId: session.userId,
    email: session.email,
  };
}

export async function deleteSession(refreshToken: string): Promise<void> {
  await db
    .deleteFrom('sessions')
    .where('refresh_token', '=', refreshToken)
    .execute();
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db
    .deleteFrom('sessions')
    .where('user_id', '=', userId)
    .execute();
}

export async function getUserById(userId: string) {
  return db
    .selectFrom('users')
    .select(['id', 'email', 'name', 'role', 'avatar_url', 'created_at'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
}

export interface UpdateUserInput {
  name?: string;
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (Object.keys(updates).length === 0) {
    return getUserById(userId);
  }

  return db
    .updateTable('users')
    .set(updates)
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .returning(['id', 'email', 'name', 'role', 'avatar_url', 'created_at'])
    .executeTakeFirst();
}

export async function getUserSessions(userId: string) {
  return db
    .selectFrom('sessions')
    .select(['id', 'created_at', 'expires_at'])
    .where('user_id', '=', userId)
    .where('expires_at', '>', new Date())
    .orderBy('created_at', 'desc')
    .execute();
}

export async function searchUsers(query: string, limit: number = 10) {
  const searchPattern = `%${query.toLowerCase()}%`;

  return db
    .selectFrom('users')
    .select(['id', 'email', 'name', 'avatar_url'])
    .where('deleted_at', 'is', null) // Only active users for search
    .where((eb) =>
      eb.or([
        eb('email', 'ilike', searchPattern),
        eb('name', 'ilike', searchPattern),
      ])
    )
    .limit(limit)
    .execute();
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * List all users (including deleted) for admin view.
 */
export async function listAllUsers() {
  return db
    .selectFrom('users')
    .select(['id', 'email', 'name', 'role', 'avatar_url', 'created_at', 'deleted_at', 'deleted_by'])
    .orderBy('created_at', 'desc')
    .execute();
}

/**
 * Change a user's password. Requires current password verification.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'password_hash'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db
    .updateTable('users')
    .set({ password_hash: hash })
    .where('id', '=', userId)
    .execute();
}

/**
 * Admin: create a user with a temporary password.
 */
export async function createUserByAdmin(email: string, name: string, role: string, password: string) {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', email.toLowerCase())
    .executeTakeFirst();

  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  return db
    .insertInto('users')
    .values({
      email: email.toLowerCase(),
      password_hash: hash,
      name,
      role,
    })
    .returning(['id', 'email', 'name', 'role', 'avatar_url', 'created_at'])
    .executeTakeFirstOrThrow();
}

/**
 * Admin: force-reset a user's password (no current password required).
 */
export async function resetPassword(userId: string, newPassword: string) {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const result = await db
    .updateTable('users')
    .set({ password_hash: hash })
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .returning(['id'])
    .executeTakeFirst();

  if (!result) {
    return null;
  }

  // Revoke all sessions so user must re-login
  await deleteAllUserSessions(userId);
  return result;
}

/**
 * Admin: update a user's role.
 */
export async function updateUserRole(userId: string, role: string) {
  return db
    .updateTable('users')
    .set({ role })
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .returning(['id', 'email', 'name', 'role', 'avatar_url', 'created_at'])
    .executeTakeFirst();
}

/**
 * Admin: update a user's profile fields (name, email, role).
 */
export async function adminUpdateUser(userId: string, input: { name?: string; email?: string; role?: string }) {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email.toLowerCase();
  if (input.role !== undefined) updates.role = input.role;

  if (Object.keys(updates).length === 0) {
    return getUserById(userId);
  }

  return db
    .updateTable('users')
    .set(updates)
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .returning(['id', 'email', 'name', 'role', 'avatar_url', 'created_at', 'deleted_at', 'deleted_by'])
    .executeTakeFirst();
}

/**
 * Soft delete a user.
 * Sets deleted_at and deleted_by, revokes all sessions.
 */
export async function softDeleteUser(userId: string, deletedBy: string) {
  // Set deleted_at and deleted_by
  const result = await db
    .updateTable('users')
    .set({
      deleted_at: new Date(),
      deleted_by: deletedBy,
    })
    .where('id', '=', userId)
    .where('deleted_at', 'is', null) // Only if not already deleted
    .returning(['id', 'email', 'name', 'deleted_at'])
    .executeTakeFirst();

  if (!result) {
    return null;
  }

  // Revoke all sessions for this user
  await deleteAllUserSessions(userId);

  return result;
}
