/**
 * ReferenceBlock - Molecule for displaying a resolved reference/link
 * 
 * This is a pure molecule that:
 * - Accepts pre-resolved reference data (no API calls)
 * - Displays the linked record with status indicators
 * - Provides action callbacks for clicks
 * 
 * @example
 * ```tsx
 * <ReferenceBlock
 *   value="Project Alpha"
 *   label="Project Alpha"
 *   mode="dynamic"
 *   drift={false}
 *   onOpen={() => openRecord(id)}
 *   onClear={!readOnly ? () => clearLink() : undefined}
 * />
 * ```
 */

import { clsx } from 'clsx';
import { Link2, ExternalLink, X, RefreshCw, AlertCircle, Link2Off } from 'lucide-react';

export type ReferenceStatus = 'resolved' | 'loading' | 'broken' | 'empty';
export type ReferenceMode = 'dynamic' | 'static' | 'direct';

export interface ReferenceBlockProps {
    /** Current status of the reference */
    status: ReferenceStatus;
    /** Display value for the linked record */
    value?: string;
    /** Fallback label if value is empty */
    label?: string;
    /** Resolution mode (dynamic/static/direct) */
    mode?: ReferenceMode;
    /** Whether the reference has drifted from its snapshot */
    drift?: boolean;
    /** Reason for broken status */
    brokenReason?: string;
    /** Callback when clicking the reference to open it */
    onOpen?: () => void;
    /** Callback when clearing/removing the reference (omit for read-only) */
    onClear?: () => void;
    /** Whether the clear action is in progress */
    clearing?: boolean;
    /** CSS class override */
    className?: string;
}

/**
 * ReferenceBlock - Displays a linked record reference with status
 */
export function ReferenceBlock({
    status,
    value,
    label,
    mode = 'dynamic',
    drift = false,
    brokenReason,
    onOpen,
    onClear,
    clearing = false,
    className,
}: ReferenceBlockProps) {
    // Empty state
    if (status === 'empty') {
        return (
            <div
                className={clsx(
                    'flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-slate-300 rounded-md text-slate-400',
                    className
                )}
            >
                <Link2 size={14} />
                <span>No link</span>
            </div>
        );
    }

    // Loading state
    if (status === 'loading') {
        return (
            <div
                className={clsx(
                    'flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-50',
                    className
                )}
            >
                <RefreshCw size={14} className="animate-spin text-slate-400" />
                <span className="text-slate-400">Loading...</span>
            </div>
        );
    }

    // Broken state
    if (status === 'broken') {
        return (
            <div
                className={clsx(
                    'group flex items-center gap-2 px-3 py-2 text-sm border border-red-300 rounded-md bg-red-50',
                    className
                )}
                title={brokenReason || 'Reference is broken'}
            >
                <Link2Off size={14} className="text-red-500 shrink-0" />
                <span className="flex-1 text-red-700 truncate">
                    {brokenReason || 'Broken reference'}
                </span>
                <AlertCircle size={14} className="text-red-500 shrink-0" />

                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        disabled={clearing}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Remove broken link"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        );
    }

    // Resolved state - show the linked record
    const displayValue = value !== undefined && value !== null && value !== ''
        ? value
        : label || 'Unknown';

    return (
        <div
            className={clsx(
                'group flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors',
                drift
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-blue-200 bg-blue-50',
                className
            )}
        >
            <Link2 size={14} className="text-blue-500 shrink-0" />

            {/* Clickable value that opens record */}
            <button
                type="button"
                onClick={onOpen}
                disabled={!onOpen}
                className={clsx(
                    'flex-1 text-left truncate font-medium',
                    onOpen
                        ? 'text-blue-700 hover:text-blue-900 hover:underline'
                        : 'text-blue-700 cursor-default'
                )}
                title={onOpen ? `Open ${displayValue}` : undefined}
            >
                {displayValue}
            </button>

            {/* Mode indicator */}
            <span
                className={clsx(
                    'text-[10px] font-medium uppercase px-1.5 py-0.5 rounded shrink-0',
                    mode === 'static'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                )}
            >
                {mode}
            </span>

            {/* Drift indicator */}
            {drift && (
                <span
                    className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 shrink-0"
                    title="Value has changed from snapshot"
                >
                    Drift
                </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {onOpen && (
                    <button
                        type="button"
                        onClick={onOpen}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Open record"
                    >
                        <ExternalLink size={12} />
                    </button>
                )}

                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        disabled={clearing}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                        title="Remove link"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}
