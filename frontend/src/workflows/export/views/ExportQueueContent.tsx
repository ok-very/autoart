/**
 * ExportQueueContent
 *
 * Top-level wrapper: queue panel (left) + detail view (center) + inspector (right).
 */

import { Download, Settings, Loader2 } from 'lucide-react';

import type { ExportFormat, ExportOptions } from '../types';
import { EXPORT_FORMATS } from '../types';
import { DEFAULT_EXPORT_OPTIONS } from '@autoart/shared';
import { useExportQueueStore } from '../../../stores/exportQueueStore';
import {
    useExportPackage,
    useUpdateExportPackage,
    useExecutePackageExport,
} from '../../../api/hooks/export-packages';
import { Text, Stack, Inline, Checkbox, Button, Select } from '@autoart/ui';

import { ExportQueuePanel } from '../panels/ExportQueuePanel';
import { PackageDetailView } from './PackageDetailView';

export function ExportQueueContent() {
    const { activePackageId } = useExportQueueStore();
    const { data: activePkg } = useExportPackage(activePackageId);
    const updatePackage = useUpdateExportPackage();
    const executeExport = useExecutePackageExport();

    const format = activePkg?.format ?? 'rtf';
    const options = activePkg?.options ?? DEFAULT_EXPORT_OPTIONS;

    const handleFormatChange = (newFormat: string) => {
        if (!activePackageId) return;
        updatePackage.mutate({ id: activePackageId, updates: { format: newFormat as ExportFormat } });
    };

    const handleOptionChange = (key: keyof ExportOptions, value: boolean) => {
        if (!activePackageId) return;
        updatePackage.mutate({
            id: activePackageId,
            updates: { options: { ...options, [key]: value } },
        });
    };

    const handleExecute = () => {
        if (!activePackageId) return;
        executeExport.mutate(activePackageId);
    };

    const canExecute = activePkg && ['pending', 'configuring', 'ready'].includes(activePkg.status);
    const isExecuting = executeExport.isPending;

    return (
        <div className="flex h-full">
            {/* Left: Queue Panel */}
            <div className="w-64 shrink-0 border-r border-ws-panel-border">
                <ExportQueuePanel />
            </div>

            {/* Center: Detail View */}
            <PackageDetailView />

            {/* Right: Inspector */}
            {activePackageId && activePkg && (
                <aside className="w-64 shrink-0 border-l border-ws-panel-border bg-ws-panel-bg flex flex-col">
                    {/* Header */}
                    <div className="h-10 border-b border-ws-panel-border flex items-center px-3">
                        <Inline gap="sm">
                            <Settings className="w-4 h-4 text-ws-muted" />
                            <Text size="sm" weight="semibold">Options</Text>
                        </Inline>
                    </div>

                    {/* Options */}
                    <div className="flex-1 overflow-auto p-4">
                        <Stack gap="md">
                            {/* Format Selector */}
                            <div>
                                <Text size="xs" weight="semibold" color="muted" className="uppercase mb-2">
                                    Format
                                </Text>
                                <Select
                                    value={format}
                                    onChange={(v) => v && handleFormatChange(v)}
                                    data={EXPORT_FORMATS.map((f) => ({
                                        value: f.id,
                                        label: f.label,
                                    }))}
                                />
                            </div>

                            {/* Include Sections */}
                            <div className="pt-4 border-t border-ws-panel-border">
                                <Text size="xs" weight="semibold" color="muted" className="uppercase mb-3">
                                    Include
                                </Text>
                                <Stack gap="sm">
                                    <Checkbox
                                        label="Contacts"
                                        checked={options.includeContacts}
                                        onChange={(checked) => handleOptionChange('includeContacts', checked)}
                                    />
                                    <Checkbox
                                        label="Budgets"
                                        checked={options.includeBudgets}
                                        onChange={(checked) => handleOptionChange('includeBudgets', checked)}
                                    />
                                    <Checkbox
                                        label="Milestones"
                                        checked={options.includeMilestones}
                                        onChange={(checked) => handleOptionChange('includeMilestones', checked)}
                                    />
                                    <Checkbox
                                        label="Selection panel"
                                        checked={options.includeSelectionPanel}
                                        onChange={(checked) => handleOptionChange('includeSelectionPanel', checked)}
                                    />
                                    <Checkbox
                                        label="Status notes"
                                        checked={options.includeStatusNotes}
                                        onChange={(checked) => handleOptionChange('includeStatusNotes', checked)}
                                    />
                                </Stack>
                            </div>

                            {/* Next Steps */}
                            <div className="pt-4 border-t border-ws-panel-border">
                                <Text size="xs" weight="semibold" color="muted" className="uppercase mb-3">
                                    Next Steps
                                </Text>
                                <Checkbox
                                    label="Only open items"
                                    checked={options.includeOnlyOpenNextSteps}
                                    onChange={(checked) => handleOptionChange('includeOnlyOpenNextSteps', checked)}
                                />
                            </div>
                        </Stack>
                    </div>

                    {/* Execute Button */}
                    <div className="p-4 border-t border-ws-panel-border bg-ws-bg">
                        {executeExport.error && (
                            <div className="mb-3 px-3 py-2 rounded-lg"
                                style={{ backgroundColor: 'rgba(140, 74, 74, 0.08)', border: '1px solid var(--ws-color-error)' }}>
                                <Text size="xs" style={{ color: 'var(--ws-color-error)' }}>
                                    {executeExport.error instanceof Error ? executeExport.error.message : 'Export failed'}
                                </Text>
                            </div>
                        )}

                        <Button
                            variant="primary"
                            className="w-full"
                            disabled={!canExecute || isExecuting}
                            onClick={handleExecute}
                        >
                            {isExecuting ? (
                                <>
                                    <Loader2 size={16} className="mr-2 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download size={16} className="mr-2" />
                                    Execute Export
                                </>
                            )}
                        </Button>
                    </div>
                </aside>
            )}
        </div>
    );
}
