/**
 * BFA Import Service
 *
 * Imports BFA project data into AutoArt's hierarchy and records system.
 * Works after sync decisions have been applied — reads the diff report
 * and applied decisions to determine which projects need creating/updating,
 * then builds the full hierarchy structure using the import transformer.
 *
 * Flow:
 *   1. Load diff report + applied decisions
 *   2. Resolve entity IDs → Monday item IDs via external_source_mappings
 *   3. For existing projects: update metadata from export model
 *   4. For new projects: create full hierarchy (project → processes → phases → subprocesses)
 *   5. Create Contact and Selection Panel records
 *   6. Upsert external_source_mappings for traceability
 */

import type { BfaImportResult, BfaProjectExportModel } from '@autoart/shared';
import { DEFAULT_EXPORT_OPTIONS } from '@autoart/shared';

import {
    transformToProjectNode,
    transformContacts,
    transformMilestonePhases,
    transformSelectionPanel,
    transformNextSteps,
} from './bfa-import-transformer.js';
import { getDiffReport } from './bfa-sync.service.js';
import { db } from '../../db/client.js';
import { projectBfaExportModels } from '../exports/projectors/bfa-project.projector.js';
import * as hierarchyService from '../hierarchy/hierarchy.service.js';
import * as recordsService from '../records/records.service.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Import BFA project data into AutoArt hierarchy.
 *
 * Reads the current diff report and applied decisions to determine which
 * projects to create or update. Builds hierarchy nodes, creates records,
 * and establishes external source mappings.
 */
