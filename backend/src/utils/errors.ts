import { ErrorCodes, type ErrorCode } from '@autoart/shared';

export class AppError extends Error {
  public readonly code: ErrorCode | string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly field?: string;
  public readonly timestamp: string;

  constructor(
    statusCode: number,
    message: string,
    code?: ErrorCode | string,
    details?: unknown,
    field?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code || ErrorCodes.INTERNAL_ERROR;
    this.details = details;
    this.field = field;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp,
        field: this.field,
      },
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      404,
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, details?: unknown) {
    super(400, message, ErrorCodes.VALIDATION_FAILED, details, field);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code: ErrorCode = ErrorCodes.AUTH_REQUIRED) {
    super(401, message, code);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Permission denied') {
    super(403, message, ErrorCodes.PERMISSION_DENIED);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, message, ErrorCodes.RESOURCE_CONFLICT, details);
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(502, message, ErrorCodes.EXTERNAL_SERVICE_ERROR, { service, ...((details as object) || {}) });
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(500, message, ErrorCodes.DATABASE_ERROR, details);
    this.name = 'DatabaseError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
