/**
 * Vocabulary Service
 *
 * Extracts and persists action vocabulary (verb/noun/adjective) from
 * classification interpretation plans. Supports frequency-based
 * autocomplete suggestions.
 */

import { sql } from 'kysely';

import { db } from '@db/client.js';
import { logger } from '@utils/logger.js';

// ============================================================================
// VOCABULARY EXTRACTION
// ============================================================================

/**
 * Known action verbs recognized during extraction.
 * Words outside this set are not treated as verbs, causing the
 * extraction to return null (non-actionable text).
 */
const ACTION_VERBS = new Set([
  'review',
  'approve',
  'submit',
  'prepare',
  'schedule',
  'send',
  'create',
  'update',
  'assign',
  'finalize',
  'complete',
  'deliver',
  'inspect',
  'install',
  'order',
  'confirm',
  'coordinate',
  'design',
  'draft',
  'edit',
  'email',
  'fabricate',
  'frame',
  'measure',
  'mount',
  'notify',
  'pack',
  'paint',
  'photograph',
  'print',
  'process',
  'produce',
  'receive',
  'remove',
  'repair',
  'replace',
  'request',
  'resize',
  'restore',
  'return',
  'seal',
  'select',
  'ship',
  'sign',
  'sketch',
  'source',
  'store',
  'stretch',
  'transfer',
  'transport',
  'trim',
  'upload',
  'verify',
  'varnish',
  'wrap',
]);

/**
 * Trailing adjectives that qualify the noun phrase.
 * If the last word matches, it is separated as the adjective.
 */
const TRAILING_ADJECTIVES = new Set([
  'final',
  'preliminary',
  'initial',
  'updated',
  'revised',
  'draft',
  'approved',
  'pending',
  'completed',
  'partial',
  'original',
  'corrected',
]);

export interface ExtractedVocabulary {
  verb: string;
  noun: string;
  adjective?: string;
}

/**
 * Extracts verb/noun/adjective from a classification's interpretation text.
 * Uses a simple heuristic: first word = verb (if recognized), remaining = noun phrase,
 * optional trailing adjective.
 *
 * Returns null for non-actionable text (first word is not a known verb).
 */
export function extractVocabulary(text: string, _outcome: string): ExtractedVocabulary | null {
  const trimmed = text.toLowerCase().trim();
  if (!trimmed) return null;

  const words = trimmed.split(/\s+/);
  if (words.length < 2) return null; // Need at least verb + noun

  const verb = words[0];
  if (!ACTION_VERBS.has(verb)) return null;

  const remaining = words.slice(1);

  // Check if the last word is a trailing adjective
  let adjective: string | undefined;
  if (remaining.length > 1) {
    const lastWord = remaining[remaining.length - 1];
    if (TRAILING_ADJECTIVES.has(lastWord)) {
      adjective = lastWord;
      remaining.pop();
    }
  }

  const noun = remaining.join(' ');
  if (!noun) return null;

  return { verb, noun, adjective };
}

// ============================================================================
// VOCABULARY PERSISTENCE
// ============================================================================

/**
 * Upsert a vocabulary entry. Increments frequency if the verb/noun/adjective
 * combination already exists, inserts a new row otherwise.
 */
export async function storeVocabulary(vocab: {
  verb: string;
  noun: string;
  adjective?: string;
  classificationOutcome: string;
}): Promise<void> {
  try {
    // Use raw SQL for INSERT ... ON CONFLICT because Kysely's onConflict
    // support for nullable columns in unique constraints can be tricky.
    // The UNIQUE constraint on (verb, noun, adjective) treats NULL adjective
    // as distinct, so we coalesce to empty string for the conflict target.
    await db
      .insertInto('action_vocabulary')
      .values({
        verb: vocab.verb,
        noun: vocab.noun,
        adjective: vocab.adjective ?? null,
        classification_outcome: vocab.classificationOutcome,
      })
      .onConflict((oc) =>
        oc.columns(['verb', 'noun', 'adjective']).doUpdateSet({
          frequency: sql`action_vocabulary.frequency + 1`,
          last_seen_at: new Date(),
        }),
      )
      .execute();
  } catch (err) {
    logger.error({ error: err, vocab }, '[vocabulary] Failed to store vocabulary entry');
    throw err;
  }
}

// ============================================================================
// VOCABULARY SUGGESTIONS
// ============================================================================

/**
 * Query vocabulary entries by prefix for autocomplete suggestions.
 * Searches where verb OR noun starts with the given prefix (case-insensitive).
 * Returns results ordered by frequency descending.
 */
export async function getSuggestions(
  prefix: string,
  limit: number = 10,
): Promise<Array<{ verb: string; noun: string; adjective: string | null; frequency: number }>> {
  const normalizedPrefix = prefix.toLowerCase().trim();
  if (!normalizedPrefix) return [];

  const likePattern = `${normalizedPrefix}%`;

  const results = await db
    .selectFrom('action_vocabulary')
    .select(['verb', 'noun', 'adjective', 'frequency'])
    .where((eb) =>
      eb.or([
        eb('verb', 'ilike', likePattern),
        eb('noun', 'ilike', likePattern),
      ]),
    )
    .orderBy('frequency', 'desc')
    .limit(limit)
    .execute();

  return results;
}
