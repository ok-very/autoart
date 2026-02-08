/**
 * BFA Sync Service — Orchestration
 *
 * Coordinates: fetch Monday data → compute diff → store report → seed decisions.
 * Also handles decision submission, application, and listing.
 */

import { randomUUID } from 'crypto';

import type { BfaApplyResult, BfaInjectionResult, BfaSyncDiffReport } from '@autoart/shared';
import { DEFAULT_EXPORT_OPTIONS } from '@autoart/shared';

import { db } from '../../db/client.js';
import type { SyncDecision } from '../../db/schema.js';
import { GoogleDocsClient } from '../exports/connectors/google-docs-client.js';
import { GoogleDocsConnector } from '../exports/connectors/google-docs-connector.js';
import { projectBfaExportModels } from '../exports/projectors/bfa-project.projector.js';
import { getGoogleToken, getMondayToken } from '../imports/connections.service.js';
import { MondayConnector } from '../imports/connectors/monday-connector.js';
import { interpretMondayData } from '../imports/monday/monday-domain-interpreter.js';
import * as mondayWorkspaceService from '../imports/monday/monday-workspace.service.js';
import { injectProjects } from './bfa-gdocs-injector.js';
import { getBfaProgramConfig } from './bfa-program.config.js';
import { resolveApplyOps, setDotPath } from './bfa-sync-applier.js';
import { computeBfaDiff, type LocalEntitySnapshot } from './bfa-sync-differ.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run a full diff against a BFA Monday board.
 *
 * 1. Load workspace + board config
 * 2. Fetch Monday data via connector
 * 3. Interpret into ImportPlan
 * 4. Look up local entities via external_source_mappings
 * 5. Build snapshots from field_bindings
 * 6. Compute diff
 * 7. Store on monday_sync_states.last_diff_report
 */
export async function computeDiff(
    boardConfigId: string,
    userId: string,
): Promise<BfaSyncDiffReport> {
    // 1. Load board config
    const boardConfig = await mondayWorkspaceService.getBoardConfig(boardConfigId);
    if (!boardConfig) {
        throw new Error(`Board config ${boardConfigId} not found`);
    }

    // 2. Load workspace config
    const workspace = await mondayWorkspaceService.getWorkspace(boardConfig.workspace_id);
    if (!workspace) {
        throw new Error('Workspace not found');
    }

    const workspaceConfig = await mondayWorkspaceService.getFullWorkspaceConfig(workspace.id);
    if (!workspaceConfig) {
        throw new Error('Failed to load workspace configuration');
    }

    // 3. Get Monday token
    const token = await getMondayToken(userId);

    // 4. Fetch board data
    const connector = new MondayConnector(token);
    const boardNode = await connector.fetchBoard(boardConfig.board_id);

    // 5. Interpret into ImportPlan
    const sessionId = randomUUID();
    const plan = interpretMondayData([boardNode], workspaceConfig, sessionId);

    // 6. Look up local entities for all Monday items
    const mondayIds = plan.items
        .map(item => {
            const meta = item.metadata as Record<string, unknown>;
            return String(meta.mondayId ?? meta.monday_id ?? '');
        })
        .filter(Boolean);

    const localEntities = await buildLocalSnapshots(mondayIds);

    // 7. Compute diff
    const config = getBfaProgramConfig();
    const report = computeBfaDiff(plan.items, localEntities, config);

    // 8. Store on sync state
    await storeDiffReport(boardConfigId, report);

    // 9. Seed decision rows for every field change
    await seedDecisionsFromReport(boardConfigId, report);

    return report;
}

/**
 * Get the most recent diff report for a board config.
 */
export async function getDiffReport(
    boardConfigId: string,
): Promise<BfaSyncDiffReport | null> {
    const state = await db
        .selectFrom('monday_sync_states')
        .select(['last_diff_report', 'last_diff_report_at'])
        .where('board_config_id', '=', boardConfigId)
        .executeTakeFirst();

    if (!state?.last_diff_report) return null;
    return state.last_diff_report as BfaSyncDiffReport;
}

/**
 * List board configs that have diff reports, with summary info.
 */
export async function listDiffReports(
    limit = 20,
): Promise<Array<{ boardConfigId: string; boardName: string; reportAt: Date | null; report: BfaSyncDiffReport }>> {
    const rows = await db
        .selectFrom('monday_sync_states')
        .innerJoin('monday_board_configs', 'monday_board_configs.id', 'monday_sync_states.board_config_id')
        .select([
            'monday_sync_states.board_config_id',
            'monday_board_configs.board_name',
            'monday_sync_states.last_diff_report',
            'monday_sync_states.last_diff_report_at',
        ])
        .where('monday_sync_states.last_diff_report', 'is not', null)
        .orderBy('monday_sync_states.last_diff_report_at', 'desc')
        .limit(limit)
        .execute();

    return rows.map(r => ({
        boardConfigId: r.board_config_id,
        boardName: r.board_name,
        reportAt: r.last_diff_report_at,
        report: r.last_diff_report as BfaSyncDiffReport,
    }));
}

