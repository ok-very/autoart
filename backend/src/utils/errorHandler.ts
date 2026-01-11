import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { isAppError } from './errors.js';
import { logger } from './logger.js';
import { env } from '../config/env.js';
import { ErrorCodes } from '@autoart/shared';

const isDev = env.NODE_ENV === 'development';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = request.id;
  const userId = (request.user as { id?: string })?.id;

  if (isAppError(error)) {
    logger.warn({
      requestId,
      userId,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      url: request.url,
      method: request.method,
    }, 'Application error');

    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: isDev ? error.details : undefined,
        timestamp: error.timestamp,
        requestId,
        field: error.field,
      },
    });
  }

  if (error.validation) {
    logger.warn({
      requestId,
      userId,
      validation: error.validation,
      url: request.url,
      method: request.method,
    }, 'Validation error');

    return reply.status(400).send({
      error: {
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'Request validation failed',
        details: isDev ? error.validation : undefined,
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
  }

  logger.error({
    requestId,
    userId,
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  }, 'Unhandled error');

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 && !isDev
    ? 'An unexpected error occurred'
    : error.message;

  return reply.status(statusCode).send({
    error: {
      code: error.code || ErrorCodes.INTERNAL_ERROR,
      message,
      details: isDev ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestId,
    },
  });
}

export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  logger.warn({
    requestId: request.id,
    url: request.url,
    method: request.method,
  }, 'Route not found');

  return reply.status(404).send({
    error: {
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: `Route ${request.method} ${request.url} not found`,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    },
  });
}
