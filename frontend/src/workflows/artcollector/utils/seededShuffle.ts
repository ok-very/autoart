/**
 * Seeded Shuffle - Deterministic shuffling for "shake" feature
 *
 * Uses mulberry32 PRNG for consistent results given the same seed.
 * This allows the layout to be reproducible when the user wants to
 * "shake" the layout to try different arrangements.
 */

/**
 * Mulberry32 - a fast, high-quality 32-bit PRNG
 * Returns a function that generates numbers in [0, 1)
 */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle an array using Fisher-Yates algorithm with a seeded PRNG
 *
 * @param array - The array to shuffle
 * @param seed - A number seed for reproducible results
 * @returns A new shuffled array (does not mutate the original)
 */
export function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const random = mulberry32(seed);
  let m = result.length;

  while (m) {
    const i = Math.floor(random() * m--);
    [result[m], result[i]] = [result[i], result[m]];
  }

  return result;
}
