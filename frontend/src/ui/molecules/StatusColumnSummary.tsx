/**
 * StatusColumnSummary - Progress bar widget for displaying status distribution
 *
 * Renders a horizontal stacked progress bar with proportional color blocks
 * for each status, with floating count labels.
 */

import { clsx } from 'clsx';

// ==================== TYPES ====================

export interface StatusCount {
    /** Status key/value */
    status: string;
    /** Count of items with this status */
    count: number;
}

export interface StatusColorConfig {
    /** CSS background color class for the segment */
    bgClass: string;
    /** CSS text color class (optional, for label) */
    textClass?: string;
}

export interface StatusColumnSummaryProps {
    /** Array of status counts to display */
    counts: StatusCount[];
    /** Status color configuration map */
    colorConfig?: Record<string, StatusColorConfig>;
    /** Show status label (defaults to false - just shows count) */
    showLabels?: boolean;
    /** Compact mode - smaller height */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

// Default status color configuration
const DEFAULT_STATUS_COLORS: Record<string, StatusColorConfig> = {
    'not-started': { bgClass: 'bg-slate-300', textClass: 'text-slate-700' },
    'in-progress': { bgClass: 'bg-blue-400', textClass: 'text-blue-900' },
    'blocked': { bgClass: 'bg-red-400', textClass: 'text-red-900' },
    'on-hold': { bgClass: 'bg-amber-400', textClass: 'text-amber-900' },
    'complete': { bgClass: 'bg-green-400', textClass: 'text-green-900' },
    'cancelled': { bgClass: 'bg-slate-400', textClass: 'text-slate-700' },
};

// ==================== COMPONENT ====================

export function StatusColumnSummary({
    counts,
    colorConfig = DEFAULT_STATUS_COLORS,
    showLabels = false,
    compact = false,
    className,
}: StatusColumnSummaryProps) {
    if (counts.length === 0) return null;

    // Filter out zero counts and calculate total
    const nonZeroCounts = counts.filter((c) => c.count > 0);
    if (nonZeroCounts.length === 0) return null;

    const total = nonZeroCounts.reduce((sum, c) => sum + c.count, 0);

    return (
        <div
            className={clsx(
                'flex items-center w-full overflow-hidden rounded',
                compact ? 'h-4' : 'h-5',
                className
            )}
        >
            {nonZeroCounts.map(({ status, count }) => {
                const colors = colorConfig[status] || { bgClass: 'bg-slate-400', textClass: 'text-slate-700' };
                const percentage = (count / total) * 100;

                // Only show segments that are at least 1% to avoid tiny slivers
                if (percentage < 1) return null;

                return (
                    <div
                        key={status}
                        className={clsx(
                            'relative flex items-center justify-center',
                            compact ? 'min-w-[16px]' : 'min-w-[20px]',
                            colors.bgClass
                        )}
                        style={{ width: `${percentage}%` }}
                        title={`${status}: ${count}`}
                    >
                        {/* Floating tally label */}
                        <span
                            className={clsx(
                                'font-semibold tabular-nums',
                                compact ? 'text-[9px]' : 'text-[10px]',
                                colors.textClass || 'text-white',
                                // Hide label if segment is too narrow
                                percentage < 15 && 'hidden'
                            )}
                        >
                            {showLabels ? `${status}: ` : ''}{count}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
