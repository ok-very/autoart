/**
 * Record Links Service
 *
 * Manages many-to-many relationships between records.
 * Supports bidirectional queries and link type filtering.
 */

import { db } from '../../db/client.js';
import type { NewRecordLink, RecordLink } from '../../db/schema.js';

export interface CreateLinkInput {
  sourceRecordId: string;
  targetRecordId: string;
  linkType: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface LinkWithRecords extends RecordLink {
  source_record?: {
    id: string;
    unique_name: string;
    definition_name: string;
  };
  target_record?: {
    id: string;
    unique_name: string;
    definition_name: string;
  };
}

/**
 * Create a new link between two records.
 */
export async function createLink(input: CreateLinkInput): Promise<RecordLink> {
  const newLink: NewRecordLink = {
    source_record_id: input.sourceRecordId,
    target_record_id: input.targetRecordId,
    link_type: input.linkType,
    metadata: input.metadata || {},
    created_by: input.createdBy || null,
  };

  const link = await db
    .insertInto('record_links')
    .values(newLink)
    .returningAll()
    .executeTakeFirstOrThrow();

  return link;
}

/**
 * Get a link by ID.
 */
export async function getLinkById(id: string): Promise<RecordLink | undefined> {
  return db
    .selectFrom('record_links')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

/**
 * Get all links from a source record.
 */
export async function getLinksFromRecord(
  sourceRecordId: string,
  linkType?: string
): Promise<LinkWithRecords[]> {
  let query = db
    .selectFrom('record_links')
    .innerJoin('records as target', 'target.id', 'record_links.target_record_id')
    .innerJoin('record_definitions as target_def', 'target_def.id', 'target.definition_id')
    .select([
      'record_links.id',
      'record_links.source_record_id',
      'record_links.target_record_id',
      'record_links.link_type',
      'record_links.metadata',
      'record_links.created_by',
      'record_links.created_at',
      'target.unique_name as target_name',
      'target_def.name as target_definition_name',
    ])
    .where('record_links.source_record_id', '=', sourceRecordId);

  if (linkType) {
    query = query.where('record_links.link_type', '=', linkType);
  }

  const results = await query.orderBy('record_links.created_at', 'desc').execute();

  return results.map((r) => ({
    id: r.id,
    source_record_id: r.source_record_id,
    target_record_id: r.target_record_id,
    link_type: r.link_type,
    metadata: r.metadata,
    created_by: r.created_by,
    created_at: r.created_at,
    target_record: {
      id: r.target_record_id,
      unique_name: r.target_name,
      definition_name: r.target_definition_name,
    },
  }));
}

/**
 * Get all links to a target record (backlinks).
 */
export async function getLinksToRecord(
  targetRecordId: string,
  linkType?: string
): Promise<LinkWithRecords[]> {
  let query = db
    .selectFrom('record_links')
    .innerJoin('records as source', 'source.id', 'record_links.source_record_id')
    .innerJoin('record_definitions as source_def', 'source_def.id', 'source.definition_id')
    .select([
      'record_links.id',
      'record_links.source_record_id',
      'record_links.target_record_id',
      'record_links.link_type',
      'record_links.metadata',
      'record_links.created_by',
      'record_links.created_at',
      'source.unique_name as source_name',
      'source_def.name as source_definition_name',
    ])
    .where('record_links.target_record_id', '=', targetRecordId);

  if (linkType) {
    query = query.where('record_links.link_type', '=', linkType);
  }

  const results = await query.orderBy('record_links.created_at', 'desc').execute();

  return results.map((r) => ({
    id: r.id,
    source_record_id: r.source_record_id,
    target_record_id: r.target_record_id,
    link_type: r.link_type,
    metadata: r.metadata,
    created_by: r.created_by,
    created_at: r.created_at,
    source_record: {
      id: r.source_record_id,
      unique_name: r.source_name,
      definition_name: r.source_definition_name,
    },
  }));
}

/**
 * Get all links for a record (both directions).
 */
export async function getAllLinksForRecord(
  recordId: string,
  linkType?: string
): Promise<{ outgoing: LinkWithRecords[]; incoming: LinkWithRecords[] }> {
  const [outgoing, incoming] = await Promise.all([
    getLinksFromRecord(recordId, linkType),
    getLinksToRecord(recordId, linkType),
  ]);

  return { outgoing, incoming };
}

/**
 * Delete a link by ID.
 */
export async function deleteLink(id: string): Promise<boolean> {
  const result = await db
    .deleteFrom('record_links')
    .where('id', '=', id)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0) > 0;
}

/**
 * Delete a specific link between two records.
 */
export async function deleteLinkBetweenRecords(
  sourceRecordId: string,
  targetRecordId: string,
  linkType: string
): Promise<boolean> {
  const result = await db
    .deleteFrom('record_links')
    .where('source_record_id', '=', sourceRecordId)
    .where('target_record_id', '=', targetRecordId)
    .where('link_type', '=', linkType)
    .executeTakeFirst();

  return (result.numDeletedRows ?? 0) > 0;
}

/**
 * Update link metadata.
 */
export async function updateLinkMetadata(
  id: string,
  metadata: Record<string, unknown>
): Promise<RecordLink | undefined> {
  return db
    .updateTable('record_links')
    .set({ metadata })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();
}

/**
 * Get all unique link types used in the system.
 */
export async function getLinkTypes(): Promise<string[]> {
  const results = await db
    .selectFrom('record_links')
    .select('link_type')
    .distinct()
    .orderBy('link_type')
    .execute();

  return results.map((r) => r.link_type);
}