/**
 * Submit or update user decisions for field changes in a report.
 * Upserts on (report_id, entity_id, field) unique constraint.
 */
export async function submitDecisions(
    boardConfigId: string,
    reportId: string,
    decisions: Array<{ entityId: string; field: string; decision: string; assignedTo?: string }>,
    userId: string,
): Promise<{ updated: number }> {
    if (decisions.length === 0) return { updated: 0 };

    let updated = 0;
    for (const d of decisions) {
        const result = await db
            .updateTable('sync_decisions')
            .set({
                decision: d.decision,
                decided_by: userId,
                decided_at: new Date(),
                ...(d.assignedTo !== undefined ? { assigned_to: d.assignedTo } : {}),
            })
            .where('board_config_id', '=', boardConfigId)
            .where('report_id', '=', reportId)
            .where('entity_id', '=', d.entityId)
            .where('field', '=', d.field)
            .executeTakeFirst();

        if (result.numUpdatedRows > 0n) {
            updated++;
        }
    }

    return { updated };
}

/**
 * Apply accepted decisions to local entities.
 *
 * 1. Load report + decisions
 * 2. resolveApplyOps() to determine writes
 * 3. Write field_bindings for actions, metadata for hierarchy nodes
 * 4. Stamp applied decisions
 */
export async function applyDecisions(
    boardConfigId: string,
): Promise<BfaApplyResult> {
    // 1. Load report
    const report = await getDiffReport(boardConfigId);
    if (!report) {
        throw new Error('No diff report found for this board config');
    }

    // 2. Load all decisions for this report
    const decisionRows = await db
        .selectFrom('sync_decisions')
        .selectAll()
        .where('board_config_id', '=', boardConfigId)
        .where('report_id', '=', report.id)
        .execute();

    // 3. Resolve write operations
    const { writeOps, autoAccepted, counts } = resolveApplyOps(report, decisionRows as SyncDecision[]);

    // 4. Apply writes
    const errors: Array<{ entityId: string; field: string; error: string }> = [];

    // Determine which entities are actions vs hierarchy nodes
    const entityIds = [...writeOps.keys()];
    const entityTypeMap = new Map<string, 'action' | 'node'>();
    if (entityIds.length > 0) {
        const mappings = await db
            .selectFrom('external_source_mappings')
            .select(['local_entity_id', 'local_entity_type'])
            .where('provider', '=', 'monday')
            .where('local_entity_id', 'in', entityIds)
            .execute();

        for (const m of mappings) {
            entityTypeMap.set(
                m.local_entity_id,
                m.local_entity_type === 'action' ? 'action' : 'node',
            );
        }

        // Fallback: if entity not in mappings, try to detect by checking tables
        for (const eid of entityIds) {
            if (!entityTypeMap.has(eid)) {
                const action = await db
                    .selectFrom('actions')
                    .select('id')
                    .where('id', '=', eid)
                    .executeTakeFirst();
                entityTypeMap.set(eid, action ? 'action' : 'node');
            }
        }
    }

    for (const [entityId, ops] of writeOps) {
        const entityType = entityTypeMap.get(entityId) ?? 'action';

        try {
            if (entityType === 'action') {
                await applyActionWrites(entityId, ops);
            } else {
                await applyNodeWrites(entityId, ops);
            }
        } catch (err) {
            for (const op of ops) {
                errors.push({
                    entityId,
                    field: op.field,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }

    // 5. Stamp applied decisions
    if (autoAccepted.length > 0) {
        await db
            .updateTable('sync_decisions')
            .set({ applied_at: new Date() })
            .where('id', 'in', autoAccepted)
            .execute();
    }

    // Also stamp all monday-authority decisions that were auto-applied
    // (they may not have a decision row if the field wasn't in the decisions table somehow)
    await db
        .updateTable('sync_decisions')
        .set({ applied_at: new Date() })
        .where('board_config_id', '=', boardConfigId)
        .where('report_id', '=', report.id)
        .where('authority', '=', 'monday')
        .where('applied_at', 'is', null)
        .execute();

    return {
        applied: counts.applied,
        rejected: counts.rejected,
        deferred: counts.deferred,
        errors,
    };
}

/**
 * Inject applied sync changes into a Google Doc.
 *
 * 1. Load diff report + applied decisions
 * 2. Resolve entity IDs → project IDs via hierarchy
 * 3. Project export models for affected projects
 * 4. Build changedFields map from applied decisions
 * 5. Call injector to perform per-project replacement
 */
export async function injectToGoogleDoc(
    boardConfigId: string,
    documentId: string,
    userId: string,
): Promise<BfaInjectionResult> {
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
        throw new Error('No applied decisions found. Apply changes before injecting.');
    }

    // 3. Extract unique entity IDs from applied decisions
    const entityIds = [...new Set(appliedDecisions.map(d => d.entity_id))];

    // 4. Resolve entity IDs to project-level node IDs
    const projectIds = await resolveProjectIds(entityIds);
    if (projectIds.length === 0) {
        throw new Error('Could not resolve any project IDs from applied decisions');
    }

    // 5. Get Google token
    const token = await getGoogleToken(userId);

    // 6. Project export models for affected projects
    const exportModels = await projectBfaExportModels(projectIds, DEFAULT_EXPORT_OPTIONS);

    // 7. Build changedFields map: projectId → Set<fieldPath>
    const changedFields = new Map<string, Set<string>>();
    const entityToProject = await buildEntityToProjectMap(entityIds);

    for (const decision of appliedDecisions) {
        const projectId = entityToProject.get(decision.entity_id);
        if (!projectId) continue;

        const fields = changedFields.get(projectId) ?? new Set<string>();
        fields.add(decision.field);
        changedFields.set(projectId, fields);
    }

    // 8. Initialize Google Docs connector and client
    const client = new GoogleDocsClient({ accessToken: token });
    const connector = new GoogleDocsConnector({ accessToken: token });

    // 9. Inject
    return injectProjects(connector, client, documentId, exportModels, changedFields);
}

/**
 * List decisions for a board config with optional filters.
 */
export async function listDecisions(
    boardConfigId: string,
    reportId?: string,
    assignedTo?: string,
): Promise<SyncDecision[]> {
    let query = db
        .selectFrom('sync_decisions')
        .selectAll()
        .where('board_config_id', '=', boardConfigId)
        .orderBy('created_at', 'asc');

    if (reportId) {
        query = query.where('report_id', '=', reportId);
    }

    if (assignedTo) {
        query = query.where('assigned_to', '=', assignedTo);
    }

    return query.execute();
}

// ============================================================================
// INTERNAL — DECISION SEEDING
// ============================================================================

/**
 * Create sync_decisions rows for every fieldChange in a report.
 * Monday-authority rows get decision = 'accept' pre-populated.
 * Merge-authority rows start with decision = null (pending).
 *
 * Called automatically after computeDiff() stores the report.
 */
async function seedDecisionsFromReport(
    boardConfigId: string,
    report: BfaSyncDiffReport,
): Promise<void> {
    if (report.fieldChanges.length === 0) return;

    const rows = report.fieldChanges.map(change => ({
        board_config_id: boardConfigId,
        report_id: report.id,
        entity_id: change.entityId,
        field: change.field,
        source_field: change.sourceField,
        old_value: change.oldValue,
        new_value: change.newValue,
        authority: change.authority,
        severity: change.severity,
        decision: change.authority === 'monday' ? 'accept' : null,
    }));

    // Use onConflict to handle re-syncs that produce the same field changes
    await db
        .insertInto('sync_decisions')
        .values(rows)
        .onConflict(oc =>
            oc.columns(['report_id', 'entity_id', 'field']).doUpdateSet({
                old_value: (eb) => eb.ref('excluded.old_value'),
                new_value: (eb) => eb.ref('excluded.new_value'),
                authority: (eb) => eb.ref('excluded.authority'),
                severity: (eb) => eb.ref('excluded.severity'),
                source_field: (eb) => eb.ref('excluded.source_field'),
            }),
        )
        .execute();
}

// ============================================================================
// INTERNAL — ENTITY WRITES
// ============================================================================

/**
 * Apply field writes to an action's field_bindings array.
 * Loads the full array, merges/replaces matching fieldKey entries, writes back.
 */
async function applyActionWrites(
    actionId: string,
    ops: Array<{ field: string; newValue: string }>,
): Promise<void> {
    const action = await db
        .selectFrom('actions')
        .select('field_bindings')
        .where('id', '=', actionId)
        .executeTakeFirst();

    if (!action) {
        throw new Error(`Action ${actionId} not found`);
    }

    const bindings = parseFieldBindings(action.field_bindings);

    for (const op of ops) {
        const existing = bindings.find(b => b.fieldKey === op.field);
        if (existing) {
            existing.value = op.newValue;
        } else {
            bindings.push({ fieldKey: op.field, value: op.newValue });
        }
    }

    await db
        .updateTable('actions')
        .set({ field_bindings: JSON.stringify(bindings) })
        .where('id', '=', actionId)
        .execute();
}

/**
 * Apply field writes to a hierarchy node's metadata JSONB.
 * Uses setDotPath to update nested fields.
 */
async function applyNodeWrites(
    nodeId: string,
    ops: Array<{ field: string; newValue: string }>,
): Promise<void> {
    const node = await db
        .selectFrom('hierarchy_nodes')
        .select('metadata')
        .where('id', '=', nodeId)
        .executeTakeFirst();

    if (!node) {
        throw new Error(`Hierarchy node ${nodeId} not found`);
    }

    const metadata = (node.metadata ?? {}) as Record<string, unknown>;

    for (const op of ops) {
        setDotPath(metadata, op.field, op.newValue);
    }

    await db
        .updateTable('hierarchy_nodes')
        .set({
            metadata: JSON.stringify(metadata),
            updated_at: new Date(),
        })
        .where('id', '=', nodeId)
        .execute();
}

// ============================================================================
// INTERNAL
// ============================================================================

/**
 * Build LocalEntitySnapshot map from external_source_mappings + action field_bindings.
 *
 * For each Monday item ID, finds the local entity (action) via the mapping table,
 * then reads field_bindings to build a flat field map.
 */
async function buildLocalSnapshots(
    mondayIds: string[],
): Promise<Map<string, LocalEntitySnapshot>> {
    const result = new Map<string, LocalEntitySnapshot>();
    if (mondayIds.length === 0) return result;

    // Batch lookup: external_source_mappings for all Monday IDs
    const mappings = await db
        .selectFrom('external_source_mappings')
        .select(['external_id', 'local_entity_id', 'local_entity_type'])
        .where('provider', '=', 'monday')
        .where('external_id', 'in', mondayIds)
        .execute();

    if (mappings.length === 0) return result;

    // Group by entity type for efficient batch queries
    const actionIds: string[] = [];
    const nodeIds: string[] = [];
    const mappingByExternalId = new Map<string, { localId: string; localType: string }>();

    for (const m of mappings) {
        mappingByExternalId.set(m.external_id, {
            localId: m.local_entity_id,
            localType: m.local_entity_type,
        });
        if (m.local_entity_type === 'action') {
            actionIds.push(m.local_entity_id);
        } else {
            nodeIds.push(m.local_entity_id);
        }
    }

    // Fetch actions with field_bindings
    const actionSnapshots = new Map<string, LocalEntitySnapshot>();
    if (actionIds.length > 0) {
        const actions = await db
            .selectFrom('actions')
            .select(['id', 'type', 'field_bindings'])
            .where('id', 'in', actionIds)
            .execute();

        for (const action of actions) {
            const fields: Record<string, string | null> = {};
            const bindings = parseFieldBindings(action.field_bindings);
            for (const b of bindings) {
                fields[b.fieldKey] = b.value != null ? String(b.value) : null;
            }
            actionSnapshots.set(action.id, {
                entityId: action.id,
                projectLabel: String(fields.title ?? action.type ?? action.id),
                fields,
            });
        }
    }

    // Fetch hierarchy nodes with metadata
    const nodeSnapshots = new Map<string, LocalEntitySnapshot>();
    if (nodeIds.length > 0) {
        const nodes = await db
            .selectFrom('hierarchy_nodes')
            .select(['id', 'title', 'metadata'])
            .where('id', 'in', nodeIds)
            .execute();

        for (const node of nodes) {
            const fields = flattenMetadata(node.metadata);
            nodeSnapshots.set(node.id, {
                entityId: node.id,
                projectLabel: node.title,
                fields,
            });
        }
    }

    // Map Monday IDs → snapshots
    for (const [externalId, mapping] of mappingByExternalId) {
        const snapshot = mapping.localType === 'action'
            ? actionSnapshots.get(mapping.localId)
            : nodeSnapshots.get(mapping.localId);
        if (snapshot) {
            result.set(externalId, snapshot);
        }
    }

    return result;
}

/**
 * Parse field_bindings JSONB from actions table.
 * Format: [{ fieldKey: string, value: unknown }, ...]
 */
function parseFieldBindings(
    raw: unknown,
): Array<{ fieldKey: string; value: unknown }> {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (b: unknown): b is { fieldKey: string; value: unknown } =>
                typeof b === 'object' && b !== null && 'fieldKey' in b,
        );
    } catch {
        return [];
    }
}

/**
 * Flatten hierarchy_node metadata JSONB into dot-path record.
 * Handles one level of nesting (e.g. { fields: { total_budget: "$500k" } }
 * → { "fields.total_budget": "$500k" }).
 */
function flattenMetadata(raw: unknown): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    if (!raw || typeof raw !== 'object') return result;

    const obj = raw as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
        if (value != null && typeof value === 'object' && !Array.isArray(value)) {
            // One level deep
            for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
                result[`${key}.${subKey}`] = subVal != null ? String(subVal) : null;
            }
        } else {
            result[key] = value != null ? String(value) : null;
        }
    }
    return result;
}

