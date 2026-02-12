/**
 * filterFunctions - Registry mapping field types to TanStack Table filter functions
 *
 * Provides type-specific filter implementations for use with TanStack Table's
 * column filter system. Import and assign to column definitions via `filterFn`.
 */

import { type FilterFn } from '@tanstack/react-table';
import { rankItem } from '@tanstack/match-sorter-utils';

/**
 * Fuzzy text filter using match-sorter ranking
 * Best for text fields where partial/fuzzy matching is desired
 */
export const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
    const itemRank = rankItem(row.getValue(columnId), value);
    addMeta({ itemRank });
    return itemRank.passed;
};

/**
 * Exact match for enum/status columns
 * Use for dropdowns where value must match exactly
 */
export const exactFilter: FilterFn<any> = (row, columnId, value) => {
    return row.getValue(columnId) === value;
};

/**
 * Set inclusion for multi-select filters
 * Value is an array of allowed values; row passes if its value is in the array
 */
export const includesFilter: FilterFn<any> = (row, columnId, value: string[]) => {
    const cellValue = row.getValue(columnId) as string;
    return value.includes(cellValue);
};

/**
 * Date range filter
 * Value is a tuple [startDate | null, endDate | null]
 * Row passes if its date falls within the range (inclusive)
 */
export const dateRangeFilter: FilterFn<any> = (row, columnId, value: [Date | null, Date | null]) => {
    const cellValue = row.getValue(columnId);
    if (!cellValue) return false;

    const cellDate = new Date(cellValue as string);
    const [start, end] = value;

    if (start && cellDate < start) return false;
    if (end && cellDate > end) return false;

    return true;
};
