/**
 * Rollup Engine — Aggregation functions for rollup fields
 *
 * Pure functions that aggregate a numeric field across a collection of records.
 * Used by computed-fields.service.ts to resolve rollup field types.
 */

export type AggregationType = 'sum' | 'count' | 'min' | 'max' | 'avg';

/**
 * Rollup result with metadata.
 */
export interface RollupResult {
  value: number | null;
  count: number;
  aggregation: AggregationType;
  error?: string;
}

/**
 * Extract a numeric value from a record's data by field key.
 * Handles plain numbers, string numbers, and currency { amount } objects.
 */
function extractNumericValue(
  data: Record<string, unknown>,
  fieldKey: string,
): number | null {
  const raw = data[fieldKey];

  if (raw === null || raw === undefined) return null;

  // Currency value: { amount: number, currency: string }
  if (typeof raw === 'object' && 'amount' in raw) {
    const amt = (raw as { amount: unknown }).amount;
    return typeof amt === 'number' ? amt : null;
  }

  if (typeof raw === 'number') return raw;

  if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Compute a rollup aggregation across a set of record data objects.
 *
 * @param records - Array of record data objects (the `data` JSONB from each record)
 * @param fieldKey - The field key to aggregate
 * @param aggregation - The aggregation function to apply
 */
export function computeRollup(
  records: Array<Record<string, unknown>>,
  fieldKey: string,
  aggregation: AggregationType,
): RollupResult {
  if (aggregation === 'count') {
    return {
      value: records.length,
      count: records.length,
      aggregation,
    };
  }

  const values: number[] = [];
  for (const data of records) {
    const val = extractNumericValue(data, fieldKey);
    if (val !== null) {
      values.push(val);
    }
  }

  if (values.length === 0) {
    return {
      value: null,
      count: 0,
      aggregation,
    };
  }

  let value: number;

  switch (aggregation) {
    case 'sum':
      value = values.reduce((a, b) => a + b, 0);
      break;
    case 'min':
      value = Math.min(...values);
      break;
    case 'max':
      value = Math.max(...values);
      break;
    case 'avg':
      value = values.reduce((a, b) => a + b, 0) / values.length;
      break;
    default:
      return {
        value: null,
        count: values.length,
        aggregation,
        error: `Unknown aggregation: ${aggregation as string}`,
      };
  }

  return {
    value,
    count: values.length,
    aggregation,
  };
}
