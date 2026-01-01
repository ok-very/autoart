import { z } from 'zod';

/**
 * User Schema (public fields only - no password_hash)
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  created_at: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Login Input Schema
 */
export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * Register Input Schema
 */
export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/**
 * Auth Response Schema
 */
export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Refresh Token Response Schema
 */
export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
