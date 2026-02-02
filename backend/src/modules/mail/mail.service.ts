/**
 * Mail Service
 *
 * Manages promoted emails (mail_messages) and their polymorphic links
 * to actions, records, and hierarchy nodes.
 *
 * Promotion fetches email data from AutoHelper via HTTP and persists
 * it in PostgreSQL. Idempotent — re-promoting an existing external_id
 * returns the existing row.
 */

import { db } from '../../db/client.js';
import { env } from '../../config/env.js';
import type { MailMessage, MailLink } from '../../db/schema.js';

// =============================================================================
// TYPES
// =============================================================================

interface AutoHelperEmail {
  id: string;
  subject: string | null;
  sender: string | null;
  received_at: string | null;
  project_id: string | null;
  body_preview: string | null;
  body_html: string | null;
  metadata: Record<string, unknown> | null;
}

interface PromoteResult {
  message: MailMessage;
  created: boolean;
}

interface ListFilters {
  projectId?: string;
  limit?: number;
  offset?: number;
}

const VALID_TARGET_TYPES = new Set(['action', 'record', 'hierarchy_node']);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract sender name from email address.
 * "John Doe <john@example.com>" -> "John Doe"
 */
function extractSenderName(sender: string | null): string | null {
  if (!sender) return null;
  const match = sender.match(/^(.+?)\s*<[^>]+>$/);
  return match ? match[1].trim() : null;
}

/**
 * Fetch a transient email from AutoHelper by ID.
 */
async function fetchFromAutoHelper(externalId: string): Promise<AutoHelperEmail> {
  const url = `${env.AUTOHELPER_URL}/mail/emails/${encodeURIComponent(externalId)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`AutoHelper returned ${response.status}: ${await response.text()}`);
    }
    return await response.json() as AutoHelperEmail;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// PROMOTION
// =============================================================================

/**
 * Promote a transient email from AutoHelper into a durable mail_message.
 * Idempotent: if the external_id already exists, returns the existing row.
 */
export async function promoteEmail(
  externalId: string,
  promotedBy: string
): Promise<PromoteResult> {
  // Fast path — return existing row without locking
  const existing = await db
    .selectFrom('mail_messages')
    .selectAll()
    .where('external_id', '=', externalId)
    .executeTakeFirst();

  if (existing) {
    return { message: existing, created: false };
  }

  // Fetch from AutoHelper
  const email = await fetchFromAutoHelper(externalId);

  // Upsert — ON CONFLICT handles concurrent promotions
  const message = await db
    .insertInto('mail_messages')
    .values({
      external_id: externalId,
      subject: email.subject,
      sender: email.sender,
      sender_name: extractSenderName(email.sender),
      received_at: email.received_at ? new Date(email.received_at) : null,
      body_preview: email.body_preview,
      body_html: email.body_html ?? null,
      metadata: email.metadata ?? {},
      project_id: email.project_id ?? null,
      promoted_by: promotedBy,
    })
    .onConflict((oc) => oc.column('external_id').doNothing())
    .returningAll()
    .executeTakeFirst();

  // ON CONFLICT DO NOTHING returns no row — re-select the winner
  if (!message) {
    const winner = await db
      .selectFrom('mail_messages')
      .selectAll()
      .where('external_id', '=', externalId)
      .executeTakeFirstOrThrow();
    return { message: winner, created: false };
  }

  return { message, created: true };
}

// =============================================================================
// QUERIES
// =============================================================================

export async function getMailMessage(id: string): Promise<MailMessage | undefined> {
  return db
    .selectFrom('mail_messages')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function getMailMessageByExternalId(
  externalId: string
): Promise<MailMessage | undefined> {
  return db
    .selectFrom('mail_messages')
    .selectAll()
    .where('external_id', '=', externalId)
    .executeTakeFirst();
}

export async function listMailMessages(filters: ListFilters = {}): Promise<{
  messages: MailMessage[];
  total: number;
}> {
  let query = db.selectFrom('mail_messages').selectAll();
  let countQuery = db
    .selectFrom('mail_messages')
    .select(db.fn.countAll<number>().as('count'));

  if (filters.projectId) {
    query = query.where('project_id', '=', filters.projectId);
    countQuery = countQuery.where('project_id', '=', filters.projectId);
  }

  query = query.orderBy('promoted_at', 'desc');

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.limit(limit).offset(offset);

  const [messages, countResult] = await Promise.all([
    query.execute(),
    countQuery.executeTakeFirstOrThrow(),
  ]);

  return { messages, total: Number(countResult.count) };
}

/**
 * Return all promoted external_ids. Useful for frontend badge overlay —
 * lets the inbox mark which transient emails have been promoted.
 */
export async function getPromotedExternalIds(): Promise<string[]> {
  const rows = await db
    .selectFrom('mail_messages')
    .select('external_id')
    .execute();

  return rows.map((r) => r.external_id);
}

// =============================================================================
// LINKS
// =============================================================================

export async function linkEmail(
  messageId: string,
  targetType: string,
  targetId: string,
  createdBy: string
): Promise<MailLink> {
  if (!VALID_TARGET_TYPES.has(targetType)) {
    throw new Error(`Invalid target_type: ${targetType}`);
  }

  return db
    .insertInto('mail_links')
    .values({
      mail_message_id: messageId,
      target_type: targetType,
      target_id: targetId,
      created_by: createdBy,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function unlinkEmail(linkId: string): Promise<boolean> {
  const result = await db
    .deleteFrom('mail_links')
    .where('id', '=', linkId)
    .executeTakeFirst();

  return BigInt(result.numDeletedRows) > 0n;
}

export async function getLinksForTarget(
  targetType: string,
  targetId: string
): Promise<(MailLink & { message: MailMessage })[]> {
  const rows = await db
    .selectFrom('mail_links')
    .innerJoin('mail_messages', 'mail_messages.id', 'mail_links.mail_message_id')
    .select([
      'mail_links.id',
      'mail_links.mail_message_id',
      'mail_links.target_type',
      'mail_links.target_id',
      'mail_links.created_at',
      'mail_links.created_by',
      'mail_messages.id as message_id',
      'mail_messages.external_id',
      'mail_messages.subject',
      'mail_messages.sender',
      'mail_messages.sender_name',
      'mail_messages.received_at',
      'mail_messages.body_preview',
      'mail_messages.body_html',
      'mail_messages.metadata',
      'mail_messages.project_id',
      'mail_messages.promoted_at',
      'mail_messages.promoted_by',
      'mail_messages.created_at as message_created_at',
    ])
    .where('mail_links.target_type', '=', targetType)
    .where('mail_links.target_id', '=', targetId)
    .orderBy('mail_links.created_at', 'desc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    mail_message_id: row.mail_message_id,
    target_type: row.target_type,
    target_id: row.target_id,
    created_at: row.created_at,
    created_by: row.created_by,
    message: {
      id: row.message_id,
      external_id: row.external_id,
      subject: row.subject,
      sender: row.sender,
      sender_name: row.sender_name,
      received_at: row.received_at,
      body_preview: row.body_preview,
      body_html: row.body_html,
      metadata: row.metadata,
      project_id: row.project_id,
      promoted_at: row.promoted_at,
      promoted_by: row.promoted_by,
      created_at: row.message_created_at,
    },
  }));
}

export async function getLinksForMessage(messageId: string): Promise<MailLink[]> {
  return db
    .selectFrom('mail_links')
    .selectAll()
    .where('mail_message_id', '=', messageId)
    .orderBy('created_at', 'desc')
    .execute();
}
