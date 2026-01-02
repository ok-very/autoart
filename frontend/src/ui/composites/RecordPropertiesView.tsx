/**
 * RecordPropertiesView - Composite for viewing/editing record properties
 * 
 * This composite:
 * - Uses domain hooks to build FieldViewModels
 * - Passes view models to FieldRenderer molecules
 * - Handles API mutations for field updates
 * - Provides callbacks for complex field types
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import {
    useNode,
    useRecordDefinitions,
    useUpdateNode,
    useUpdateRecord,
    useDeleteRecord,
} from '../../api/hooks';
import { RichTextEditor } from '../../components/editor/RichTextEditor';
import { FieldRenderer, type FieldRendererCallbacks } from '../molecules/FieldRenderer';
import { LinkFieldInput } from './LinkFieldInput';
import { UserMentionInput } from './UserMentionInput';
import { useRecordFieldViewModels } from './hooks/useDomain';
import type { FieldViewModel } from '@autoart/shared/domain';
import type { NodeType, FieldDef, HierarchyNode } from '../../types';
import { parseTaskMetadata } from '../../utils/nodeMetadata';

interface RecordPropertiesViewProps {
    itemId: string;
    isNode: boolean;
}

/**
 * RecordPropertiesView - Displays and edits record/node properties
 *
 * For records: Uses domain hooks to build FieldViewModels
 * For nodes: Uses legacy field building (to be migrated)
 */
