/**
 * Slugify Utility
 *
 * Generates URL-safe slugs from strings for artwork identification.
 */

interface SlugifyOptions {
  lower?: boolean;
  strict?: boolean;
  replacement?: string;
}

/**
 * Convert a string to a URL-safe slug
 *
 * @param text - The text to slugify
 * @param options - Configuration options
 * @returns A URL-safe slug
 */
export function slugify(text: string, options: SlugifyOptions = {}): string {
  const { lower = true, strict = true, replacement = '-' } = options;

  let slug = text
    // Normalize unicode characters
    .normalize('NFD')
    // Remove diacritics
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and underscores with replacement char
    .replace(/[\s_]+/g, replacement)
    // Remove non-alphanumeric characters (except replacement)
    .replace(new RegExp(`[^a-zA-Z0-9${replacement}]`, 'g'), strict ? '' : replacement)
    // Remove duplicate replacement characters
    .replace(new RegExp(`${replacement}+`, 'g'), replacement)
    // Trim replacement from ends
    .replace(new RegExp(`^${replacement}|${replacement}$`, 'g'), '');

  if (lower) {
    slug = slug.toLowerCase();
  }

  return slug;
}

/**
 * Generate a slug from artifact metadata
 */
export function generateArtifactSlug(
  artifact: { path: string; metadata?: { title?: string } },
  index: number
): string {
  // Prefer title from metadata
  if (artifact.metadata?.title) {
    return slugify(artifact.metadata.title);
  }

  // Fall back to filename without extension
  const filename = artifact.path.split(/[/\\]/).pop() || '';
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  if (nameWithoutExt && nameWithoutExt.length > 0) {
    return slugify(nameWithoutExt);
  }

  // Last resort: indexed name
  return `image-${index + 1}`;
}
