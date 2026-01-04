/**
 * Containers Routes
 *
 * API endpoints for managing container actions (Process, Stage, Subprocess).
 * These form the hierarchical structure for organizing task-like actions.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as actionsService from './actions.service.js';

const ProjectIdParamSchema = z.object({
    projectId: z.string().uuid(),
});

const ParentIdParamSchema = z.object({
    parentId: z.string().uuid(),
});

export async function containersRoutes(fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    /**
     * GET /containers/:projectId
     * Get all container actions (Process, Stage, Subprocess) for a project
     */
    app.get(
        '/:projectId',
        {
            schema: {
                params: ProjectIdParamSchema,
            },
        },
        async (request) => {
            const { projectId } = request.params;
            const containers = await actionsService.getContainerActions(projectId);

            return {
                containers: containers.map((c) => ({
                    id: c.id,
                    contextId: c.context_id,
                    contextType: c.context_type,
                    parentActionId: c.parent_action_id,
                    type: c.type,
                    fieldBindings: c.field_bindings,
                    createdAt: c.created_at,
                })),
            };
        }
    );

    /**
     * GET /containers/:projectId/subprocesses
     * Get only Subprocess container actions for a project
     */
    app.get(
        '/:projectId/subprocesses',
        {
            schema: {
                params: ProjectIdParamSchema,
            },
        },
        async (request) => {
            const { projectId } = request.params;
            const subprocesses = await actionsService.getContainerActionsByType(
                projectId,
                'Subprocess'
            );

            return {
                subprocesses: subprocesses.map((s) => ({
                    id: s.id,
                    contextId: s.context_id,
                    contextType: s.context_type,
                    parentActionId: s.parent_action_id,
                    type: s.type,
                    fieldBindings: s.field_bindings,
                    createdAt: s.created_at,
                })),
            };
        }
    );

    /**
     * GET /containers/children/:parentId
     * Get child actions of a parent container action
     */
    app.get(
        '/children/:parentId',
        {
            schema: {
                params: ParentIdParamSchema,
            },
        },
        async (request) => {
            const { parentId } = request.params;
            const children = await actionsService.getChildActions(parentId);

            return {
                children: children.map((c) => ({
                    id: c.id,
                    contextId: c.context_id,
                    contextType: c.context_type,
                    parentActionId: c.parent_action_id,
                    type: c.type,
                    fieldBindings: c.field_bindings,
                    createdAt: c.created_at,
                })),
            };
        }
    );
}
