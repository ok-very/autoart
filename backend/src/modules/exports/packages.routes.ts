/**
 * Package Routes
 *
 * API endpoints for export package queue:
 * - POST /            — Submit new package
 * - GET /             — List packages (optional status filter)
 * - GET /:id          — Get single package
 * - PATCH /:id        — Update package config
 * - DELETE /:id       — Delete package
 * - POST /:id/projection — Generate projection
 * - POST /:id/execute    — Execute export
 * - POST /reorder        — Reorder queue
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
    SubmitPackageBodySchema,
    UpdatePackageBodySchema,
} from '@autoart/shared';
import * as packagesService from './packages.service.js';

const PackageIdParamSchema = z.object({
    id: z.string().uuid(),
});

const ListQuerySchema = z.object({
    status: z.string().optional(),
});

const ReorderBodySchema = z.object({
    orderedIds: z.array(z.string().uuid()),
});

export async function packageRoutes(app: FastifyInstance) {
    // All routes require auth
    app.addHook('preHandler', app.authenticate);

    // POST / — Submit new package
    app.post('/', async (request, reply) => {
        const body = SubmitPackageBodySchema.parse(request.body);
        const userId = (request.user as { id?: string })?.id;
        const pkg = await packagesService.submitPackage(body, userId);
        return reply.status(201).send(pkg);
    });

    // GET / — List packages
    app.get('/', async (request, reply) => {
        const query = ListQuerySchema.parse(request.query);
        const packages = await packagesService.listPackages(
            query.status ? { status: query.status } : undefined,
        );
        return reply.send({ packages });
    });

    // GET /:id — Get single package
    app.get('/:id', async (request, reply) => {
        const { id } = PackageIdParamSchema.parse(request.params);
        const pkg = await packagesService.getPackage(id);
        if (!pkg) return reply.status(404).send({ error: 'Package not found' });
        return reply.send(pkg);
    });

    // PATCH /:id — Update package
    app.patch('/:id', async (request, reply) => {
        const { id } = PackageIdParamSchema.parse(request.params);
        const body = UpdatePackageBodySchema.parse(request.body);
        const pkg = await packagesService.updatePackage(id, body);
        return reply.send(pkg);
    });

    // DELETE /:id — Delete package
    app.delete('/:id', async (request, reply) => {
        const { id } = PackageIdParamSchema.parse(request.params);
        await packagesService.deletePackage(id);
        return reply.status(204).send();
    });

    // POST /:id/projection — Generate projection
    app.post('/:id/projection', async (request, reply) => {
        const { id } = PackageIdParamSchema.parse(request.params);
        const projection = await packagesService.generatePackageProjection(id);
        return reply.send({ projection });
    });

    // POST /:id/execute — Execute export
    app.post('/:id/execute', async (request, reply) => {
        const { id } = PackageIdParamSchema.parse(request.params);
        const result = await packagesService.executePackageExport(id);
        return reply.send(result);
    });

    // POST /reorder — Reorder queue
    app.post('/reorder', async (request, reply) => {
        const body = ReorderBodySchema.parse(request.body);
        await packagesService.reorderPackages(body.orderedIds);
        return reply.status(204).send();
    });
}
