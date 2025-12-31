import { clsx } from 'clsx';
import { StatusDistribution, STATUS_COLORS, STATUS_LABELS } from '../../utils/statusUtils';

interface ProgressBarProps {
  distribution: StatusDistribution[];
  height?: number | string;
  className?: string;
  showTooltip?: boolean;
}

export function ProgressBar({ distribution, height = '24px', className, showTooltip = true }: ProgressBarProps) {
  // If no distribution, show empty bar
  if (!distribution || distribution.length === 0) {
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
      {distribution.map((segment) => (
        <div
          key={segment.status}
          className="h-full transition-all duration-500 relative group border-r border-white/20 last:border-0"
          style={{ 
            width: `${segment.percentage}%`, 
            backgroundColor: segment.color 
          }}
        >
          {showTooltip && (
             <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-50 transition-opacity">
               <div className="font-semibold capitalize">{STATUS_LABELS[segment.status] || segment.status}</div>
               <div>{segment.count} items ({Math.round(segment.percentage)}%)</div>
             </div>
          )}
        </div>
      ))}
    </div>
  );
}
