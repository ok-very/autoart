import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import {
  useNode,
  useRecord,
  useRecordDefinitions,
  useUpdateNode,
  useUpdateRecord,
  useDeleteRecord,
} from '../../../api/hooks';
import { RichTextEditor } from '../../editor/RichTextEditor';
import { FieldRenderer } from '../fields/FieldRenderer';
import type { NodeType, FieldDef, HierarchyNode } from '../../../types';
import { parseTaskMetadata, DEFAULT_TASK_FIELDS } from '../../../utils/nodeMetadata';

interface RecordPropertiesViewProps {
  itemId: string;
  isNode: boolean;
}

/**
 * RecordPropertiesView - Displays and edits record/node properties
 *
 * Shows:
 * - Identity card (type badge, name, UUID)
 * - Description editor (for nodes)
 * - Dynamic fields from definition schema
 * - Auto-saves with debounce
 */
export function RecordPropertiesView({ itemId, isNode }: RecordPropertiesViewProps) {
  const { clearInspection, openDrawer } = useUIStore();
  const { data: node } = useNode(isNode ? itemId : null);
  const { data: record } = useRecord(isNode ? null : itemId);
  const updateNode = useUpdateNode();
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();
  const { data: definitions } = useRecordDefinitions();

  const descriptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({});

  const item = node || record;
  if (!item) return null;

  const nodeType = isNode ? (item as { type: NodeType }).type : 'record';
  const title = isNode
    ? (item as { title: string }).title
    : (item as { unique_name: string }).unique_name;

  // Ensure metadata and data are always objects
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

  // Avoid stale closure issues inside debounced saves.
  const latestMetadataRef = useRef<Record<string, unknown>>({});
  const latestDataRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    latestMetadataRef.current = metadata;
  }, [metadata]);
  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  // Find definition
  const definition = definitions?.find((d) => {
    if (definitionId) return d.id === definitionId;
    if (isNode) {
      const type = (item as { type: string }).type;
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);
      return d.name === typeName;
    }
    return false;
  }) || null;

  const bgColor = {
    project: 'bg-blue-50 border-blue-100 text-blue-900',
    process: 'bg-purple-50 border-purple-100 text-purple-900',
    stage: 'bg-slate-50 border-slate-100 text-slate-900',
    subprocess: 'bg-orange-50 border-orange-100 text-orange-900',
    task: 'bg-green-50 border-green-100 text-green-900',
    record: 'bg-slate-50 border-slate-100 text-slate-900',
  }[nodeType];

  // Build fields list
  let fields: { key: string; value: unknown; def?: FieldDef }[] = [];

  // Special handling for task nodes: merge default task fields with custom definition fields
  if (isNode && nodeType === 'task') {
    const taskMeta = parseTaskMetadata(metadata);

    // Start with default task field definitions (excluding title/description handled separately)
    const defaultFieldDefs: FieldDef[] = DEFAULT_TASK_FIELDS
      .filter((f) => f.key !== 'title' && f.key !== 'description')
      .map((f) => ({
        key: f.key,
        type: f.type,
        label: f.label,
        required: f.required,
        options: f.options,
      }));

    // Merge with custom fields from Task definition if it exists
    const customFields: FieldDef[] = definition?.schema_config?.fields
      ?.filter((f) => !defaultFieldDefs.find((df) => df.key === f.key))
      ?.filter((f) => f.key !== 'title' && f.key !== 'description')
      || [];

    const allFieldDefs = [...defaultFieldDefs, ...customFields];

    fields = allFieldDefs.map((fieldDef) => ({
      key: fieldDef.key,
      value: metadata[fieldDef.key] ?? taskMeta[fieldDef.key as keyof typeof taskMeta],
      def: fieldDef,
    }));

    // Include any extra metadata keys not covered above so nothing is hidden
    Object.entries(metadata).forEach(([key, value]) => {
      if (key === 'percentComplete') return;
      if (!fields.find((f) => f.key === key)) {
        fields.push({ key, value, def: undefined });
      }
    });
  } else if (definition && definition.schema_config?.fields) {
    fields = definition.schema_config.fields.map((fieldDef) => ({
      key: fieldDef.key,
      value: data[fieldDef.key],
      def: fieldDef,
    }));
  } else {
    // Fallback for nodes or records without definition
    fields = Object.entries(isNode ? metadata : data).map(([key, value]) => ({
      key,
      value,
      def: undefined,
    }));
  }

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

  const handleFieldChange = (key: string, value: unknown) => {
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
        const recordItem = item as { data?: Record<string, unknown> };
        if (recordItem.data) {
          updateRecord.mutate({
            id: item.id,
            data: { ...latestDataRef.current, [key]: value },
          });
        }
      }
    }, 1000);
  };

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

        {fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No fields defined</p>
        ) : (
          fields.map(({ key, value, def }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1 capitalize">
                {def?.label || key.replace(/_/g, ' ')}
                {def?.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldRenderer
                fieldKey={key}
                value={getFieldValue(key, value)}
                fieldDef={def}
                onChange={(newValue) => handleFieldChange(key, newValue)}
                readOnly={false}
                taskId={isNode ? item.id : undefined}
                currentRecordId={!isNode ? item.id : undefined}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
