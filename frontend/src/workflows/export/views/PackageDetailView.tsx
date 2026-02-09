/**
 * PackageDetailView
 *
 * Center content area showing details of the active export package.
 */

import { FileText, AlertCircle, CheckCircle2, Download } from 'lucide-react';

import type { ExportPackage } from '@autoart/shared';
import { useExportQueueStore } from '../../../stores/exportQueueStore';
import {
    useExportPackage,
    useDeleteExportPackage,
} from '../../../api/hooks/export-packages';
import { Text, Stack, Card, Button } from '@autoart/ui';
import { PackageHeader } from '../components/PackageHeader';
import { API_BASE } from '../../../api/client';

export function PackageDetailView() {
    const { activePackageId, setActivePackage } = useExportQueueStore();
    const { data: pkg, isLoading } = useExportPackage(activePackageId);
    const deletePackage = useDeleteExportPackage();

    const handleDelete = async () => {
        if (!activePackageId) return;
        await deletePackage.mutateAsync(activePackageId);
        setActivePackage(null);
    };

    if (!activePackageId) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <FileText size={32} className="mx-auto text-ws-muted mb-3" />
                    <Text size="sm" color="muted">Select a package from the queue</Text>
                </div>
            </div>
        );
    }

    if (isLoading || !pkg) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Text size="sm" color="muted">Loading...</Text>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-w-0">
            <PackageHeader pkg={pkg} onDelete={handleDelete} />

            <div className="flex-1 overflow-auto p-4">
                <PackageContent pkg={pkg} />
            </div>
        </div>
    );
}

function PackageContent({ pkg }: { pkg: ExportPackage }) {
    // Show content based on status
    if (pkg.status === 'failed') {
        return (
            <Card className="border-[var(--ws-color-error)]">
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle size={16} className="text-[var(--ws-color-error)] mt-0.5 shrink-0" />
                        <div>
                            <Text size="sm" weight="semibold">Export failed</Text>
                            <Text size="sm" color="muted" className="mt-1">
                                {pkg.error ?? 'Unknown error'}
                            </Text>
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    if (pkg.status === 'completed') {
        return (
            <Stack gap="md">
                <Card>
                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={16} className="text-[var(--ws-color-success)] mt-0.5 shrink-0" />
                            <div>
                                <Text size="sm" weight="semibold">Export completed</Text>
                                <Text size="xs" color="muted" className="mt-1">
                                    {pkg.format?.toUpperCase()} &middot; {new Date(pkg.executedAt ?? '').toLocaleString()}
                                </Text>
                            </div>
                        </div>
                        {pkg.exportSessionId && (
                            <div className="mt-3">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        window.open(`${API_BASE}/exports/sessions/${pkg.exportSessionId}/output?disposition=attachment`, '_blank');
                                    }}
                                >
                                    <Download size={14} className="mr-2" />
                                    Download
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </Stack>
        );
    }

    // Default: pending/configuring/ready — show source info
    const payload = pkg.sourcePayload as { projectIds?: string[] } | null;
    const projectCount = payload?.projectIds?.length ?? 0;

    return (
        <Stack gap="md">
            <Card>
                <div className="p-4">
                    <Text size="xs" weight="semibold" color="muted" className="uppercase mb-2">
                        Source
                    </Text>
                    <Text size="sm">
                        {pkg.sourceType === 'project_selection'
                            ? `${projectCount} project${projectCount !== 1 ? 's' : ''} selected`
                            : pkg.sourceType
                        }
                    </Text>
                </div>
            </Card>

            {pkg.format && (
                <Card>
                    <div className="p-4">
                        <Text size="xs" weight="semibold" color="muted" className="uppercase mb-2">
                            Format
                        </Text>
                        <Text size="sm">{pkg.format.toUpperCase()}</Text>
                    </div>
                </Card>
            )}

            {pkg.status === 'projecting' || pkg.status === 'executing' ? (
                <Card>
                    <div className="p-4 text-center">
                        <Text size="sm" color="muted">
                            {pkg.status === 'projecting' ? 'Generating projection...' : 'Executing export...'}
                        </Text>
                    </div>
                </Card>
            ) : null}
        </Stack>
    );
}
