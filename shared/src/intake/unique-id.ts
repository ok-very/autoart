/**
 * Intake unique_id generator
 *
 * Generates URL-safe unique identifiers from form titles.
 * Format: <slug(title)>-<suffix>
 *
 * @see https://github.com/ok-very/autoart/issues/90
 */

/**
 * Slugify a title into a URL-safe lowercase hyphenated string.
 * - Removes accents/diacritics
 * - Converts spaces and underscores to hyphens
 * - Removes non-alphanumeric characters (except hyphens)
 * - Collapses multiple hyphens
 * - Trims leading/trailing hyphens
 * - Truncates to max 50 chars
 */
export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase()
    .replace(/[_\s]+/g, '-') // Spaces and underscores to hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric except hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
    .slice(0, 50); // Max length
}

/**
 * Generate a short random suffix (6 chars, alphanumeric lowercase).
 */
export function generateSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(6);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 6; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Generate a unique_id from a form title.
 * Format: <slug>-<suffix>
 *
 * @param title - The form title to generate an ID from
 * @returns A unique identifier like "contact-form-abc123"
 */
export function generateUniqueId(title: string): string {
  const slug = slugifyTitle(title);
  const suffix = generateSuffix();

  // Handle edge case where title produces empty slug
  if (!slug) {
    return `form-${suffix}`;
  }

  return `${slug}-${suffix}`;
}
