/**
 * Classification Cache
 *
 * In-memory TTL cache for classification results. Avoids recomputing
 * classifications when regenerating a plan with unchanged content.
 *
 * Key format: classification:${sessionId}:${contentHash}
 * TTL: 1 hour
 * Invalidated on: execution, resolution updates
 */

import { createHash } from 'node:crypto';

import { logger } from '@utils/logger.js';

import type { ItemClassification, ImportPlanItem } from '../types.js';
import type { RecordDefinition } from '@db/schema.js';

// ============================================================================
// CACHE STORAGE
// ============================================================================

interface CacheEntry {
  data: ItemClassification[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 3_600_000; // 1 hour
const CLEANUP_INTERVAL_MS = 300_000; // 5 minutes

// Periodic cleanup of expired entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupRunning(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.debug({ evicted, remaining: cache.size }, '[classification-cache] Expired entries evicted');
    }
    // Stop the timer if cache is empty to avoid keeping the process alive
    if (cache.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit even if the timer is running
  cleanupTimer.unref();
}

// ============================================================================
// HASH DERIVATION
// ============================================================================

/**
 * Derive a content hash from plan items and definitions.
 * Uses a fast SHA-256 over the serialized inputs to detect content changes.
 */
function deriveContentHash(items: ImportPlanItem[], definitions: RecordDefinition[]): string {
  const hasher = createHash('sha256');
  // Hash item identifiers and classification-relevant fields
  for (const item of items) {
    hasher.update(item.tempId);
    hasher.update(item.title);
    if (item.metadata) hasher.update(JSON.stringify(item.metadata));
    if (item.fieldRecordings) hasher.update(JSON.stringify(item.fieldRecordings));
  }
  // Hash definition identifiers to detect schema changes
  for (const def of definitions) {
    hasher.update(def.id);
    hasher.update(def.name);
  }
  return hasher.digest('hex').slice(0, 16); // Truncated — collisions are harmless (cache miss)
}

function buildKey(sessionId: string, contentHash: string): string {
  return `classification:${sessionId}:${contentHash}`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Look up cached classifications for the given session + content.
 * Returns undefined on cache miss or expiry.
 */
export function getCached(
  sessionId: string,
  items: ImportPlanItem[],
  definitions: RecordDefinition[],
): ItemClassification[] | undefined {
  const hash = deriveContentHash(items, definitions);
  const key = buildKey(sessionId, hash);
  const entry = cache.get(key);

  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  logger.debug({ sessionId, cacheKey: key }, '[classification-cache] Cache hit');
  return entry.data;
}

/**
 * Store classification results in the cache.
 */
export function setCached(
  sessionId: string,
  items: ImportPlanItem[],
  definitions: RecordDefinition[],
  classifications: ItemClassification[],
): void {
  const hash = deriveContentHash(items, definitions);
  const key = buildKey(sessionId, hash);

  cache.set(key, {
    data: classifications,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  ensureCleanupRunning();
  logger.debug({ sessionId, cacheKey: key, cacheSize: cache.size }, '[classification-cache] Entry cached');
}

/**
 * Invalidate all cached classifications for a session.
 * Called on execution and resolution updates.
 */
export function invalidateSession(sessionId: string): void {
  const prefix = `classification:${sessionId}:`;
  let evicted = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      evicted++;
    }
  }
  if (evicted > 0) {
    logger.debug({ sessionId, evicted }, '[classification-cache] Session entries invalidated');
  }
}

/**
 * Clear the entire cache. Useful for testing.
 */
export function clearAll(): void {
  cache.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
