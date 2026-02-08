/**
 * BFA Sync Service — Orchestration
 *
 * Coordinates: fetch Monday data → compute diff → store report.
 * No mutations to project data — that's Phase 4.3.
 */

import { randomUUID } from 'crypto';

import type { BfaSyncDiffReport } from '@autoart/shared';

import { db } from '../../db/client.js';
import { getMondayToken } from '../imports/connections.service.js';
import { MondayConnector } from '../imports/connectors/monday-connector.js';
import { interpretMondayData } from '../imports/monday/monday-domain-interpreter.js';
import * as mondayWorkspaceService from '../imports/monday/monday-workspace.service.js';
import { getBfaProgramConfig } from './bfa-program.config.js';
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
