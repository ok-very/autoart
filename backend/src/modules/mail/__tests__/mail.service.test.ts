/**
 * Mail Service Tests
 *
 * Integration tests for the Mail module API.
 * Tests cover:
 * - Email listing endpoint
 * - Triage update endpoint
 */

import { describe, it, expect, beforeEach } from 'vitest';

import * as mailService from '../mail.service.js';

describe('mail.service', () => {
    beforeEach(() => {
        mailService.resetEmailStore();
    });

    describe('listEmails', () => {
        it('should return emails with total count', async () => {
            const result = await mailService.listEmails();

            expect(result.emails).toBeDefined();
            expect(result.total).toBeDefined();
            expect(Array.isArray(result.emails)).toBe(true);
            expect(result.total).toBe(result.emails.length);
        });

        it('should include required email fields', async () => {
            const result = await mailService.listEmails();

            expect(result.emails.length).toBeGreaterThan(0);
            const email = result.emails[0];

            expect(email.id).toBeDefined();
            expect(email.subject).toBeDefined();
            expect(email.from).toBeDefined();
            expect(email.fromName).toBeDefined();
            expect(email.receivedDateTime).toBeDefined();
        });
    });

    describe('getEmailById', () => {
        it('should return email when found', async () => {
            const { emails } = await mailService.listEmails();
            const firstEmail = emails[0];

            const result = await mailService.getEmailById(firstEmail.id);

            expect(result).toBeDefined();
            expect(result?.id).toBe(firstEmail.id);
        });

        it('should return undefined when not found', async () => {
            const result = await mailService.getEmailById('non-existent-id');

            expect(result).toBeUndefined();
        });
    });

    describe('updateTriage', () => {
        it('should update triage status', async () => {
            const { emails } = await mailService.listEmails();
            const sampleEmailId = emails[0].id;

            const result = await mailService.updateTriage(sampleEmailId, {
                status: 'action_required',
                notes: 'Test note',
            });

            expect(result).toBeDefined();
            expect(result?.metadata?.triage_status).toBe('action_required');
            expect(result?.metadata?.notes).toBe('Test note');
        });

        it('should persist triage update', async () => {
            const { emails } = await mailService.listEmails();
            const sampleEmailId = emails[0].id;

            await mailService.updateTriage(sampleEmailId, {
                status: 'action_required',
                notes: 'Test note',
            });

            // Verify update persists
            const email = await mailService.getEmailById(sampleEmailId);
            expect(email?.metadata?.triage_status).toBe('action_required');
        });

        it('should return undefined for non-existent email', async () => {
            const result = await mailService.updateTriage('non-existent-id', {
                status: 'action_required',
            });

            expect(result).toBeUndefined();
        });
    });
});
