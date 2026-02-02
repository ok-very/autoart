/**
 * ReferenceStatusBadge - Display reference status with appropriate styling
 *
 * Shows one of four reference states:
 * - dynamic: Live value from source (green)
 * - static: Fixed snapshot value (orange)
 * - broken: Target no longer exists (red)
 * - unresolved: Target not yet determined (gray)
 *
 * @module ui/molecules
 */

import { clsx } from 'clsx';
import { Link2, Unlink, AlertTriangle, HelpCircle } from 'lucide-react';

import type { ReferenceStatus } from '../../types';

export interface ReferenceStatusBadgeProps {
    /** The reference status to display */
    status: ReferenceStatus;
    /** Whether to show the icon */
    showIcon?: boolean;
    /** Whether to show the label text */
    showLabel?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Tooltip text (overrides default) */
    tooltip?: string;
}

const STATUS_CONFIG: Record<ReferenceStatus, {
    label: string;
    icon: typeof Link2;
    bgClass: string;
    textClass: string;
    iconClass: string;
    defaultTooltip: string;
}> = {
    dynamic: {
        label: 'Dynamic',
        icon: Link2,
        bgClass: 'bg-blue-100',
        textClass: 'text-blue-700',
        iconClass: 'text-blue-500',
        defaultTooltip: 'Value updates automatically with source',
    },
    static: {
        label: 'Static',
        icon: Unlink,
        bgClass: 'bg-orange-100',
        textClass: 'text-orange-700',
        iconClass: 'text-orange-500',
        defaultTooltip: 'Value is a fixed snapshot',
    },
    broken: {
        label: 'Broken',
        icon: AlertTriangle,
        bgClass: 'bg-red-100',
        textClass: 'text-red-700',
        iconClass: 'text-red-500',
        defaultTooltip: 'Source record no longer exists',
    },
    unresolved: {
        label: 'Unresolved',
        icon: HelpCircle,
        bgClass: 'bg-slate-200',
        textClass: 'text-ws-text-secondary',
        iconClass: 'text-ws-muted',
        defaultTooltip: 'Reference target not yet determined',
    },
};

export function ReferenceStatusBadge({
    status,
    showIcon = true,
    showLabel = true,
    className,
    tooltip,
}: ReferenceStatusBadgeProps) {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0',
                config.bgClass,
                config.textClass,
                className
            )}
            title={tooltip ?? config.defaultTooltip}
        >
            {showIcon && <Icon size={10} className={config.iconClass} />}
            {showLabel && config.label}
        </span>
    );
}

/**
 * Convenience function to get badge color class by status
 */
export function getStatusBgClass(status: ReferenceStatus): string {
    return STATUS_CONFIG[status].bgClass;
}

/**
 * Convenience function to get text color class by status
 */
export function getStatusTextClass(status: ReferenceStatus): string {
    return STATUS_CONFIG[status].textClass;
}
