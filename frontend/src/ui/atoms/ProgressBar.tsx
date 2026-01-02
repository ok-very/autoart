import { clsx } from 'clsx';

/**
 * Segment data for ProgressBar - pure data, no domain knowledge
 */
export interface ProgressSegment {
    /** Unique key for the segment */
    key: string;
    /** Percentage width (0-100) */
    percentage: number;
    /** CSS color value */
    color: string;
    /** Display label for tooltip */
    label: string;
    /** Count of items in this segment */
    count: number;
}

interface ProgressBarProps {
    /** Array of segments to display */
    segments: ProgressSegment[];
    /** Height of the bar */
    height?: number | string;
    /** Additional className */
    className?: string;
    /** Whether to show tooltips on hover */
    showTooltip?: boolean;
}

/**
 * ProgressBar - Pure presentational component
 * 
 * Displays a segmented progress bar. Receives pre-computed segments
 * with colors and percentages - no domain logic here.
 */
export function ProgressBar({
    segments,
    height = '24px',
    className,
    showTooltip = true
}: ProgressBarProps) {
    // If no segments, show empty bar
    if (!segments || segments.length === 0) {
        return (
            <div
                className={clsx("w-full bg-slate-200 rounded overflow-hidden", className)}
                style={{ height }}
            />
        );
    }

    return (
        <div
            className={clsx("flex rounded overflow-hidden shadow-sm bg-slate-200 w-full", className)}
            style={{ height }}
        >
            {segments.map((segment) => (
                <div
                    key={segment.key}
                    className="h-full transition-all duration-500 relative group border-r border-white/20 last:border-0"
                    style={{
                        width: `${segment.percentage}%`,
                        backgroundColor: segment.color
                    }}
                >
                    {showTooltip && (
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-50 transition-opacity">
                            <div className="font-semibold capitalize">{segment.label}</div>
                            <div>{segment.count} items ({Math.round(segment.percentage)}%)</div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
