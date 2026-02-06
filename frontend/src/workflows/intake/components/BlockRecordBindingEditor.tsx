/**
 * BlockRecordBindingEditor - Inline record binding config for form blocks
 *
 * Appears between block preview and footer when active.
 * Allows binding a block to a record definition field.
 */

import { useMemo } from 'react';
import { Link2, X } from 'lucide-react';
import { useRecordDefinitions, useRecordDefinition } from '../../../api/hooks/entities/definitions';
import type { BlockRecordBinding, FormBlock } from '@autoart/shared';

interface BlockRecordBindingEditorProps {
    blockId: string;
    binding: BlockRecordBinding | undefined;
    allBlocks: FormBlock[];
    onUpdate: (binding: BlockRecordBinding | undefined) => void;
}

export function BlockRecordBindingEditor({
    blockId,
    binding,
    allBlocks,
    onUpdate,
}: BlockRecordBindingEditorProps) {
    const { data: definitions } = useRecordDefinitions();
    const { data: selectedDef } = useRecordDefinition(binding?.definitionId ?? null);

    // Get fields from selected definition's schema_config
    const definitionFields = useMemo(() => {
        if (!selectedDef?.schema_config) return [];
        const config = typeof selectedDef.schema_config === 'string'
            ? JSON.parse(selectedDef.schema_config)
            : selectedDef.schema_config;
        return Array.isArray(config?.fields) ? config.fields : [];
    }, [selectedDef]);

    // Find sibling blocks in same group
    const groupSiblings = useMemo(() => {
        if (!binding?.groupKey) return [];
        return allBlocks.filter(
            (b) => b.id !== blockId && b.recordBinding?.groupKey === binding.groupKey
        );
    }, [allBlocks, blockId, binding?.groupKey]);

    // Unbound state: show add button
    if (!binding) {
        return (
            <button
                onClick={() => {
                    onUpdate({
                        mode: 'create',
                        definitionId: '',
                        fieldKey: '',
                    });
                }}
                className="flex items-center gap-2 text-xs text-ws-muted hover:text-[var(--ws-accent)] py-2 transition-colors"
            >
                <Link2 className="w-3 h-3" />
                Link to record field
            </button>
        );
    }

    // Bound state: show config
    return (
        <div className="mt-3 mb-1 p-3 border border-ws-panel-border rounded-lg bg-ws-bg space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ws-text-secondary flex items-center gap-1.5">
                    <Link2 className="w-3 h-3" />
                    Record Binding
                </span>
                <button
                    onClick={() => onUpdate(undefined)}
                    className="text-ws-muted hover:text-red-500 p-0.5"
                    title="Remove binding"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Definition select */}
                <div>
                    <label className="block text-[11px] text-ws-text-secondary mb-1">Definition</label>
                    <select
                        value={binding.definitionId}
                        onChange={(e) => {
                            const newDefId = e.target.value;
                            const newBinding: BlockRecordBinding = {
                                ...binding,
                                definitionId: newDefId,
                                fieldKey: '',
                            };
                            // Auto-assign group key if other blocks use same definition
                            if (newDefId) {
                                const existing = allBlocks.find(
                                    (b) => b.id !== blockId && b.recordBinding?.definitionId === newDefId
                                );
                                if (existing?.recordBinding?.groupKey) {
                                    newBinding.groupKey = existing.recordBinding.groupKey;
                                } else {
                                    newBinding.groupKey = `group-${newDefId.slice(0, 8)}`;
                                }
                            } else {
                                newBinding.groupKey = undefined;
                            }
                            onUpdate(newBinding);
                        }}
                        className="w-full px-2 py-1.5 border border-ws-panel-border rounded text-xs text-ws-fg bg-ws-panel-bg focus:outline-none focus:ring-1 focus:ring-[var(--ws-accent)]"
                    >
                        <option value="">Select...</option>
                        {definitions?.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                {/* Field select */}
                <div>
                    <label className="block text-[11px] text-ws-text-secondary mb-1">Field</label>
                    <select
                        value={binding.fieldKey}
                        onChange={(e) => onUpdate({ ...binding, fieldKey: e.target.value })}
                        disabled={!binding.definitionId}
                        className="w-full px-2 py-1.5 border border-ws-panel-border rounded text-xs text-ws-fg bg-ws-panel-bg focus:outline-none focus:ring-1 focus:ring-[var(--ws-accent)] disabled:opacity-50"
                    >
                        <option value="">Select...</option>
                        {definitionFields.map((f: { key: string; label: string }) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Mode */}
            <div className="flex items-center gap-4">
                <label className="block text-[11px] text-ws-text-secondary">Mode</label>
                <label className="flex items-center gap-1.5 text-xs">
                    <input
                        type="radio"
                        name={`mode-${blockId}`}
                        checked={binding.mode === 'create'}
                        onChange={() => onUpdate({ ...binding, mode: 'create', linkMatchField: undefined })}
                        className="text-[var(--ws-accent)]"
                    />
                    Create new
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                    <input
                        type="radio"
                        name={`mode-${blockId}`}
                        checked={binding.mode === 'link'}
                        onChange={() => onUpdate({ ...binding, mode: 'link' })}
                        className="text-[var(--ws-accent)]"
                    />
                    Link existing
                </label>
            </div>

            {/* Link match field (only for 'link' mode) */}
            {binding.mode === 'link' && (
                <div>
                    <label className="block text-[11px] text-ws-text-secondary mb-1">Match field</label>
                    <select
                        value={binding.linkMatchField ?? ''}
                        onChange={(e) => onUpdate({ ...binding, linkMatchField: e.target.value || undefined })}
                        disabled={!binding.definitionId}
                        className="w-full px-2 py-1.5 border border-ws-panel-border rounded text-xs text-ws-fg bg-ws-panel-bg focus:outline-none focus:ring-1 focus:ring-[var(--ws-accent)] disabled:opacity-50"
                    >
                        <option value="">Auto-match by...</option>
                        {definitionFields.map((f: { key: string; label: string }) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Group info */}
            {binding.groupKey && groupSiblings.length > 0 && (
                <div className="text-[11px] text-ws-text-secondary">
                    Group: {binding.groupKey}
                    <span className="ml-2 text-ws-muted">
                        with {groupSiblings.map(b => b.label).join(', ')}
                    </span>
                </div>
            )}
        </div>
    );
}
