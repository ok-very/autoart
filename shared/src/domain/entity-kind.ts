/**
 * Entity Kind Resolver
 *
 * Unified type discrimination for AutoArt entities.
 * Replaces scattered entityType string checks with a single resolver
 * that derives kind from structural relationships (hierarchy type,
 * definition kind, parent context).
 *
 * Resolution order:
 * 1. HierarchyNode.type → return directly (project, process, stage, subprocess, template)
 * 2. RecordDefinition.definition_kind → map to entity kind
 * 3. DataRecord.definition_id + definitions lookup → recurse on definition's kind
 * 4. ImportPlanItem.entityType → validate and return
 * 5. Fallback → 'unknown'
 */

import type { NodeType, DefinitionKind } from '../schemas/enums.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Canonical entity kinds in AutoArt.
 *
 * Maps 1:1 to hierarchy NodeType for structural entities.
 * 'record' and 'action' are the two user-facing data entity kinds
 * (action_arrangement collapses to 'action' — the domain concept).
 * Container definitions resolve to their specific hierarchy type via name lookup.
 */
export type EntityKind =
  | 'project'
  | 'process'
  | 'stage'
  | 'subprocess'
  | 'template'
  | 'record'
  | 'action'
  | 'unknown';

const ENTITY_KINDS: ReadonlySet<string> = new Set<EntityKind>([
  'project',
  'process',
  'stage',
  'subprocess',
  'template',
  'record',
  'action',
  'unknown',
]);

const NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
  'project',
  'process',
  'stage',
  'subprocess',
  'template',
]);

/**
 * Minimal definition shape accepted by the resolver.
 * Tolerates both `kind` (Zod schema) and `definition_kind` (raw API column).
 */
export interface DefinitionLike {
  id: string;
  definition_kind?: string;
  name?: string;
}

/**
 * Input union for resolveEntityKind.
 * Accepts any object that carries enough signal to derive entity kind.
 */
export type EntityKindInput =
  | { type: NodeType }                              // HierarchyNode
  | { definition_id: string }                       // DataRecord
  | { entityType?: string; parentTempId?: string }  // ImportPlanItem
  | { definition_kind?: DefinitionKind }            // RecordDefinition (DB column)
  | Record<string, unknown>;                        // catch-all for partial objects

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a definition's kind (+ optional name for containers) to EntityKind.
 */
export function definitionKindToEntityKind(
  kind: string,
  name?: string,
): EntityKind {
  switch (kind) {
    case 'record':
      return 'record';
    case 'action_arrangement':
      return 'action';
    case 'container': {
      if (!name) return 'subprocess'; // safe default for unnamed containers
      const lower = name.toLowerCase();
      if (lower === 'process') return 'process';
      if (lower === 'stage') return 'stage';
      if (lower === 'subprocess') return 'subprocess';
      return 'subprocess'; // unknown container name → default
    }
    default:
      return 'unknown';
  }
}

/**
 * Type guard: is the value a valid EntityKind?
 */
export function isEntityKind(value: string): value is EntityKind {
  return ENTITY_KINDS.has(value);
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical EntityKind for an object.
 *
 * @param item   - Any entity-like object (hierarchy node, data record,
 *                 record definition, import plan item)
 * @param definitions - Optional definitions array for definition_id lookup.
 *                      Required when resolving DataRecords.
 */
export function resolveEntityKind(
  item: EntityKindInput,
  definitions?: ReadonlyArray<DefinitionLike>,
): EntityKind {
  const obj = item as Record<string, unknown>;

  // 1. HierarchyNode — has `type` that matches a NodeType
  if (typeof obj.type === 'string' && NODE_TYPES.has(obj.type)) {
    return obj.type as EntityKind;
  }

  // 2. RecordDefinition — has `definition_kind` (canonical DB column)
  if (typeof obj.definition_kind === 'string' && isDefinitionKind(obj.definition_kind)) {
    return definitionKindToEntityKind(obj.definition_kind, obj.name as string | undefined);
  }

  // 3. DataRecord — has `definition_id`, look up in provided definitions
  if (typeof obj.definition_id === 'string' && definitions) {
    const def = definitions.find((d) => d.id === obj.definition_id);
    if (def) {
      const kind = def.definition_kind;
      if (kind) {
        return definitionKindToEntityKind(kind, def.name);
      }
    }
  }

  // 5. ImportPlanItem — has `entityType`
  if (typeof obj.entityType === 'string') {
    return isEntityKind(obj.entityType) ? obj.entityType : 'unknown';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const DEFINITION_KINDS: ReadonlySet<string> = new Set<DefinitionKind>([
  'record',
  'action_arrangement',
  'container',
]);

function isDefinitionKind(value: string): value is DefinitionKind {
  return DEFINITION_KINDS.has(value);
}
