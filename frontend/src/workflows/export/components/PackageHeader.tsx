/**
 * PackageHeader
 *
 * Header bar for the active package detail view.
 */

import { Package, Trash2 } from 'lucide-react';

import type { ExportPackage } from '@autoart/shared';
import { Badge, Text, Inline, IconButton } from '@autoart/ui';

interface PackageHeaderProps {
    pkg: ExportPackage;
    onDelete?: () => void;
}

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    pending: 'default',
    needs_resolution: 'warning',
    configuring: 'info',
    ready: 'info',
    projecting: 'info',
    executing: 'info',
    completed: 'success',
    failed: 'error',
};

export function PackageHeader({ pkg, onDelete }: PackageHeaderProps) {
    const variant = STATUS_VARIANT[pkg.status] ?? 'default';
    const sourceLabel = pkg.sourceType === 'project_selection' ? 'Project selection' : pkg.sourceType;

    return (
        <div className="px-4 py-3 border-b border-ws-panel-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
                <Package size={16} className="text-ws-muted shrink-0" />
                <div className="min-w-0">
                    <Text size="sm" weight="semibold" className="truncate block">
                        {pkg.label}
                    </Text>
                    <Inline gap="sm" className="mt-0.5">
                        <Badge variant={variant} size="sm">{pkg.status}</Badge>
                        <Text size="xs" color="muted">{sourceLabel}</Text>
                        <Text size="xs" color="muted">
                            {new Date(pkg.submittedAt).toLocaleDateString()}
                        </Text>
                    </Inline>
                </div>
            </div>
            {onDelete && (
                <IconButton
                    icon={Trash2}
                    size="sm"
                    variant="ghost"
                    label="Delete package"
                    onClick={onDelete}
                />
            )}
        </div>
    );
}
