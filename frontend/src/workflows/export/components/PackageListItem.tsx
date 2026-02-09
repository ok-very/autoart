/**
 * PackageListItem
 *
 * Single package entry in the queue sidebar.
 */

import { clsx } from 'clsx';
import { Package } from 'lucide-react';

import type { ExportPackage } from '@autoart/shared';
import { Text } from '@autoart/ui';

interface PackageListItemProps {
    pkg: ExportPackage;
    isActive: boolean;
    onSelect: () => void;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'var(--ws-muted-fg)',
    needs_resolution: 'var(--ws-color-warning)',
    configuring: 'var(--ws-color-info)',
    ready: 'var(--ws-color-info)',
    projecting: 'var(--ws-color-info)',
    executing: 'var(--ws-color-info)',
    completed: 'var(--ws-color-success)',
    failed: 'var(--ws-color-error)',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    needs_resolution: 'Needs resolution',
    configuring: 'Configuring',
    ready: 'Ready',
    projecting: 'Projecting',
    executing: 'Executing',
    completed: 'Completed',
    failed: 'Failed',
};

export function PackageListItem({ pkg, isActive, onSelect }: PackageListItemProps) {
    const statusColor = STATUS_COLORS[pkg.status] ?? 'var(--ws-muted-fg)';
    const statusLabel = STATUS_LABELS[pkg.status] ?? pkg.status;

    return (
        <button
            className={clsx(
                'w-full px-3 py-2.5 text-left transition-colors',
                'hover:bg-[var(--ws-row-expanded-bg)]',
                isActive && 'bg-[var(--ws-row-expanded-bg)] border-l-2 border-l-[var(--ws-accent)]',
                !isActive && 'border-l-2 border-l-transparent',
            )}
            onClick={onSelect}
        >
            <div className="flex items-start gap-2">
                <Package size={14} className="mt-0.5 text-ws-muted shrink-0" />
                <div className="flex-1 min-w-0">
                    <Text size="sm" weight="medium" className="truncate block">
                        {pkg.label}
                    </Text>
                    <div className="flex items-center gap-2 mt-1">
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: statusColor }}
                        />
                        <Text size="xs" color="muted">{statusLabel}</Text>
                        {pkg.format && (
                            <>
                                <Text size="xs" color="muted">&middot;</Text>
                                <Text size="xs" color="muted">{pkg.format.toUpperCase()}</Text>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}