/**
 * Resolve entity IDs to their project-level ancestor node IDs.
 * Walks up the hierarchy_nodes tree to find nodes with type='project'.
 * For entities that are themselves projects, returns them directly.
 * For entities in external_source_mappings (actions), looks up the
 * related hierarchy node first.
 */
async function resolveProjectIds(entityIds: string[]): Promise<string[]> {
    if (entityIds.length === 0) return [];

    // First check if any entities are actions mapped to hierarchy nodes
    const mappings = await db
        .selectFrom('external_source_mappings')
        .select(['local_entity_id', 'local_entity_type'])
        .where('provider', '=', 'monday')
        .where('local_entity_id', 'in', entityIds)
        .execute();

    // Collect all node IDs to check (entities might be actions or nodes)
    const nodeIdsToCheck = new Set<string>();

    // For actions, find associated hierarchy nodes via context
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

    // Also add any entityIds not found in mappings (might be hierarchy nodes directly)
    const mappedIds = new Set(mappings.map(m => m.local_entity_id));
    for (const id of entityIds) {
        if (!mappedIds.has(id)) nodeIdsToCheck.add(id);
    }

    if (nodeIdsToCheck.size === 0) return [];

    // Walk up the hierarchy to find project-level ancestors
    const nodeArray = [...nodeIdsToCheck];
    const projectIds = new Set<string>();

    // Check which of these are already projects
    const directProjects = await db
        .selectFrom('hierarchy_nodes')
        .select('id')
        .where('id', 'in', nodeArray)
        .where('type', '=', 'project')
        .execute();

    for (const p of directProjects) {
        projectIds.add(p.id);
    }

    // For non-project nodes, walk up to find project ancestor
    const nonProjectIds = nodeArray.filter(id => !projectIds.has(id));
    if (nonProjectIds.length > 0) {
        for (const nodeId of nonProjectIds) {
            const ancestor = await findProjectAncestor(nodeId);
            if (ancestor) projectIds.add(ancestor);
        }
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

/**
 * Build a map from entity IDs to their project-level ancestor IDs.
 */
async function buildEntityToProjectMap(entityIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (entityIds.length === 0) return result;

    // Check external_source_mappings for action entities
    const mappings = await db
        .selectFrom('external_source_mappings')
        .select(['local_entity_id', 'local_entity_type'])
        .where('provider', '=', 'monday')
        .where('local_entity_id', 'in', entityIds)
        .execute();

    const actionIds = mappings
        .filter(m => m.local_entity_type === 'action')
        .map(m => m.local_entity_id);

    // For actions, get context_id (hierarchy node reference)
    const actionContextMap = new Map<string, string>();
    if (actionIds.length > 0) {
        const actions = await db
            .selectFrom('actions')
            .select(['id', 'context_id'])
            .where('id', 'in', actionIds)
            .execute();

        for (const a of actions) {
            if (a.context_id) actionContextMap.set(a.id, a.context_id);
        }
    }

    // Resolve each entity to its project
    for (const entityId of entityIds) {
        // If it's an action, use its context_id as the starting node
        const startNodeId = actionContextMap.get(entityId) ?? entityId;
        const projectId = await findProjectAncestor(startNodeId);
        if (projectId) {
            result.set(entityId, projectId);
        }
    }

    return result;
}

/**
 * Store a diff report on the sync state row for the board config.
 */
async function storeDiffReport(
    boardConfigId: string,
    report: BfaSyncDiffReport,
): Promise<void> {
    // Ensure sync state exists
    await mondayWorkspaceService.getOrCreateSyncState(boardConfigId);

    await db
        .updateTable('monday_sync_states')
        .set({
            last_diff_report: JSON.stringify(report),
            last_diff_report_at: new Date(),
            updated_at: new Date(),
        })
        .where('board_config_id', '=', boardConfigId)
        .execute();
}
