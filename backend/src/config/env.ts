import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (two levels up from src/config/)
const envPath = path.join(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  HOST: z.string().default('0.0.0.0'),

  // Database
  // DATABASE_URL is required for password auth, optional when AZURE_AD_USER is set
  DATABASE_URL: z.string().optional(),
  DATABASE_POOL_SIZE: z.string().default('10').transform(Number),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Client Origin (for OAuth popup callbacks)
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  // External Services
  AUTOHELPER_URL: z.string().default('http://localhost:8100'),

  // Monday.com
  MONDAY_CLIENT_ID: z.string().optional(),
  MONDAY_CLIENT_SECRET: z.string().optional(),
  MONDAY_REDIRECT_URI: z.string().optional(),

  // Microsoft OAuth (OneDrive)
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().optional(),

  // Azure Entra ID (for production database auth)
  AZURE_AD_USER: z.string().optional(), // e.g. user@yourfirm.com

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
}).refine(
  (data) => data.DATABASE_URL || data.AZURE_AD_USER,
  { message: 'Either DATABASE_URL or AZURE_AD_USER must be set', path: ['DATABASE_URL'] },
);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