export async function importToAutoArt(
    boardConfigId: string,
    userId: string,
): Promise<BfaImportResult> {
    const result: BfaImportResult = {
        projectsCreated: 0,
        projectsUpdated: 0,
        projectsSkipped: 0,
        recordsCreated: 0,
        errors: [],
        createdProjectIds: [],
    };

    // 1. Load diff report
    const report = await getDiffReport(boardConfigId);
    if (!report) {
        throw new Error('No diff report found for this board config');
    }

    // 2. Load applied decisions
    const appliedDecisions = await db
        .selectFrom('sync_decisions')
        .selectAll()
        .where('board_config_id', '=', boardConfigId)
        .where('report_id', '=', report.id)
        .where('applied_at', 'is not', null)
        .execute();

    if (appliedDecisions.length === 0) {
        throw new Error('No applied decisions found. Apply changes before importing.');
    }

    // 3. Extract unique entity IDs from applied decisions
    const entityIds = [...new Set(appliedDecisions.map(d => d.entity_id))];

    // 4. Resolve entity IDs → project-level hierarchy node IDs
    const projectNodeIds = await resolveProjectIds(entityIds);

    // 5. Build export models for existing projects
    const existingExportModels = projectNodeIds.length > 0
        ? await projectBfaExportModels(projectNodeIds, DEFAULT_EXPORT_OPTIONS)
        : [];

    const exportModelByProjectId = new Map<string, BfaProjectExportModel>();
    for (const model of existingExportModels) {
        exportModelByProjectId.set(model.projectId, model);
    }

    // 6. Look up record definitions for Contact and Selection Panel
    const allDefs = await recordsService.listDefinitions();
    const contactDef = allDefs.find(d => d.name === 'Contact');
    const selectionPanelDef = allDefs.find(d => d.name === 'Selection Panel');

    // 7. Process each project
    for (const projectId of projectNodeIds) {
        const model = exportModelByProjectId.get(projectId);
        if (!model) {
            result.projectsSkipped++;
            continue;
        }

        try {
            const projectResult = await importSingleProject(
                model, projectId, userId, contactDef?.id, selectionPanelDef?.id,
            );
            result.projectsUpdated++;
            result.recordsCreated += projectResult.recordsCreated;
        } catch (err) {
            result.errors.push({
                projectLabel: model.header.clientName + ' - ' + model.header.projectName,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return result;
}

// ============================================================================
// INTERNAL — SINGLE PROJECT IMPORT (UPDATE PATH)
// ============================================================================

/**
 * Import/update a single existing project.
 * Updates project node metadata and ensures hierarchy structure is complete
 * (Timeline process + milestones, Tasks process + next steps).
 */
async function importSingleProject(
    model: BfaProjectExportModel,
    projectNodeId: string,
    userId: string,
    contactDefId: string | undefined,
    selectionPanelDefId: string | undefined,
): Promise<{ recordsCreated: number }> {
    let recordsCreated = 0;

    // 1. Update project node metadata
    const projectInput = transformToProjectNode(model);
    await hierarchyService.updateNode(projectNodeId, {
        title: projectInput.title,
        metadata: projectInput.metadata,
    });

    // 2. Ensure "Timeline" process exists, create milestone phases
    const timelineProcess = await ensureProcess(projectNodeId, 'Timeline', userId);
    await ensureMilestonePhases(model, timelineProcess.id, userId);

    // 3. Ensure "Tasks" process + "Active" phase, create next step subprocesses
    const tasksProcess = await ensureProcess(projectNodeId, 'Tasks', userId);
    const activePhase = await ensurePhase(tasksProcess.id, 'Active', userId);
    await ensureNextStepSubprocesses(model, activePhase.id, userId);

    // 4. Create/update Contact records
    if (contactDefId) {
        const contactInputs = transformContacts(model, projectNodeId);
        if (contactInputs.length > 0) {
            const contactResult = await recordsService.bulkCreateRecords(
                contactDefId, contactInputs, userId,
            );
            recordsCreated += contactResult.created;
        }
    }

    // 5. Create/update Selection Panel records
    if (selectionPanelDefId) {
        const spInputs = transformSelectionPanel(model, projectNodeId);
        if (spInputs.length > 0) {
            const spResult = await recordsService.bulkCreateRecords(
                selectionPanelDefId, spInputs, userId,
            );
            recordsCreated += spResult.created;
        }
    }

    return { recordsCreated };
}

// ============================================================================
// INTERNAL — HIERARCHY HELPERS
// ============================================================================

/**
 * Find or create a process node under a project.
 * Deduplicates by title within the project's children.
 */
async function ensureProcess(
    projectNodeId: string,
    processTitle: string,
    userId: string,
): Promise<{ id: string }> {
    const existing = await db
        .selectFrom('hierarchy_nodes')
        .select('id')
        .where('parent_id', '=', projectNodeId)
        .where('type', '=', 'process')
        .where('title', '=', processTitle)
        .executeTakeFirst();

    if (existing) return existing;

    const node = await hierarchyService.createNode({
        parentId: projectNodeId,
        type: 'process',
        title: processTitle,
    }, userId);

    return { id: node.id };
}

/**
 * Find or create a phase node under a process.
 * Deduplicates by title within the process's children.
 */
async function ensurePhase(
    processNodeId: string,
    phaseTitle: string,
    userId: string,
    metadata?: Record<string, unknown>,
    position?: number,
): Promise<{ id: string }> {
    const existing = await db
        .selectFrom('hierarchy_nodes')
        .select('id')
        .where('parent_id', '=', processNodeId)
        .where('type', '=', 'phase')
        .where('title', '=', phaseTitle)
        .executeTakeFirst();

    if (existing) return existing;

    const node = await hierarchyService.createNode({
        parentId: processNodeId,
        type: 'phase',
        title: phaseTitle,
        metadata,
        position,
    }, userId);

    return { id: node.id };
}

/**
 * Ensure milestone phase nodes exist under a Timeline process.
 * Deduplicates by title to avoid creating duplicates on re-import.
 */
async function ensureMilestonePhases(
    model: BfaProjectExportModel,
    timelineProcessId: string,
    userId: string,
): Promise<void> {
    const milestoneInputs = transformMilestonePhases(model);

    // Load existing milestone phases for dedup
    const existingPhases = await db
        .selectFrom('hierarchy_nodes')
        .select(['id', 'title'])
        .where('parent_id', '=', timelineProcessId)
        .where('type', '=', 'phase')
        .execute();

    const existingTitles = new Set(existingPhases.map(p => p.title));

    for (const input of milestoneInputs) {
        if (existingTitles.has(input.title)) continue;

        await ensurePhase(timelineProcessId, input.title, userId, input.metadata, input.position);
    }
}

/**
 * Ensure next step subprocess nodes exist under an Active phase.
 * Deduplicates by title to avoid creating duplicates on re-import.
 */
async function ensureNextStepSubprocesses(
    model: BfaProjectExportModel,
    activePhaseId: string,
    userId: string,
): Promise<void> {
    const nextStepInputs = transformNextSteps(model.nextStepsBullets);

    // Load existing subprocesses for dedup
    const existingSubprocesses = await db
        .selectFrom('hierarchy_nodes')
        .select(['id', 'title'])
        .where('parent_id', '=', activePhaseId)
        .where('type', '=', 'subprocess')
        .execute();

    const existingTitles = new Set(existingSubprocesses.map(s => s.title));

    for (const input of nextStepInputs) {
        if (existingTitles.has(input.title)) continue;

        await hierarchyService.createNode({
            parentId: activePhaseId,
            type: 'subprocess',
            title: input.title,
            metadata: input.metadata,
        }, userId);
    }
}

// ============================================================================
// INTERNAL — RESOLUTION HELPERS
// ============================================================================

/**
 * Resolve entity IDs to their project-level ancestor node IDs.
 * Walks up the hierarchy to find nodes with type='project'.
 */
async function resolveProjectIds(entityIds: string[]): Promise<string[]> {
    if (entityIds.length === 0) return [];

    // Check external_source_mappings to classify entities
    const mappings = await db
        .selectFrom('external_source_mappings')
        .select(['local_entity_id', 'local_entity_type'])
        .where('provider', '=', 'monday')
        .where('local_entity_id', 'in', entityIds)
        .execute();

    const nodeIdsToCheck = new Set<string>();

    // For actions, resolve via context_id
    const actionIds = mappings
        .filter(m => m.local_entity_type === 'action')
        .map(m => m.local_entity_id);

    if (actionIds.length > 0) {
        const actions = await db
            .selectFrom('actions')
            .select(['id', 'context_id'])
            .where('id', 'in', actionIds)
            .execute();

        for (const a of actions) {
            if (a.context_id) nodeIdsToCheck.add(a.context_id);
        }
    }

    // For hierarchy nodes, add directly
    const nodeEntityIds = mappings
        .filter(m => m.local_entity_type !== 'action')
        .map(m => m.local_entity_id);
    for (const id of nodeEntityIds) nodeIdsToCheck.add(id);

    // Also add any entityIds not in mappings (might be hierarchy nodes directly)
    const mappedIds = new Set(mappings.map(m => m.local_entity_id));
    for (const id of entityIds) {
        if (!mappedIds.has(id)) nodeIdsToCheck.add(id);
    }

    if (nodeIdsToCheck.size === 0) return [];

    const projectIds = new Set<string>();
    const nodeArray = [...nodeIdsToCheck];

    // Check which are already projects
    const directProjects = await db
        .selectFrom('hierarchy_nodes')
        .select('id')
        .where('id', 'in', nodeArray)
        .where('type', '=', 'project')
        .execute();

    for (const p of directProjects) {
        projectIds.add(p.id);
    }

    // Walk up hierarchy for non-project nodes
    const nonProjectIds = nodeArray.filter(id => !projectIds.has(id));
    for (const nodeId of nonProjectIds) {
        const ancestor = await findProjectAncestor(nodeId);
        if (ancestor) projectIds.add(ancestor);
    }

    return [...projectIds];
}

/**
 * Walk up the hierarchy from a node to find its project-level ancestor.
 */
async function findProjectAncestor(nodeId: string): Promise<string | null> {
    let currentId: string | null = nodeId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);

        const node = await db
            .selectFrom('hierarchy_nodes')
            .select(['id', 'parent_id', 'type'])
            .where('id', '=', currentId)
            .executeTakeFirst();

        if (!node) return null;
        if (node.type === 'project') return node.id;

        currentId = node.parent_id;
    }

    return null;
}

