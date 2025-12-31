/**
 * Migration 013: Fix Icon Emojis
 *
 * Updates existing record definitions that have Lucide icon names
 * to use actual emoji Unicode characters instead.
 *
 * This fixes the display issue where icons showed as text (e.g., "user")
 * instead of emoji characters (e.g., "👤").
 */

import { Kysely, sql } from 'kysely';

// Map of old icon names to new emoji characters
const ICON_REPLACEMENTS: Record<string, string> = {
  'user': '👤',
  'map-pin': '📍',
  'package': '📦',
  'file-text': '📄',
  'folder': '📁',
  'workflow': '⚙️',
  'layers': '📋',
  'git-branch': '🌿',
  'check-square': '✅',
};

export async function up(db: Kysely<unknown>): Promise<void> {
  // Update each icon name to its emoji equivalent
  for (const [oldIcon, newEmoji] of Object.entries(ICON_REPLACEMENTS)) {
    await sql`
      UPDATE record_definitions
      SET styling = jsonb_set(styling, '{icon}', ${JSON.stringify(newEmoji)}::jsonb)
      WHERE styling->>'icon' = ${oldIcon}
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Revert emojis back to icon names
  for (const [oldIcon, newEmoji] of Object.entries(ICON_REPLACEMENTS)) {
    await sql`
      UPDATE record_definitions
      SET styling = jsonb_set(styling, '{icon}', ${JSON.stringify(oldIcon)}::jsonb)
      WHERE styling->>'icon' = ${newEmoji}
    `.execute(db);
  }
}
