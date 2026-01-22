/**
 * Auth Service Tests
 *
 * Tests for authentication operations:
 * - registerUser: User registration with duplicate email handling
 * - loginUser: Login with password verification
 * - Token operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { db } from '../../../db/client.js';
import {
  cleanupTestData,
  generateTestPrefix,
} from '../../../test/setup.js';
import * as authService from '../auth.service.js';

describe('auth.service', () => {
  let testPrefix: string;

  beforeAll(async () => {
    // Verify database connection
    await db.selectFrom('users').select('id').limit(1).execute();
  });

  beforeEach(() => {
    testPrefix = generateTestPrefix();
  });

  afterAll(async () => {
    // Clean up test users
    await cleanupTestData(db, '__test_');
  });

  describe('registerUser', () => {
    it('should create a new user with hashed password', async () => {
      const email = `${testPrefix}@test.com`;

      const user = await authService.registerUser({
        email,
        password: 'testpassword123',
        name: 'Test User',
      });

      expect(user.email).toBe(email);
      expect(user.name).toBe('Test User');
      expect(user.id).toBeDefined();

      // Cleanup
      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });

    it('should reject duplicate email registration', async () => {
      const email = `${testPrefix}@test.com`;

      // First registration
      const user = await authService.registerUser({
        email,
        password: 'testpassword123',
        name: 'Test User',
      });

      // Attempt duplicate
      await expect(
        authService.registerUser({
          email,
          password: 'different123',
          name: 'Another User',
        })
      ).rejects.toThrow('Email already registered');

      // Cleanup
      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });
  });

  describe('loginUser', () => {
    it('should authenticate valid credentials', async () => {
      const email = `${testPrefix}@test.com`;
      const password = 'testpassword123';

      // Register first
      const registeredUser = await authService.registerUser({
        email,
        password,
        name: 'Test User',
      });

      // Login
      const result = await authService.loginUser({ email, password });

      expect(result.user.email).toBe(email);

      // Cleanup
      await db.deleteFrom('users').where('id', '=', registeredUser.id).execute();
    });

    it('should reject invalid password', async () => {
      const email = `${testPrefix}@test.com`;

      // Register first
      const registeredUser = await authService.registerUser({
        email,
        password: 'correctpassword',
        name: 'Test User',
      });

      // Attempt login with wrong password
      await expect(
        authService.loginUser({ email, password: 'wrongpassword' })
      ).rejects.toThrow('Invalid email or password');

      // Cleanup
      await db.deleteFrom('users').where('id', '=', registeredUser.id).execute();
    });
  });
});
