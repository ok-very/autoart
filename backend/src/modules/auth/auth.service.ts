import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/client.js';
import { ConflictError, UnauthorizedError } from '../../utils/errors.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

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
    .returning(['id', 'email', 'name', 'created_at'])
    .executeTakeFirstOrThrow();

  return user;
}

export async function loginUser(input: LoginInput) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'email', 'name', 'password_hash'])
    .where('email', '=', input.email.toLowerCase())
    .executeTakeFirst();

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordValid = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export async function createSession(userId: string): Promise<string> {
  const refreshToken = uuidv4();
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
    .select(['users.id as userId', 'users.email', 'sessions.expires_at'])
    .where('sessions.refresh_token', '=', refreshToken)
    .executeTakeFirst();

  if (!session || new Date(session.expires_at) < new Date()) {
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
    .select(['id', 'email', 'name', 'created_at'])
    .where('id', '=', userId)
    .executeTakeFirst();
}

export async function searchUsers(query: string, limit: number = 10) {
  const searchPattern = `%${query.toLowerCase()}%`;

  return db
    .selectFrom('users')
    .select(['id', 'email', 'name'])
    .where((eb) =>
      eb.or([
        eb('email', 'ilike', searchPattern),
        eb('name', 'ilike', searchPattern),
      ])
    )
    .limit(limit)
    .execute();
}
