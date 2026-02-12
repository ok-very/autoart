import { useMemo } from 'react';
import { matchSorter, type MatchSorterOptions } from 'match-sorter';

export interface UseListFilterOptions<T> {
    keys: MatchSorterOptions<T>['keys'];
    sortFn?: (a: T, b: T) => number;
}

export function useListFilter<T>(
    items: T[],
    searchQuery: string,
    options: UseListFilterOptions<T>,
): T[] {
    const { keys, sortFn } = options;

    return useMemo(() => {
        const trimmed = searchQuery.trim();

        if (!trimmed) {
            return sortFn ? [...items].sort(sortFn) : items;
        }

        return matchSorter(items, trimmed, { keys });
    }, [items, searchQuery, keys, sortFn]);
}
