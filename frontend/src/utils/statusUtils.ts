export type StatusKey = 'empty' | 'not-started' | 'in-progress' | 'blocked' | 'review' | 'done' | string;

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export const STATUS_COLORS: Record<string, string> = {
  empty: '#cbd5e1',
  'not-started': '#94a3b8',
  'in-progress': '#f59e0b',
  blocked: '#ef4444',
  review: '#a855f7',
  done: '#10b981',
  default: '#c4c4c4'
};

export const STATUS_LABELS: Record<string, string> = {
  empty: '',
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  review: 'Review',
  done: 'Done'
};

/**
 * Calculates the percentage distribution of statuses.
 * @param items Array of items to analyze
 * @param statusAccessor Function to extract status from an item (should return 'done', 'in-progress', 'blocked', etc.)
 */
export function calculateStatusDistribution<T>(
  items: T[],
  statusAccessor: (item: T) => string
): StatusDistribution[] {
  if (!items.length) return [];

  const counts: Record<string, number> = {
    done: 0,
    review: 0,
    blocked: 0,
    'in-progress': 0,
    'not-started': 0,
    empty: 0
  };

  // specific order for the bar segments
  const displayOrder = ['done', 'review', 'blocked', 'in-progress', 'not-started', 'empty'];
  const otherStatuses: string[] = [];

  items.forEach(item => {
    const rawStatus = statusAccessor(item);
    const status = rawStatus ? rawStatus.toLowerCase() : 'empty';

    if (displayOrder.includes(status)) {
      counts[status] = (counts[status] || 0) + 1;
    } else {
      if (!otherStatuses.includes(status)) otherStatuses.push(status);
      counts[status] = (counts[status] || 0) + 1;
    }
  });

  const total = items.length;
  const result: StatusDistribution[] = [];

  // Add standard statuses in order
  displayOrder.forEach(status => {
    if (counts[status] > 0) {
      result.push({
        status,
        count: counts[status],
        percentage: (counts[status] / total) * 100,
        color: STATUS_COLORS[status] || STATUS_COLORS.default
      });
    }
  });

  // Add any other custom statuses found
  otherStatuses.forEach(status => {
    result.push({
      status,
      count: counts[status],
      percentage: (counts[status] / total) * 100,
      color: STATUS_COLORS.default
    });
  });

  return result;
}
