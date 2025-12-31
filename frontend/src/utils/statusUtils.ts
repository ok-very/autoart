export type StatusKey = 'done' | 'working' | 'stuck' | 'empty' | string;

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export const STATUS_COLORS: Record<string, string> = {
  done: '#00c875',
  working: '#fdab3d',
  stuck: '#e2445c',
  empty: '#c4c4c4',
  default: '#c4c4c4'
};

export const STATUS_LABELS: Record<string, string> = {
  done: 'Done',
  working: 'Working',
  stuck: 'Stuck',
  empty: ''
};

/**
 * Calculates the percentage distribution of statuses.
 * @param items Array of items to analyze
 * @param statusAccessor Function to extract status from an item (should return 'done', 'working', 'stuck', etc.)
 */
export function calculateStatusDistribution<T>(
  items: T[],
  statusAccessor: (item: T) => string
): StatusDistribution[] {
  if (!items.length) return [];

  const counts: Record<string, number> = {
    done: 0,
    working: 0,
    stuck: 0,
    empty: 0
  };

  // specific order for the bar segments
  const displayOrder = ['done', 'working', 'stuck', 'empty'];
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
