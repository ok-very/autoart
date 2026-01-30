/**
 * Computed Fields Service
 *
 * Resolves computed fields (formula, rollup, currency display) on records.
 * Called when ?resolve=true is passed to record retrieval endpoints.
 */

import type { FieldDef, SchemaConfig } from '@autoart/shared';
import {
  evaluateFormula,
  createRecordResolver,
  computeRollup,
  detectCycles,
  extractReferences,
} from '@autoart/shared';

import { db } from '../../db/client.js';

/**
 * Record data with computed fields resolved.
 * The `_computed` key holds resolved values keyed by field key.
 */
export interface ResolvedRecord {
  data: Record<string, unknown>;
  _computed: Record<string, unknown>;
}

/**
 * Resolve all computed and rollup fields on a single record.
 *
 * @param recordId - The record's ID (needed for rollup link queries)
 * @param data - The record's raw data JSONB
 * @param schemaConfig - The definition's schema config
 */
export async function resolveComputedFields(
  recordId: string,
  data: Record<string, unknown>,
  schemaConfig: SchemaConfig,
): Promise<ResolvedRecord> {
  const computed: Record<string, unknown> = {};
  const fields = schemaConfig.fields;

  // Phase 1: Resolve rollup fields (they depend on linked records, not sibling fields)
  const rollupFields = fields.filter(
    (f) => f.type === 'rollup' && f.rollupConfig,
  );

  // Cache linked data by linkType so duplicate linkTypes reuse the same query
  const linkedDataCache = new Map<string, Array<Record<string, unknown>>>();

  for (const field of rollupFields) {
    const config = field.rollupConfig!;
    try {
      let linkedData = linkedDataCache.get(config.linkType);
      if (!linkedData) {
        linkedData = await fetchLinkedRecordData(recordId, config.linkType);
        linkedDataCache.set(config.linkType, linkedData);
      }
      const result = computeRollup(
        linkedData,
        config.targetField,
        config.aggregation,
      );
      computed[field.key] = result.value;
    } catch {
      computed[field.key] = null;
    }
  }

  // Phase 2: Resolve computed fields (formulas referencing sibling fields + rollups)
  const computedFields = fields.filter(
    (f) => f.type === 'computed' && f.formula,
  );

  // Check for cycles
  const formulaMap = new Map<string, string>();
  for (const f of computedFields) {
    formulaMap.set(f.key, f.formula!);
  }
  const cycleNodes = detectCycles(formulaMap);

  // Build resolver that sees raw data + already-resolved rollups + already-resolved computed
  const resolvedData: Record<string, unknown> = { ...data, ...computed };

  // Topological resolution: resolve in dependency order
  const resolved = new Set<string>();
  const resolving = new Set<string>();

  function resolveField(field: FieldDef): void {
    if (resolved.has(field.key)) return;
    if (resolving.has(field.key) || cycleNodes.has(field.key)) {
      computed[field.key] = null;
      return;
    }

    resolving.add(field.key);

    // Resolve dependencies first
    const deps = extractReferences(field.formula!);
    for (const dep of deps) {
      const depField = computedFields.find((f) => f.key === dep);
      if (depField && !resolved.has(dep)) {
        resolveField(depField);
        resolvedData[dep] = (dep in computed) ? computed[dep] : resolvedData[dep];
      }
    }

    const resolver = createRecordResolver(resolvedData);
    const result = evaluateFormula(field.formula!, resolver);
    computed[field.key] = result.resolvedValue;
    resolvedData[field.key] = result.resolvedValue;

    resolving.delete(field.key);
    resolved.add(field.key);
  }

  for (const field of computedFields) {
    resolveField(field);
  }

  return { data, _computed: computed };
}

/**
 * Fetch the data JSONB from all records linked to a source record by link type.
 */
async function fetchLinkedRecordData(
  sourceRecordId: string,
  linkType: string,
): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .selectFrom('record_links')
    .innerJoin('records', 'records.id', 'record_links.target_record_id')
    .select('records.data')
    .where('record_links.source_record_id', '=', sourceRecordId)
    .where('record_links.link_type', '=', linkType)
    .execute();

  return rows.map((r) => {
    if (typeof r.data === 'string') {
      return JSON.parse(r.data) as Record<string, unknown>;
    }
    return (r.data ?? {}) as Record<string, unknown>;
  });
}
