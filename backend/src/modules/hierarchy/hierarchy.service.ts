import { sql } from 'kysely';
import { db } from '../../db/client.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import type { CreateNodeInput, UpdateNodeInput, MoveNodeInput, CloneNodeInput } from './hierarchy.schemas.js';
import type { HierarchyNode, NodeType } from '../../db/schema.js';
import * as recordsService from '../records/records.service.js';

// Validate hierarchy rules
const VALID_PARENTS: Record<NodeType, NodeType | null> = {
  project: null,
  process: 'project',
  stage: 'process',
  subprocess: 'stage',
  task: 'subprocess',
  subtask: 'task',
};

export async function getProjectTree(projectId: string): Promise<HierarchyNode[]> {
  // Verify project exists
  const project = await db
    .selectFrom('hierarchy_nodes')
    .select('id')
    .where('id', '=', projectId)
    .where('type', '=', 'project')
    .executeTakeFirst();

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Fetch entire tree using recursive CTE
  const nodes = await sql<HierarchyNode>`
    WITH RECURSIVE tree AS (
      SELECT * FROM hierarchy_nodes WHERE id = ${projectId}
      UNION ALL
      SELECT h.* FROM hierarchy_nodes h
      INNER JOIN tree t ON h.parent_id = t.id
    )
    SELECT * FROM tree ORDER BY position
  `.execute(db);

  return nodes.rows;
}

export async function getNodeById(nodeId: string): Promise<HierarchyNode | null> {
  const node = await db
    .selectFrom('hierarchy_nodes')
    .selectAll()
    .where('id', '=', nodeId)
    .executeTakeFirst();

  return node || null;
}

