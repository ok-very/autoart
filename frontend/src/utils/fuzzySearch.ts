/**
 * Fuzzy Search Utility
 *
 * Provides fuzzy matching for searching records and nodes in the hierarchy.
 * Uses a scoring algorithm that considers:
 * - Exact matches (highest score)
 * - Prefix matches
 * - Word boundary matches
 * - Consecutive character matches
 * - Character proximity
 */

export interface FuzzyMatch<T> {
  item: T;
  score: number;
  matches: MatchRange[];
}

export interface MatchRange {
  start: number;
  end: number;
}

export interface FuzzySearchOptions {
  /** Minimum score threshold (0-1) to include results. Default: 0 */
  threshold?: number;
  /** Maximum number of results to return. Default: unlimited */
  limit?: number;
  /** Whether the search is case-sensitive. Default: false */
  caseSensitive?: boolean;
}

/**
 * Calculate fuzzy match score between a query and a target string.
 * Returns a score between 0 (no match) and 1 (exact match).
 */
export function fuzzyScore(
  query: string,
  target: string,
  caseSensitive = false
): { score: number; matches: MatchRange[] } {
  if (!query || !target) {
    return { score: 0, matches: [] };
  }

  const q = caseSensitive ? query : query.toLowerCase();
  const t = caseSensitive ? target : target.toLowerCase();

  // Exact match
  if (q === t) {
    return { score: 1, matches: [{ start: 0, end: target.length }] };
  }

  // Check if query is longer than target
  if (q.length > t.length) {
    return { score: 0, matches: [] };
  }

  const matches: MatchRange[] = [];
  let queryIndex = 0;
  let consecutiveBonus = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let i = 0; i < t.length && queryIndex < q.length; i++) {
    if (t[i] === q[queryIndex]) {
      const matchStart = i;

      // Count consecutive matches
      let matchEnd = i;
      while (
        matchEnd < t.length &&
        queryIndex < q.length &&
        t[matchEnd] === q[queryIndex]
      ) {
        matchEnd++;
        queryIndex++;
      }

      matches.push({ start: matchStart, end: matchEnd });

      const matchLength = matchEnd - matchStart;
      let matchScore = matchLength / q.length;

      // Bonus for consecutive matches
      if (lastMatchIndex === matchStart - 1) {
        consecutiveBonus += 0.1;
        matchScore += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }

      // Bonus for word boundary matches
      if (matchStart === 0 || /[\s\-_.]/.test(t[matchStart - 1])) {
        matchScore += 0.15;
      }

      // Bonus for prefix match
      if (matchStart === 0) {
        matchScore += 0.2;
      }

      // Penalty for gaps between matches
      if (lastMatchIndex >= 0) {
        const gap = matchStart - lastMatchIndex - 1;
        matchScore -= gap * 0.02;
      }

      score += matchScore;
      lastMatchIndex = matchEnd - 1;
    }
  }

  // Did we match all query characters?
  if (queryIndex < q.length) {
    return { score: 0, matches: [] };
  }

  // Normalize score (cap at 1)
  const normalizedScore = Math.min(1, Math.max(0, score / q.length));

  // Additional penalty for much longer targets
  const lengthPenalty = 1 - (t.length - q.length) / (t.length * 4);
  const finalScore = normalizedScore * Math.max(0.5, lengthPenalty);

  return { score: finalScore, matches };
}

/**
 * Perform fuzzy search on an array of items.
 */
export function fuzzySearch<T>(
  query: string,
  items: T[],
  keyExtractor: (item: T) => string,
  options: FuzzySearchOptions = {}
): FuzzyMatch<T>[] {
  const { threshold = 0, limit, caseSensitive = false } = options;

  if (!query.trim()) {
    // Return all items with full score if no query
    const results = items.map((item) => ({
      item,
      score: 1,
      matches: [] as MatchRange[],
    }));
    return limit ? results.slice(0, limit) : results;
  }

  const results: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const target = keyExtractor(item);
    const { score, matches } = fuzzyScore(query, target, caseSensitive);

    if (score > threshold) {
      results.push({ item, score, matches });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return limit ? results.slice(0, limit) : results;
}

/**
 * Multi-field fuzzy search - searches across multiple fields and combines scores.
 */
export function fuzzySearchMultiField<T>(
  query: string,
  items: T[],
  fieldExtractors: { key: string; extractor: (item: T) => string; weight?: number }[],
  options: FuzzySearchOptions = {}
): FuzzyMatch<T>[] {
  const { threshold = 0, limit, caseSensitive = false } = options;

  if (!query.trim()) {
    const results = items.map((item) => ({
      item,
      score: 1,
      matches: [] as MatchRange[],
    }));
    return limit ? results.slice(0, limit) : results;
  }

  const results: FuzzyMatch<T>[] = [];

  for (const item of items) {
    let totalScore = 0;
    let totalWeight = 0;
    const allMatches: MatchRange[] = [];

    for (const { extractor, weight = 1 } of fieldExtractors) {
      const target = extractor(item);
      const { score, matches } = fuzzyScore(query, target, caseSensitive);
      totalScore += score * weight;
      totalWeight += weight;
      allMatches.push(...matches);
    }

    const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    if (normalizedScore > threshold) {
      results.push({ item, score: normalizedScore, matches: allMatches });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return limit ? results.slice(0, limit) : results;
}

/**
 * Highlight matched portions of a string with HTML tags.
 */
export function highlightMatches(
  text: string,
  matches: MatchRange[],
  highlightClass = 'bg-yellow-200'
): string {
  if (matches.length === 0) return text;

  // Sort and merge overlapping ranges
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);
  const mergedMatches: MatchRange[] = [];

  for (const match of sortedMatches) {
    const last = mergedMatches[mergedMatches.length - 1];
    if (last && match.start <= last.end) {
      last.end = Math.max(last.end, match.end);
    } else {
      mergedMatches.push({ ...match });
    }
  }

  // Build highlighted string
  let result = '';
  let lastEnd = 0;

  for (const { start, end } of mergedMatches) {
    result += text.slice(lastEnd, start);
    result += `<span class="${highlightClass}">${text.slice(start, end)}</span>`;
    lastEnd = end;
  }

  result += text.slice(lastEnd);
  return result;
}
