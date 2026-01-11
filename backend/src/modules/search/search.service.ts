import { sql } from 'kysely';

import { db } from '../../db/client.js';

interface SearchResult {
  id: string;
  type: 'record' | 'node';
  name: string;
  path?: string; // Full hierarchy path e.g. "Project.Stage.Subprocess"
  nodeType?: string;
  definitionName?: string;
  fields?: { key: string; label: string }[];
}

// Get the full hierarchy path for a node using recursive CTE
async function getNodePath(nodeId: string): Promise<string> {
  const result = await sql<{ path: string }>`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, title, 0 as depth
      FROM hierarchy_nodes
      WHERE id = ${nodeId}
      UNION ALL
      SELECT h.id, h.parent_id, h.title, a.depth + 1
      FROM hierarchy_nodes h
      JOIN ancestors a ON h.id = a.parent_id
    )
    SELECT string_agg(title, '.' ORDER BY depth DESC) as path
    FROM ancestors
  `.execute(db);

  return result.rows[0]?.path || '';
}

// Resolve a path like "Project.Stage.Subprocess" to a node ID
export async function resolveHierarchyPath(path: string, projectId?: string): Promise<string | null> {
  const parts = path.split('.');
  if (parts.length === 0) return null;

  // Start from root (project) or within a specific project
  let currentId: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    let query = db
      .selectFrom('hierarchy_nodes')
      .select('id')
      .where('title', 'ilike', part);

    if (i === 0) {
      // First part - search at root level or within project
      if (projectId) {
        query = query.where((eb) =>
          eb.or([
            eb('id', '=', projectId),
            eb.and([
              eb('root_project_id', '=', projectId),
              eb('parent_id', 'is', null),
            ]),
          ])
        );
      } else {
        query = query.where('type', '=', 'project');
      }
    } else {
      // Subsequent parts - search as children of current node
      query = query.where('parent_id', '=', currentId!);
    }

    const node = await query.executeTakeFirst();
    if (!node) return null;
    currentId = node.id;
  }

  return currentId;
}

export async function resolveSearch(query: string, projectId?: string, limit = 20): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Handle empty query - show recent items
  const isEmptyQuery = !query || query.trim() === '';
  const searchPattern = isEmptyQuery ? '%' : `%${query}%`;

  // Search records
  let recordQuery = db
    .selectFrom('records')
    .innerJoin('record_definitions', 'record_definitions.id', 'records.definition_id')
    .select([
      'records.id',
      'records.unique_name',
      'records.created_at',
      'record_definitions.name as definition_name',
      'record_definitions.schema_config',
    ]);

  // Only apply ILIKE filter if we have a query
  if (!isEmptyQuery) {
    recordQuery = recordQuery.where('records.unique_name', 'ilike', searchPattern);
  }

  const records = await recordQuery
    .$if(!!projectId, (qb) =>
      qb.where('records.classification_node_id', 'in', (eb) =>
        eb
          .selectFrom('hierarchy_nodes')
          .select('id')
          .where('root_project_id', '=', projectId!)
      )
    )
    .orderBy('records.created_at', 'desc')
    .limit(limit)
    .execute();

  for (const record of records) {
    const schemaConfig = typeof record.schema_config === 'string'
      ? JSON.parse(record.schema_config)
      : record.schema_config;

    const fields = (schemaConfig?.fields || []).map((f: { key: string; label: string }) => ({
      key: f.key,
      label: f.label,
    }));

    results.push({
      id: record.id,
      type: 'record',
      name: record.unique_name,
      definitionName: record.definition_name,
      fields,
    });
  }

  // Search hierarchy nodes (all types that can have metadata fields)
  let nodeQuery = db
    .selectFrom('hierarchy_nodes')
    .select(['id', 'title', 'type', 'metadata', 'created_at']);

  // Only apply ILIKE filter if we have a query
  if (!isEmptyQuery) {
    nodeQuery = nodeQuery.where('title', 'ilike', searchPattern);
  }

  const nodes = await nodeQuery
    .$if(!!projectId, (qb) =>
      qb.where((eb) =>
        eb.or([
          eb('id', '=', projectId!),
          eb('root_project_id', '=', projectId!),
        ])
      )
    )
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();

  for (const node of nodes) {
    const metadata = typeof node.metadata === 'string'
      ? JSON.parse(node.metadata)
      : node.metadata;

    // Extract field-like properties from metadata
    const fields = Object.keys(metadata || {}).map(key => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    }));

    // Get full hierarchy path for the node
    const path = await getNodePath(node.id);

    results.push({
      id: node.id,
      type: 'node',
      name: node.title,
      path,
      nodeType: node.type,
      fields,
    });
  }

  // Sort by relevance (exact match first, then by name length)
  // For empty queries, keep the default order (by created_at desc)
  if (!isEmptyQuery) {
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === query.toLowerCase();
      const bExact = b.name.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.name.length - b.name.length;
    });
  }

  return results.slice(0, limit);
}

// Full-text search using PostgreSQL tsvector (for more advanced searching)
export async function fullTextSearch(query: string, projectId?: string, limit = 20): Promise<SearchResult[]> {
  // Convert query to tsquery format
  const tsQuery = query.split(' ').filter(Boolean).map(w => `${w}:*`).join(' & ');

  if (!tsQuery) return [];

  const results: SearchResult[] = [];

  // Search records with full-text
  const records = await sql<{
    id: string;
    unique_name: string;
    definition_name: string;
    schema_config: unknown;
    rank: number;
  }>`
    SELECT
      r.id,
      r.unique_name,
      rd.name as definition_name,
      rd.schema_config,
      ts_rank(to_tsvector('english', r.unique_name || ' ' || COALESCE(r.data::text, '')), to_tsquery('english', ${tsQuery})) as rank
    FROM records r
    INNER JOIN record_definitions rd ON rd.id = r.definition_id
    WHERE to_tsvector('english', r.unique_name || ' ' || COALESCE(r.data::text, '')) @@ to_tsquery('english', ${tsQuery})
    ${projectId ? sql`AND r.classification_node_id IN (SELECT id FROM hierarchy_nodes WHERE root_project_id = ${projectId})` : sql``}
    ORDER BY rank DESC
    LIMIT ${limit}
  `.execute(db);

  for (const record of records.rows) {
    const schemaConfig = typeof record.schema_config === 'string'
      ? JSON.parse(record.schema_config)
      : record.schema_config;

    const fields = ((schemaConfig as { fields?: { key: string; label: string }[] })?.fields || []).map(f => ({
      key: f.key,
      label: f.label,
    }));

    results.push({
      id: record.id,
      type: 'record',
      name: record.unique_name,
      definitionName: record.definition_name,
      fields,
    });
  }

  return results;
}
