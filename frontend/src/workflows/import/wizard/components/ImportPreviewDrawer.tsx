import { useMemo } from 'react';
import { X, ArrowRight, LayoutTemplate } from 'lucide-react';
import { DataFieldWidget, DataFieldKind } from '../../../../ui/molecules/DataFieldWidget';
import { Button } from '@autoart/ui';
import { Card } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { MondayColumnConfig, MondayColumnSemanticRole } from '../../../../api/types/monday';

interface ImportPreviewOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    columns: MondayColumnConfig[];
    sampleItem?: Record<string, any>; // Map of columnId -> value
    itemTitle?: string;
    boardName: string;
}

export function ImportPreviewDrawer({
    isOpen,
    onClose,
    columns,
    sampleItem,
    itemTitle = "Sample Item Name",
    boardName,
}: ImportPreviewOverlayProps) {
    // Filter relevant mapped columns
    const mappedColumns = useMemo(() => {
        return columns.filter(c => c.semanticRole !== 'ignore' && c.semanticRole !== 'custom');
    }, [columns]);

    if (!isOpen) return null;

    // Helper to determine widget kind from semantic role
    const getFieldKind = (role: MondayColumnSemanticRole): DataFieldKind => {
        switch (role) {
            case 'status': return 'status';
            case 'due_date': return 'date';
            case 'assignee': return 'user';
            case 'tags': return 'tags';
            case 'description': return 'description';
            case 'estimate': return 'text'; // or number
            case 'priority': return 'status';
            default: return 'text';
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 w-[500px] bg-ws-panel-bg shadow-2xl transform transition-transform duration-300 z-50 flex flex-col border-l border-ws-panel-border">
            {/* Header */}
            <div className="px-6 py-4 border-b border-ws-panel-border flex items-center justify-between bg-ws-bg/50">
                <div>
                    <Text size="lg" weight="bold" className="text-ws-fg">Import Preview</Text>
                    <div className="flex items-center gap-2 text-xs text-ws-text-secondary mt-1">
                        <LayoutTemplate size={12} />
                        <span>{boardName}</span>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    <X size={16} />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-ws-bg/30">
                <Stack gap="lg">
                    {/* Transformation Logic Hint */}
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700 flex gap-2">
                        <ArrowRight size={14} className="mt-0.5 shrink-0" />
                        <div>
                            This preview shows how <strong>{mappedColumns.length} mapped fields</strong> will be transformed.
                            Unmapped columns will be ignored.
                        </div>
                    </div>

                    {/* Card Preview */}
                    <div className="space-y-2">
                        <Text size="xs" weight="medium" className="text-ws-text-secondary uppercase tracking-wider pl-1">
                            Resulting Record
                        </Text>

                        <Card className="overflow-hidden border-ws-panel-border shadow-sm">
                            {/* Card Header (Title) */}
                            <div className="px-4 py-3 border-b border-ws-panel-border bg-ws-panel-bg">
                                <Text size="md" weight="medium" className="text-ws-fg">
                                    {itemTitle}
                                </Text>
                            </div>

                            {/* Card Body (Fields) */}
                            <div className="p-4 space-y-4 bg-ws-panel-bg">
                                {mappedColumns.length === 0 ? (
                                    <div className="text-center py-8 text-ws-muted text-sm italic">
                                        No columns mapped yet.
                                    </div>
                                ) : (
                                    mappedColumns.map(col => {
                                        const kind = getFieldKind(col.semanticRole);
                                        const rawValue = sampleItem ? sampleItem[col.columnId] : "Sample Value";

                                        return (
                                            <div key={col.columnId} className="grid grid-cols-[120px_1fr] gap-4 items-start">
                                                <div className="pt-0.5">
                                                    <div className="text-xs font-medium text-ws-text-secondary truncate" title={col.semanticRole}>
                                                        {col.semanticRole.replace(/_/g, ' ')}
                                                    </div>
                                                    <div className="text-[10px] text-ws-muted truncate mt-0.5" title={col.columnTitle}>
                                                        from: {col.columnTitle}
                                                    </div>
                                                </div>

                                                <DataFieldWidget
                                                    kind={kind}
                                                    value={rawValue}
                                                    className="w-full"
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Raw Data Debug (optional, collapsible) */}
                    <div className="pt-4 border-t border-ws-panel-border">
                        <Text size="xs" className="text-ws-muted mb-2">Detailed Mapping Config</Text>
                        <div className="text-[10px] font-mono bg-slate-100 p-2 rounded text-ws-text-secondary overflow-x-auto">
                            {mappedColumns.map(c => (
                                <div key={c.columnId} className="flex gap-2">
                                    <span className="text-purple-600">{c.columnTitle}</span>
                                    <span className="text-ws-muted">→</span>
                                    <span className="text-blue-600">{c.semanticRole}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Stack>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-ws-panel-border bg-ws-panel-bg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <Button className="w-full" onClick={onClose}>
                    Close Preview
                </Button>
            </div>
        </div>
    );
}
