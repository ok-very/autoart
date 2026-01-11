/**
 * Error Classes Tests
 *
 * Tests for the standardized error handling system.
 */

import { describe, it, expect } from 'vitest';

import { ErrorCodes } from '@autoart/shared';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ExternalServiceError,
  DatabaseError,
  isAppError,
} from '../errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(500, 'Test error', 'TEST_CODE', { extra: 'data' });

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('AppError');
    });

    it('should default to INTERNAL_ERROR code', () => {
      const error = new AppError(500, 'Test error');
      expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError(400, 'Bad request', 'BAD_REQ', { field: 'test' }, 'fieldName');
      const json = error.toJSON();

      expect(json.error.code).toBe('BAD_REQ');
      expect(json.error.message).toBe('Bad request');
      expect(json.error.details).toEqual({ field: 'test' });
      expect(json.error.field).toBe('fieldName');
      expect(json.error.timestamp).toBeDefined();
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error with resource name', () => {
      const error = new NotFoundError('User');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.name).toBe('NotFoundError');
    });

    it('should include ID in message when provided', () => {
      const error = new NotFoundError('Project', 'abc-123');

      expect(error.message).toBe("Project with id 'abc-123' not found");
      expect(error.details).toEqual({ resource: 'Project', id: 'abc-123' });
    });
  });

  describe('ValidationError', () => {
    it('should create 400 error with field info', () => {
      const error = new ValidationError('Email is invalid', 'email');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Email is invalid');
      expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(error.field).toBe('email');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error', () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication required');
      expect(error.code).toBe(ErrorCodes.AUTH_REQUIRED);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should accept custom message and code', () => {
      const error = new UnauthorizedError('Token expired', ErrorCodes.AUTH_EXPIRED_TOKEN);

      expect(error.message).toBe('Token expired');
      expect(error.code).toBe(ErrorCodes.AUTH_EXPIRED_TOKEN);
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error', () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Permission denied');
      expect(error.code).toBe(ErrorCodes.PERMISSION_DENIED);
      expect(error.name).toBe('ForbiddenError');
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError('Email already exists');

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Email already exists');
      expect(error.code).toBe(ErrorCodes.RESOURCE_CONFLICT);
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('ExternalServiceError', () => {
    it('should create 502 error with service info', () => {
      const error = new ExternalServiceError('Google', 'OAuth failed', { responseCode: 400 });

      expect(error.statusCode).toBe(502);
      expect(error.message).toBe('OAuth failed');
      expect(error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
      expect(error.details).toEqual({ service: 'Google', responseCode: 400 });
      expect(error.name).toBe('ExternalServiceError');
    });
  });

  describe('DatabaseError', () => {
    it('should create 500 error', () => {
      const error = new DatabaseError('Connection failed');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(error.name).toBe('DatabaseError');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError(500, 'test'))).toBe(true);
      expect(isAppError(new NotFoundError('User'))).toBe(true);
      expect(isAppError(new ValidationError('invalid'))).toBe(true);
      expect(isAppError(new UnauthorizedError())).toBe(true);
    });

    it('should return false for non-AppError values', () => {
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({ statusCode: 400 })).toBe(false);
    });
  });
});
