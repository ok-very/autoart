import { db } from '../../db/client.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { getParser, listParsers } from './parser.registry.js';
import type { ParserConfig, ParsedData, ParserSummary } from './parser.types.js';
import type { HierarchyNode } from '../../db/schema.js';

export interface IngestionInput {
  parserName: string;
  rawData: string;
  parserConfig?: ParserConfig;
  targetProjectId?: string; // If null, create new project
  userId?: string;
}

export interface IngestionResult {
  projectId: string;
  projectTitle: string;
  nodeCount: number;
  parsedData: ParsedData;
}

export interface PreviewResult {
  parsedData: ParsedData;
  stageCount: number;
  taskCount: number;
}

/**
 * Get list of available parsers.
 */
export function getAvailableParsers(): ParserSummary[] {
  return listParsers();
}

/**
 * Preview parsing without importing.
 */
export function previewIngestion(
  parserName: string,
  rawData: string,
  config?: ParserConfig
): PreviewResult {
  const parser = getParser(parserName);
  if (!parser) {
    throw new NotFoundError('Parser', parserName);
  }

  const parsedData = parser.parse(rawData, config || {});

  // Count stages and tasks
  let stageCount = 0;
  let taskCount = 0;

  for (const node of parsedData.nodes) {
    if (node.type === 'stage') stageCount++;
    if (node.type === 'task') taskCount++;
  }

  return {
    parsedData,
    stageCount,
    taskCount,
  };
}

/**
 * Run full ingestion - parse and insert into database.
 */
export async function runIngestion(input: IngestionInput): Promise<IngestionResult> {
  const parser = getParser(input.parserName);
  if (!parser) {
    throw new NotFoundError('Parser', input.parserName);
  }

  if (!input.rawData || input.rawData.trim().length === 0) {
    throw new ValidationError('No data provided for ingestion');
  }

  // Parse the data
  const parsedData = parser.parse(input.rawData, input.parserConfig || {});

  if (parsedData.nodes.length === 0) {
    throw new ValidationError('Parser produced no nodes from input data');
  }

  // Build ID map: tempId -> real UUID
  const idMap = new Map<string, string>();

  // Determine if we're creating a new project or using existing
  let projectId: string;
  let projectNode: HierarchyNode;

  if (input.targetProjectId) {
    // Use existing project
    const existing = await db
      .selectFrom('hierarchy_nodes')
      .selectAll()
      .where('id', '=', input.targetProjectId)
      .where('type', '=', 'project')
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Project', input.targetProjectId);
    }

    projectId = existing.id;
    projectNode = existing;
  } else {
    // Create new project
    projectNode = await db
      .insertInto('hierarchy_nodes')
      .values({
        parent_id: null,
        type: 'project',
        title: parsedData.projectTitle,
        description: null,
        metadata: JSON.stringify(parsedData.projectMeta),
        position: 0,
        created_by: input.userId || null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Update root_project_id to self
    await db
      .updateTable('hierarchy_nodes')
      .set({ root_project_id: projectNode.id })
      .where('id', '=', projectNode.id)
      .execute();

    projectId = projectNode.id;
  }

  // Generate UUIDs for all parsed nodes
  for (const node of parsedData.nodes) {
    idMap.set(node.tempId, crypto.randomUUID());
  }

  // Prepare insert values, resolving parent IDs
  const insertValues = parsedData.nodes.map((node, index) => {
    const newId = idMap.get(node.tempId)!;

    // Resolve parent ID
    let parentId: string | null = null;
    if (node.parentTempId) {
      parentId = idMap.get(node.parentTempId) || null;
    }

    // If parent is still null but we have a process/stage/subprocess,
    // link to appropriate parent level
    if (!parentId) {
      if (node.type === 'process') {
        parentId = projectId;
      }
      // Other types should have explicit parents from the parser
    }

    return {
      id: newId,
      parent_id: parentId,
      root_project_id: projectId,
      type: node.type,
      title: node.title,
      description: node.description ? JSON.stringify(node.description) : null,
      metadata: node.metadata ? JSON.stringify(node.metadata) : '{}',
      position: index,
      created_by: input.userId || null,
    };
  });

  // Bulk insert nodes
  if (insertValues.length > 0) {
    await db
      .insertInto('hierarchy_nodes')
      .values(insertValues)
      .execute();
  }

  return {
    projectId,
    projectTitle: parsedData.projectTitle,
    nodeCount: insertValues.length,
    parsedData,
  };
}
