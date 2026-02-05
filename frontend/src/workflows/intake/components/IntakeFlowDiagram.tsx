/**
 * IntakeFlowDiagram - Read-only flow visualization for the Logic tab
 *
 * Shows how form blocks map to record definitions, grouped by groupKey.
 * All configuration happens on the Build tab — this is confirmation only.
 */

import { useMemo } from 'react';
import { ArrowRight, Database, FileText } from 'lucide-react';
import { useRecordDefinitions } from '../../../api/hooks/entities/definitions';
import type { FormBlock } from '@autoart/shared';

interface IntakeFlowDiagramProps {
    blocks: FormBlock[];
    classificationNodeId: string | null;
}

interface BindingGroup {
    definitionId: string;
    definitionName: string;
    groupKey: string;
    mode: 'create' | 'link';
    fields: Array<{
        blockId: string;
        blockLabel: string;
        fieldKey: string;
    }>;
}

export function IntakeFlowDiagram({ blocks, classificationNodeId }: IntakeFlowDiagramProps) {
    const { data: definitions } = useRecordDefinitions();

    // Build a definitionId → name lookup
    const defNames = useMemo(() => {
        const map = new Map<string, string>();
        if (definitions) {
            for (const d of definitions) {
                map.set(d.id, d.name);
            }
        }
        return map;
    }, [definitions]);

    // Group bound blocks by (definitionId, groupKey)
    const groups = useMemo(() => {
        const groupMap = new Map<string, BindingGroup>();

        for (const block of blocks) {
            if (block.kind !== 'module' || !block.recordBinding) continue;
            const binding = block.recordBinding;
            if (!binding.definitionId || !binding.fieldKey) continue;

            const key = `${binding.definitionId}::${binding.groupKey ?? 'default'}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    definitionId: binding.definitionId,
                    definitionName: defNames.get(binding.definitionId) ?? binding.definitionId.slice(0, 8),
                    groupKey: binding.groupKey ?? 'default',
                    mode: binding.mode,
                    fields: [],
                });
            }
            groupMap.get(key)!.fields.push({
                blockId: block.id,
                blockLabel: block.label || 'Untitled',
                fieldKey: binding.fieldKey,
            });
        }

        return Array.from(groupMap.values());
    }, [blocks, defNames]);

    // Empty state
    if (groups.length === 0) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-ws-bg border border-ws-panel-border flex items-center justify-center mx-auto mb-4">
                    <Database className="w-5 h-5 text-ws-muted" />
                </div>
                <p className="text-sm text-ws-text-secondary">
                    No record bindings configured
                </p>
                <p className="text-xs text-ws-muted mt-1">
                    Bind blocks to record fields on the Build tab to see the data flow here.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
            {groups.map((group) => (
                <div
                    key={`${group.definitionId}::${group.groupKey}`}
                    className="bg-ws-panel-bg rounded-xl border border-ws-panel-border overflow-hidden"
                >
                    {/* Group header */}
                    <div className="px-5 py-3 border-b border-ws-panel-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-[var(--ws-accent)]" />
                            <span className="text-sm font-semibold text-ws-fg">
                                {group.definitionName}
                            </span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-ws-bg border border-ws-panel-border text-ws-text-secondary">
                            {group.mode === 'create' ? 'create' : 'link'}
                        </span>
                    </div>

                    {/* Field mappings */}
                    <div className="p-4 space-y-2">
                        {group.fields.map((field) => (
                            <div
                                key={field.blockId}
                                className="flex items-center gap-3 text-sm"
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileText className="w-3.5 h-3.5 text-ws-muted shrink-0" />
                                    <span className="text-ws-fg truncate">
                                        {field.blockLabel}
                                    </span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-ws-muted shrink-0" />
                                <span className="text-xs font-mono text-ws-text-secondary">
                                    {field.fieldKey}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Context footer */}
            {classificationNodeId && (
                <div className="text-xs text-ws-muted text-center pt-2">
                    Context: {classificationNodeId.slice(0, 8)}...
                </div>
            )}
        </div>
    );
}