export function RecordPropertiesView({ itemId, isNode }: RecordPropertiesViewProps) {
    const { clearInspection, openDrawer } = useUIStore();
    const { data: node } = useNode(isNode ? itemId : null);
    const updateNode = useUpdateNode();
    const updateRecord = useUpdateRecord();
    const deleteRecord = useDeleteRecord();
    const { data: definitions } = useRecordDefinitions();

    // For records: use domain hook
    const {
        visibleViewModels,
        record,
        isLoading: recordLoading,
    } = useRecordFieldViewModels(!isNode ? itemId : null);

    const descriptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fieldTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const [editedFields, setEditedFields] = useState<Record<string, unknown>>({});

    // Determine which item we're working with
    const item = isNode ? node : record;
    if (!item && !recordLoading) return null;
    if (!item) return <div className="p-4 text-slate-400">Loading...</div>;

    const nodeType = isNode ? (item as { type: NodeType }).type : 'record';
    const title = isNode
        ? (item as { title: string }).title
        : (item as { unique_name: string }).unique_name;

    // Node-specific data extraction
    const rawMetadata = isNode
        ? ((item as { metadata?: Record<string, unknown> | string }).metadata || {})
        : {};
    const metadata: Record<string, unknown> =
        typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;

    const data = !isNode ? ((item as { data?: Record<string, unknown> }).data || {}) : {};
    const description = isNode ? (item as { description?: unknown }).description : null;

    const definitionId = !isNode
        ? (item as { definition_id: string }).definition_id
        : (item as unknown as HierarchyNode).default_record_def_id;

    // Keep refs for debounced saves
    const latestMetadataRef = useRef<Record<string, unknown>>({});
    const latestDataRef = useRef<Record<string, unknown>>({});
    useEffect(() => {
        latestMetadataRef.current = metadata;
    }, [metadata]);
    useEffect(() => {
        latestDataRef.current = data;
    }, [data]);

    // Find definition for node-specific logic
    const definition = definitions?.find((d) => {
        if (definitionId) return d.id === definitionId;
        if (isNode) {
            const type = (item as { type: string }).type;
            const typeName = type.charAt(0).toUpperCase() + type.slice(1);
            return d.name === typeName;
        }
        return false;
    }) || null;

    // Build legacy fields for nodes (will be migrated to domain later)
    let nodeFields: { key: string; value: unknown; def?: FieldDef }[] = [];

    if (isNode && nodeType === 'task') {
        const taskMeta = parseTaskMetadata(metadata);

        // Get Task definition fields from database (system definition)
        const taskDefinition = definitions?.find((d) => d.name === 'Task');
        const taskFieldDefs: FieldDef[] = taskDefinition?.schema_config?.fields
            ?.filter((f) => f.key !== 'title' && f.key !== 'description')
            ?.map((f) => ({
                key: f.key,
                type: f.type,
                label: f.label,
                required: f.required,
                options: f.options,
            })) || [];

        nodeFields = taskFieldDefs.map((fieldDef) => ({
            key: fieldDef.key,
            value: metadata[fieldDef.key] ?? taskMeta[fieldDef.key as keyof typeof taskMeta],
            def: fieldDef,
        }));

        Object.entries(metadata).forEach(([key, value]) => {
            if (key === 'percentComplete') return;
            if (!nodeFields.find((f) => f.key === key)) {
                nodeFields.push({ key, value, def: undefined });
            }
        });
    } else if (isNode && definition?.schema_config?.fields) {
        nodeFields = definition.schema_config.fields.map((fieldDef) => ({
            key: fieldDef.key,
            value: metadata[fieldDef.key],
            def: fieldDef,
        }));
    } else if (isNode) {
        nodeFields = Object.entries(metadata).map(([key, value]) => ({
            key,
            value,
            def: undefined,
        }));
    }

    const bgColor = {
        project: 'bg-blue-50 border-blue-100 text-blue-900',
        process: 'bg-purple-50 border-purple-100 text-purple-900',
        stage: 'bg-slate-50 border-slate-100 text-slate-900',
        subprocess: 'bg-orange-50 border-orange-100 text-orange-900',
        task: 'bg-green-50 border-green-100 text-green-900',
        subtask: 'bg-teal-50 border-teal-100 text-teal-900',
        record: 'bg-slate-50 border-slate-100 text-slate-900',
    }[nodeType];

    const handleDescriptionChange = (newContent: unknown) => {
        if (descriptionTimerRef.current) {
            clearTimeout(descriptionTimerRef.current);
        }

        descriptionTimerRef.current = setTimeout(() => {
            if (isNode) {
                updateNode.mutate({ id: item.id, description: newContent });
            }
        }, 1000);
    };

    const handleFieldChange = useCallback((key: string, value: unknown) => {
        setEditedFields((prev) => ({ ...prev, [key]: value }));

        if (fieldTimerRef.current[key]) {
            clearTimeout(fieldTimerRef.current[key]);
        }

        fieldTimerRef.current[key] = setTimeout(() => {
            if (isNode) {
                updateNode.mutate({
                    id: item.id,
                    metadata: { ...latestMetadataRef.current, [key]: value },
                });
            } else {
                updateRecord.mutate({
                    id: item.id,
                    data: { ...latestDataRef.current, [key]: value },
                });
            }
        }, 1000);
    }, [isNode, item.id, updateNode, updateRecord]);

    const confirmDeleteRecord = () => {
        openDrawer('confirm-delete', {
            title: 'Delete Record',
            message:
                'Are you sure you want to delete this record? This action cannot be undone and will also remove all links to this record.',
            itemName: title,
            onConfirm: async () => {
                await deleteRecord.mutateAsync(item.id);
                clearInspection();
            },
        });
    };

    const getFieldValue = (key: string, value: unknown): unknown => {
        if (editedFields[key] !== undefined) {
            return editedFields[key];
        }
        return value;
    };

    // Callbacks for complex field types in FieldRenderer
    const fieldCallbacks: FieldRendererCallbacks = {
        renderLinkField: (vm: FieldViewModel, onChange: (value: unknown) => void) => (
            <LinkFieldInput
                value={vm.value as string}
                fieldKey={vm.fieldId}
                taskId={isNode ? item.id : undefined}
                currentRecordId={!isNode ? item.id : undefined}
                onChange={onChange}
                readOnly={!vm.editable}
            />
        ),
        renderUserField: (vm: FieldViewModel, onChange: (value: unknown) => void) => (
            <UserMentionInput
                value={vm.value}
                onChange={onChange}
                readOnly={!vm.editable}
            />
        ),
        renderRichText: (vm: FieldViewModel, onChange: (value: unknown) => void, _multiline: boolean) => (
            <div className="border border-slate-200 rounded-md bg-white p-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                <RichTextEditor
                    content={vm.value}
                    taskId={item.id}
                    onChange={onChange}
                />
            </div>
        ),
    };

    // Determine which fields to render
    const hasRecordViewModels = !isNode && visibleViewModels.length > 0;

    return (
        <div className="fade-in space-y-6">
            {/* Identity Card */}
            <div className={`${bgColor} border rounded-lg p-4`}>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] opacity-75 font-bold uppercase mb-1">
                            Record Class: {nodeType}
                        </div>
                        <div className="text-lg font-bold text-slate-900">{title}</div>
                        <div className="text-xs opacity-50 mt-1 font-mono">
                            UUID: {item.id.slice(0, 11)}
                        </div>
                    </div>
                    {!isNode && (
                        <button
                            onClick={confirmDeleteRecord}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete record"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Description Editor (Only for Nodes) */}
            {isNode && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">
                        Description
                    </h4>
                    <div className="border border-slate-200 rounded-md bg-white p-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                        <RichTextEditor
                            key={item.id}
                            content={description}
                            taskId={item.id}
                            onChange={handleDescriptionChange}
                        />
                    </div>
                </div>
            )}

            {/* Fields Section */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">
                    Record Fields
                </h4>

                {/* Records: Use domain-derived view models */}
                {hasRecordViewModels && visibleViewModels.map((vm) => {
                    // Apply local edits to the view model
                    const displayVm = editedFields[vm.fieldId] !== undefined
                        ? { ...vm, value: editedFields[vm.fieldId] }
                        : vm;

                    return (
                        <div key={vm.fieldId}>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                {vm.label}
                                {vm.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <FieldRenderer
                                viewModel={displayVm}
                                onChange={(value) => handleFieldChange(vm.fieldId, value)}
                                callbacks={fieldCallbacks}
                            />
                        </div>
                    );
                })}

                {/* Records with no fields */}
                {!isNode && !hasRecordViewModels && !recordLoading && (
                    <p className="text-sm text-slate-400 italic">No fields defined</p>
                )}

                {/* Nodes: Use legacy field rendering (to be migrated) */}
                {isNode && nodeFields.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No fields defined</p>
                )}

                {isNode && nodeFields.map(({ key, value, def }) => {
                    // Create a simple FieldViewModel for nodes (legacy compatibility)
                    const vm: FieldViewModel = {
                        fieldId: key,
                        label: def?.label || key.replace(/_/g, ' '),
                        value: getFieldValue(key, value),
                        type: def?.type || 'text',
                        editable: true,
                        visible: true,
                        required: def?.required || false,
                        options: def?.options,
                    };

                    return (
                        <div key={key}>
                            <label className="block text-xs font-medium text-slate-500 mb-1 capitalize">
                                {vm.label}
                                {vm.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <FieldRenderer
                                viewModel={vm}
                                onChange={(newValue) => handleFieldChange(key, newValue)}
                                callbacks={fieldCallbacks}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
