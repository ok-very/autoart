/**
 * NodeFieldEditor - Semantic Component for editing node metadata fields
 *
 * Responsibilities:
 * - Fetches node data and definition
 * - Builds FieldViewModel for the specified field
 * - Renders the appropriate UI molecule (FieldRenderer)
 * - Handles validation and persistence
 * - Manages optimistic UI updates
 *
 * Design Rules:
 * - NO onChange prop (internally managed)
 * - NO inline API calls (delegated to semantic layer logic)
 */

import { clsx } from 'clsx';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import type { FieldViewModel, FieldDefinition, ProjectState, EntityContext } from '@autoart/shared/domain';
import { buildFieldViewModel } from '@autoart/shared/domain';

import { ReferenceEditor } from './ReferenceEditor';
import { useNode, useRecordDefinitions, useUpdateNode } from '../../api/hooks';
import { TASK_STATUS_CONFIG } from '../../utils/nodeMetadata';
import { UserMentionInput } from '../composites/UserMentionInput';
import { RichTextEditor } from '../editor/RichTextEditor';
import { FieldRenderer, type FieldRendererCallbacks } from '../../ui/molecules/FieldRenderer';

export interface NodeFieldEditorProps {
    /** ID of the node to edit */
    nodeId: string;
    /** Key of the field to edit (from metadata or special fields) */
    fieldId: string;
    /** Optional class name */
    className?: string;
    /** Whether to show the label (defaults to false for pure editor) */
    showLabel?: boolean;
}

/**
 * Creates a minimal ProjectState for node-level operations.
 */
function createMinimalProjectState(phase: number = 0): ProjectState {
    return {
        projectId: '',
        phase,
        nodes: [],
        records: [],
        definitions: [],
        metadata: {},
    };
}

/**
 * Map API field definition to domain FieldDefinition
 */
function mapToFieldDefinition(fieldDef: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
}): FieldDefinition {
    return {
        key: fieldDef.key,
        label: fieldDef.label,
        type: fieldDef.type as FieldDefinition['type'],
        required: fieldDef.required,
        options: fieldDef.options,
        phase: 0,
    };
}

export function NodeFieldEditor({
    nodeId,
    fieldId,
    className,
    showLabel = false,
}: NodeFieldEditorProps) {
    // 1. Data Fetching
    const { data: node, isLoading: nodeLoading } = useNode(nodeId);
    const { data: definitions, isLoading: defsLoading } = useRecordDefinitions();
    const updateNode = useUpdateNode();

    // 2. Local State for Optimistic Updates
    const [pendingValue, setPendingValue] = useState<unknown>(undefined);
    const [isDirty, setIsDirty] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestMetadataRef = useRef<Record<string, unknown>>({});

    // Alias for derived value pattern (set below after viewModel is computed)

    // Build field view model from node metadata
    const { viewModel, metadata } = useMemo(() => {
        if (!node || !definitions) {
            return { viewModel: null, metadata: {} };
        }

        // Parse metadata
        const rawMetadata = node.metadata || {};
        const parsedMetadata: Record<string, unknown> =
            typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;

        // Find the definition for this node type
        const nodeTypeName = node.type.charAt(0).toUpperCase() + node.type.slice(1);
        const definition = definitions.find((d) => {
            // Check by default_record_def_id or by name matching node type
            if (node.default_record_def_id) {
                return d.id === node.default_record_def_id;
            }
            return d.name === nodeTypeName;
        });

        // Find the field definition
        const fieldDef = definition?.schema_config?.fields?.find((f) => f.key === fieldId);

        if (!fieldDef) {
            // If no field def, create a simple text field
            return {
                viewModel: {
                    fieldId,
                    label: fieldId.replace(/_/g, ' '),
                    value: parsedMetadata[fieldId],
                    type: 'text',
                    visible: true,
                    editable: true,
                    required: false,
                } as FieldViewModel,
                metadata: parsedMetadata,
            };
        }

        // Build view model using domain layer
        const projectState = createMinimalProjectState();
        const entityContext: EntityContext = {
            entityId: node.id,
            entityType: 'node',
            nodeType: node.type,
            parentId: node.parent_id || undefined,
        };

        const domainFieldDef = mapToFieldDefinition(fieldDef);
        const vm = buildFieldViewModel({
            field: domainFieldDef,
            value: parsedMetadata[fieldId],
            projectState,
            entityContext,
        });

        return { viewModel: vm, metadata: parsedMetadata };
    }, [node, definitions, fieldId]);

    // Keep metadata ref updated for saves
    useEffect(() => {
        latestMetadataRef.current = metadata;
    }, [metadata]);

    // Derive display value: use pending when dirty, otherwise remote
    const localValue = isDirty ? pendingValue : viewModel?.value;
    const setLocalValue = setPendingValue;

    // 3. Persistence Logic
    const handleSave = useCallback(
        (newValue: unknown) => {
            if (!node) return;

            // Optimistic update
            setLocalValue(newValue);
            setIsDirty(true);

            // Debounce save
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(() => {
                updateNode.mutate(
                    {
                        id: nodeId,
                        metadata: {
                            ...latestMetadataRef.current,
                            [fieldId]: newValue,
                        },
                    },
                    {
                        onSuccess: () => {
                            setIsDirty(false);
                        },
                        onError: (error) => {
                            console.error('Failed to save node field:', error);
                            setIsDirty(false);
                        },
                    }
                );
            }, 1000); // 1s debounce
        },
        [node, nodeId, fieldId, updateNode, setLocalValue]
    );

    // 4. Callbacks for Complex Fields
    const fieldCallbacks: FieldRendererCallbacks = {
        renderLinkField: (vm: FieldViewModel, onChange: (value: unknown) => void) => (
            <ReferenceEditor
                value={vm.value as string}
                fieldKey={vm.fieldId}
                taskId={nodeId}
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
                    contextId={nodeId}
                    contextType="subprocess"
                    onChange={onChange}
                />
            </div>
        ),
    };

    // 5. Render
    const isLoading = nodeLoading || defsLoading;

    if (isLoading) {
        return <div className="animate-pulse h-8 bg-slate-100 rounded w-full" />;
    }

    if (!viewModel) {
        return (
            <div className="text-xs text-red-500">
                Field "{fieldId}" not found
            </div>
        );
    }

    // Use local value for rendering if dirty, otherwise view model value
    const displayViewModel: FieldViewModel = {
        ...viewModel,
        value: isDirty ? localValue : viewModel.value,
    };

    return (
        <div className={clsx('relative', className)}>
            {showLabel && (
                <label className="block text-xs font-medium text-slate-500 mb-1">
                    {viewModel.label}
                    {viewModel.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <FieldRenderer
                viewModel={displayViewModel}
                onChange={handleSave}
                callbacks={fieldCallbacks}
                statusConfig={TASK_STATUS_CONFIG}
                className={clsx(isDirty && 'border-amber-300 ring-1 ring-amber-100')}
            />
            {isDirty && (
                <div className="absolute top-0 right-0 -mt-1 -mr-1 w-2 h-2 bg-amber-400 rounded-full shadow-sm" />
            )}
        </div>
    );
}
