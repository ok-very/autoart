import pino from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({ requestId, userId });
}

export type Logger = typeof logger;
