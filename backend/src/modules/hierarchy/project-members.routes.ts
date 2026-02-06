import type { FastifyInstance } from 'fastify';

import * as memberService from './project-members.service.js';
import { requireRole } from '../../plugins/requireRole.js';

export async function projectMembersRoutes(fastify: FastifyInstance) {
    // List project members
    interface ProjectParams {
        Params: { id: string };
    }
    fastify.get<ProjectParams>('/:id/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const members = await memberService.listProjectMembers(request.params.id);
        return reply.send({ members });
    });

    // Add member (admin)
    interface AddMemberBody {
        Params: { id: string };
        Body: { userId: string; role?: string };
    }
    fastify.post<AddMemberBody>('/:id/members', { preHandler: [fastify.authenticate, requireRole('admin')] }, async (request, reply) => {
        const { userId, role = 'member' } = request.body || {};
        if (!userId) {
            return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'userId is required' });
        }

        try {
            const member = await memberService.addProjectMember(request.params.id, userId, role, request.user.userId);
            return reply.code(201).send({ member });
        } catch (err: any) {
            if (err?.code === '23505') {
                return reply.code(409).send({ error: 'CONFLICT', message: 'User is already a member of this project' });
            }
            throw err;
        }
    });

    // Remove member (admin)
    interface RemoveMemberParams {
        Params: { id: string; userId: string };
    }
    fastify.delete<RemoveMemberParams>('/:id/members/:userId', { preHandler: [fastify.authenticate, requireRole('admin')] }, async (request, reply) => {
        const result = await memberService.removeProjectMember(request.params.id, request.params.userId);
        if (!result) {
            return reply.code(404).send({ error: 'NOT_FOUND', message: 'Member not found' });
        }
        return reply.send({ message: 'Member removed' });
    });

    // Update member role (admin)
    interface UpdateMemberBody {
        Params: { id: string; userId: string };
        Body: { role: string };
    }
    fastify.patch<UpdateMemberBody>('/:id/members/:userId', { preHandler: [fastify.authenticate, requireRole('admin')] }, async (request, reply) => {
        const { role } = request.body || {};
        if (!role) {
            return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'role is required' });
        }

        const member = await memberService.updateMemberRole(request.params.id, request.params.userId, role);
        if (!member) {
            return reply.code(404).send({ error: 'NOT_FOUND', message: 'Member not found' });
        }
        return reply.send({ member });
    });

    // Transfer ownership (admin)
    interface TransferBody {
        Params: { id: string };
        Body: { toUserId: string };
    }
    fastify.post<TransferBody>('/:id/transfer', { preHandler: [fastify.authenticate, requireRole('admin')] }, async (request, reply) => {
        const { toUserId } = request.body || {};
        if (!toUserId) {
            return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'toUserId is required' });
        }

        await memberService.transferOwnership(request.params.id, request.user.userId, toUserId);
        return reply.send({ message: 'Ownership transferred' });
    });
}