export async function createNode(input: CreateNodeInput, userId?: string): Promise<HierarchyNode> {
  let rootProjectId: string | null = null;

  if (input.parentId) {
    const parent = await getNodeById(input.parentId);
    if (!parent) {
      throw new NotFoundError('Parent node', input.parentId);
    }

    // Validate hierarchy rules
    const expectedParentType = VALID_PARENTS[input.type];
    if (expectedParentType !== parent.type) {
      throw new ValidationError(`A ${input.type} must be a child of a ${expectedParentType}, not ${parent.type}`);
    }

    rootProjectId = parent.root_project_id || parent.id;
  } else if (input.type !== 'project') {
    throw new ValidationError(`A ${input.type} must have a parent`);
  }

  // Get next position if not specified
  let position = input.position;
  if (position === undefined) {
    const maxPos = await db
      .selectFrom('hierarchy_nodes')
      .select(sql<number>`COALESCE(MAX(position), -1)`.as('max_pos'))
      .where('parent_id', input.parentId ? '=' : 'is', input.parentId ?? null)
      .executeTakeFirst();
    position = (maxPos?.max_pos ?? -1) + 1;
  }

  // Auto-link to default definition if available
  let defaultRecordDefId: string | null = null;
  const typeName = input.type.charAt(0).toUpperCase() + input.type.slice(1);

  const definition = await db
    .selectFrom('record_definitions')
    .select('id')
    .where('name', '=', typeName)
    .where((eb) =>
      eb.or([
        eb('project_id', '=', rootProjectId),
        eb('project_id', 'is', null),
      ])
    )
    .orderBy('project_id', 'desc') // Prefer project-specific over global
    .executeTakeFirst();

  if (definition) {
    defaultRecordDefId = definition.id;
  }

  const node = await db
    .insertInto('hierarchy_nodes')
    .values({
      parent_id: input.parentId || null,
      root_project_id: rootProjectId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      position,
      default_record_def_id: defaultRecordDefId,
      created_by: userId || null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // If this is a project, set its root_project_id to itself
  if (input.type === 'project') {
    await db
      .updateTable('hierarchy_nodes')
      .set({ root_project_id: node.id })
      .where('id', '=', node.id)
      .execute();
    node.root_project_id = node.id;
  }

  return node;
}

export async function updateNode(nodeId: string, input: UpdateNodeInput): Promise<HierarchyNode> {
  const existing = await getNodeById(nodeId);
  if (!existing) {
    throw new NotFoundError('Node', nodeId);
  }

  // GUARDRAIL: Task/subtask nodes are read-only after migration 022.
  // They exist only as positional coordinates, not state-bearing entities.
  // All task state is derived from Actions + Events.
  // TODO: Remove task/subtask nodes entirely in Phase 6 cleanup.
  if (existing.type === 'task' || existing.type === 'subtask') {
    const metadata = (typeof existing.metadata === 'string'
      ? JSON.parse(existing.metadata)
      : existing.metadata) as Record<string, unknown> | null;

    if (metadata?.legacy_migrated) {
      throw new ValidationError(
        `Cannot update ${existing.type} node: task/subtask nodes are read-only after migration. ` +
        `Use Actions and Events instead.`
      );
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.metadata !== undefined) updates.metadata = input.metadata;
  if (input.position !== undefined) updates.position = input.position;

  const node = await db
    .updateTable('hierarchy_nodes')
    .set(updates)
    .where('id', '=', nodeId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return node;
}

export async function deleteNode(nodeId: string): Promise<void> {
  const existing = await getNodeById(nodeId);
  if (!existing) {
    throw new NotFoundError('Node', nodeId);
  }

  // GUARDRAIL: Task/subtask nodes are read-only after migration 022.
  // They can only be removed in the final Phase 6 cleanup migration.
  if (existing.type === 'task' || existing.type === 'subtask') {
    const metadata = (typeof existing.metadata === 'string'
      ? JSON.parse(existing.metadata)
      : existing.metadata) as Record<string, unknown> | null;

    if (metadata?.legacy_migrated) {
      throw new ValidationError(
        `Cannot delete ${existing.type} node: task/subtask nodes are read-only after migration. ` +
        `They will be removed in the final cleanup migration.`
      );
    }
  }

  // CASCADE will handle children
  await db
    .deleteFrom('hierarchy_nodes')
    .where('id', '=', nodeId)
    .execute();
}

export async function moveNode(nodeId: string, input: MoveNodeInput): Promise<HierarchyNode> {
  // Wrap in transaction to ensure atomic move with descendant updates
  return await db.transaction().execute(async (trx) => {
    const node = await trx
      .selectFrom('hierarchy_nodes')
      .selectAll()
      .where('id', '=', nodeId)
      .executeTakeFirst();

    if (!node) {
      throw new NotFoundError('Node', nodeId);
    }

    let newRootProjectId = node.root_project_id;

    if (input.newParentId) {
      const newParent = await trx
        .selectFrom('hierarchy_nodes')
        .selectAll()
        .where('id', '=', input.newParentId)
        .executeTakeFirst();

      if (!newParent) {
        throw new NotFoundError('New parent node', input.newParentId);
      }

      // Validate hierarchy rules
      const expectedParentType = VALID_PARENTS[node.type];
      if (expectedParentType !== newParent.type) {
        throw new ValidationError(`Cannot move ${node.type} under ${newParent.type}`);
      }

      // Prevent circular reference
      const descendantResult = await sql<{ id: string }>`
        WITH RECURSIVE descendants AS (
          SELECT id FROM hierarchy_nodes WHERE parent_id = ${nodeId}
          UNION ALL
          SELECT h.id FROM hierarchy_nodes h
          INNER JOIN descendants d ON h.parent_id = d.id
        )
        SELECT id FROM descendants
      `.execute(trx);

      const descendants = descendantResult.rows.map(r => r.id);
      if (descendants.includes(input.newParentId)) {
        throw new ValidationError('Cannot move a node under its own descendant');
      }

      newRootProjectId = newParent.root_project_id || newParent.id;
    } else if (node.type !== 'project') {
      throw new ValidationError(`A ${node.type} must have a parent`);
    }

    // Update position if specified
    let position = input.position;
    if (position === undefined) {
      const maxPos = await trx
        .selectFrom('hierarchy_nodes')
        .select(sql<number>`COALESCE(MAX(position), -1)`.as('max_pos'))
        .where('parent_id', input.newParentId ? '=' : 'is', input.newParentId)
        .executeTakeFirst();
      position = (maxPos?.max_pos ?? -1) + 1;
    }

    // Update node and all descendants' root_project_id
    if (newRootProjectId !== node.root_project_id) {
      await sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM hierarchy_nodes WHERE id = ${nodeId}
          UNION ALL
          SELECT h.id FROM hierarchy_nodes h
          INNER JOIN descendants d ON h.parent_id = d.id
        )
        UPDATE hierarchy_nodes SET root_project_id = ${newRootProjectId}
        WHERE id IN (SELECT id FROM descendants)
      `.execute(trx);
    }

    const updated = await trx
      .updateTable('hierarchy_nodes')
      .set({
        parent_id: input.newParentId,
        root_project_id: newRootProjectId,
        position,
        updated_at: new Date(),
      })
      .where('id', '=', nodeId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });
}

async function getDescendantIds(nodeId: string): Promise<string[]> {
  const result = await sql<{ id: string }>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM hierarchy_nodes WHERE parent_id = ${nodeId}
      UNION ALL
      SELECT h.id FROM hierarchy_nodes h
      INNER JOIN descendants d ON h.parent_id = d.id
    )
    SELECT id FROM descendants
  `.execute(db);

  return result.rows.map(r => r.id);
}

async function updateDescendantsRootProject(nodeId: string, newRootProjectId: string | null): Promise<void> {
  await sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM hierarchy_nodes WHERE id = ${nodeId}
      UNION ALL
      SELECT h.id FROM hierarchy_nodes h
      INNER JOIN descendants d ON h.parent_id = d.id
    )
    UPDATE hierarchy_nodes SET root_project_id = ${newRootProjectId}
    WHERE id IN (SELECT id FROM descendants)
  `.execute(db);
}

// Depth limits for clone filtering
const DEPTH_LIMITS: Record<string, NodeType[]> = {
  all: ['project', 'process', 'stage', 'subprocess', 'task'],
  process: ['project', 'process'],
  stage: ['project', 'process', 'stage'],
  subprocess: ['project', 'process', 'stage', 'subprocess'],
};

// Deep Clone Implementation
export async function deepCloneNode(input: CloneNodeInput, userId?: string): Promise<HierarchyNode> {
  const sourceNode = await getNodeById(input.sourceNodeId);
  if (!sourceNode) {
    throw new NotFoundError('Source node', input.sourceNodeId);
  }

  // Determine target parent
  let targetParentId = input.targetParentId;
  let newRootProjectId: string | null = null;

  if (targetParentId !== undefined) {
    if (targetParentId !== null) {
      const targetParent = await getNodeById(targetParentId);
      if (!targetParent) {
        throw new NotFoundError('Target parent node', targetParentId);
      }

      const expectedParentType = VALID_PARENTS[sourceNode.type];
      if (expectedParentType !== targetParent.type) {
        throw new ValidationError(`Cannot clone ${sourceNode.type} under ${targetParent.type}`);
      }

      newRootProjectId = targetParent.root_project_id || targetParent.id;
    }
  } else {
    // Clone as sibling
    targetParentId = sourceNode.parent_id;
    newRootProjectId = sourceNode.root_project_id;
  }

  // Determine allowed node types based on depth option
  const allowedTypes = input.depth ? DEPTH_LIMITS[input.depth] : DEPTH_LIMITS.all;

  // Fetch entire subtree
  const sourceTree = await sql<HierarchyNode>`
    WITH RECURSIVE tree AS (
      SELECT * FROM hierarchy_nodes WHERE id = ${input.sourceNodeId}
      UNION ALL
      SELECT h.* FROM hierarchy_nodes h
      INNER JOIN tree t ON h.parent_id = t.id
    )
    SELECT * FROM tree
  `.execute(db);

  if (sourceTree.rows.length === 0) {
    throw new NotFoundError('Source node', input.sourceNodeId);
  }

  // Filter nodes based on depth
  const filteredTree = sourceTree.rows.filter(node =>
    allowedTypes.includes(node.type)
  );

  // Generate ID mapping (only for nodes we're cloning)
  const idMap = new Map<string, string>();
  for (const node of filteredTree) {
    idMap.set(node.id, crypto.randomUUID());
  }

  // Get next position for root of cloned tree
  const maxPos = await db
    .selectFrom('hierarchy_nodes')
    .select(sql<number>`COALESCE(MAX(position), -1)`.as('max_pos'))
    .where('parent_id', targetParentId ? '=' : 'is', targetParentId)
    .executeTakeFirst();
  const rootPosition = (maxPos?.max_pos ?? -1) + 1;

  // Prepare insert values
  const insertValues = filteredTree.map((node) => {
    const isRoot = node.id === input.sourceNodeId;
    const newId = idMap.get(node.id)!;
    // Only remap parent if the parent is in our ID map (was cloned)
    const newParentId = isRoot
      ? targetParentId
      : (node.parent_id && idMap.has(node.parent_id) ? idMap.get(node.parent_id)! : null);

    // Handle metadata merging for cloned nodes
    let clonedMetadata = node.metadata;
    if (isRoot && input.overrides?.metadata) {
      const existingMeta = typeof node.metadata === 'string'
        ? JSON.parse(node.metadata || '{}')
        : (node.metadata || {});
      clonedMetadata = { ...existingMeta, ...input.overrides.metadata };
    }

    return {
      id: newId,
      parent_id: newParentId,
      root_project_id: newRootProjectId,
      type: node.type,
      title: isRoot && input.overrides?.title ? input.overrides.title : node.title,
      description: node.description,
      position: isRoot ? rootPosition : node.position,
      metadata: clonedMetadata,
      default_record_def_id: node.default_record_def_id,
      created_by: userId || null,
    };
  });

  // Wrap core cloning operations in a transaction to ensure atomicity
  // This includes: node insert, reference clone, and root_project_id update
  await db.transaction().execute(async (trx) => {
    // Bulk insert cloned nodes
    await trx
      .insertInto('hierarchy_nodes')
      .values(insertValues)
      .execute();

    // Clone task references for all cloned nodes (only tasks)
    const sourceNodeIds = Array.from(idMap.keys());
    const refs = await trx
      .selectFrom('task_references')
      .selectAll()
      .where('task_id', 'in', sourceNodeIds)
      .execute();

    if (refs.length > 0) {
      const refInserts = refs.map(ref => ({
        task_id: idMap.get(ref.task_id)!,
        source_record_id: ref.source_record_id,
        target_field_key: ref.target_field_key,
        mode: ref.mode,
        snapshot_value: ref.snapshot_value,
      }));

      await trx
        .insertInto('task_references')
        .values(refInserts)
        .execute();
    }

    // If cloning a project, update root_project_id for all cloned nodes
    if (sourceNode.type === 'project') {
      const newRootId = idMap.get(input.sourceNodeId)!;
      await trx
        .updateTable('hierarchy_nodes')
        .set({ root_project_id: newRootId })
        .where('id', 'in', Array.from(idMap.values()))
        .execute();
    }
  });

  // Template and record cloning happens outside the core transaction
  // These are considered secondary operations that can be retried independently
  if (sourceNode.type === 'project') {
    const newRootId = idMap.get(input.sourceNodeId)!;

    // Clone template definitions if requested
    if (input.includeTemplates) {
      await recordsService.cloneProjectDefinitions(input.sourceNodeId, newRootId);
    }

    // Clone associated records if requested
    if (input.includeRecords) {
      await cloneProjectRecords(input.sourceNodeId, newRootId, idMap, userId);
    }
  }

  // Return the new root node
  const newRootNode = await getNodeById(idMap.get(input.sourceNodeId)!);
  return newRootNode!;
}

/**
 * Clone all records associated with a project to the new project
 */
async function cloneProjectRecords(
  sourceProjectId: string,
  targetProjectId: string,
  nodeIdMap: Map<string, string>,
  userId?: string
): Promise<void> {
  // Get all records classified under nodes in the source project
  const records = await db
    .selectFrom('records')
    .selectAll()
    .where('classification_node_id', 'in', Array.from(nodeIdMap.keys()))
    .execute();

  if (records.length === 0) {
    return;
  }

  const recordInserts = records.map(record => ({
    definition_id: record.definition_id,
    // Remap classification node to cloned node
    classification_node_id: record.classification_node_id
      ? nodeIdMap.get(record.classification_node_id) || record.classification_node_id
      : null,
    unique_name: `${record.unique_name}_copy`,
    data: record.data,
    created_by: userId || null,
  }));

  await db
    .insertInto('records')
    .values(recordInserts)
    .execute();
}

export async function listProjects(userId?: string): Promise<HierarchyNode[]> {
  let query = db
    .selectFrom('hierarchy_nodes')
    .selectAll()
    .where('type', '=', 'project')
    .orderBy('created_at', 'desc');

  if (userId) {
    query = query.where('created_by', '=', userId);
  }

  return query.execute();
}
