/**
 * ExportQueuePanel
 *
 * Left sidebar showing the export package queue.
 * Status filter + package list + add button.
 */

import { Package } from 'lucide-react';

import { useExportQueueStore } from '../../../stores/exportQueueStore';
import {
    useExportPackages,
} from '../../../api/hooks/export-packages';
import { Text, SegmentedControl } from '@autoart/ui';
import { PackageListItem } from '../components/PackageListItem';
import { AddPackageMenu } from '../components/AddPackageMenu';

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'ready', label: 'Ready' },
    { value: 'completed', label: 'Done' },
    { value: 'failed', label: 'Failed' },
] as const;

export function ExportQueuePanel() {
    const { activePackageId, filterStatus, setActivePackage, setFilterStatus } = useExportQueueStore();

    const filter = filterStatus === 'all' ? undefined : { status: filterStatus };
    const { data: packages, isLoading } = useExportPackages(filter);

    return (
        <div className="flex flex-col h-full bg-ws-panel-bg">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-ws-panel-border">
                <div className="flex items-center gap-2 mb-2">
                    <Package size={14} className="text-ws-muted" />
                    <Text size="sm" weight="semibold">Export Queue</Text>
                    {packages && packages.length > 0 && (
                        <Text size="xs" color="muted">({packages.length})</Text>
                    )}
                </div>
                <SegmentedControl
                    value={filterStatus}
                    onChange={(v) => setFilterStatus(v as typeof filterStatus)}
                    data={STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
                    size="xs"
                />
            </div>

            {/* Package List */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="p-4 text-center">
                        <Text size="xs" color="muted">Loading...</Text>
                    </div>
                ) : !packages || packages.length === 0 ? (
                    <div className="p-6 text-center">
                        <Text size="xs" color="muted">No packages in queue</Text>
                    </div>
                ) : (
                    packages.map((pkg) => (
                        <PackageListItem
                            key={pkg.id}
                            pkg={pkg}
                            isActive={activePackageId === pkg.id}
                            onSelect={() => setActivePackage(pkg.id)}
                        />
                    ))
                )}
            </div>

            {/* Add Package */}
            <AddPackageMenu />
        </div>
    );
}
