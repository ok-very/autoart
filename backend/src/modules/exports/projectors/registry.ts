/**
 * Projector Registry
 *
 * Maps package source types to projection functions.
 * Each source type has a projector that transforms source_payload
 * into format-agnostic projection data.
 */

import type { ExportOptions } from '../types.js';
import { projectBfaExportModels } from './bfa-project.projector.js';

type ProjectorFn = (sourcePayload: unknown, options: ExportOptions) => Promise<unknown>;

const projectors = new Map<string, ProjectorFn>();

export function registerProjector(sourceType: string, fn: ProjectorFn): void {
    projectors.set(sourceType, fn);
}

export function getProjector(sourceType: string): ProjectorFn {
    const fn = projectors.get(sourceType);
    if (!fn) {
        throw new Error(`No projector registered for source type: ${sourceType}`);
    }
    return fn;
}

// Phase 1: project_selection delegates to existing BFA projector
registerProjector('project_selection', async (payload, options) => {
    const { projectIds } = payload as { projectIds: string[] };
    return projectBfaExportModels(projectIds, options);
});
