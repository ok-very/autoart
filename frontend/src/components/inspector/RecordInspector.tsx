import { useState, useRef } from 'react';
import { Wrench, Copy, AlertCircle, Link2, Unlink, AlertTriangle, RefreshCw, FileText, Trash2, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '../../stores/uiStore';
import { EmojiPicker } from '../common/EmojiPicker';
import { CloneExcludedToggle } from '../common/CloneExcludedToggle';
import {
  useNode,
  useRecord,
  useRecordDefinitions,
  useUpdateDefinition,
  useCreateDefinition,
  useUpdateNode,
  useDeleteDefinition,
  useUpdateRecord,
  useDeleteRecord,
  useTaskReferences,
  useResolveReference,
  useUpdateReferenceMode,
  useUpdateReferenceSnapshot,
  useDeleteReference,
  useRecordLinks,
  useDeleteLink,
  useLinkTypes,
} from '../../api/hooks';
import { RichTextInput } from '../editor/RichTextInput';
import { RichTextEditor } from '../editor/RichTextEditor';
import { LinkFieldInput } from './LinkFieldInput';
import type { NodeType, FieldDef, RecordDefinition, TaskReference } from '../../types';

type TabId = 'record' | 'references' | 'links' | 'schema';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const STYLE_COLORS = [
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'red', class: 'bg-red-500' },
  { name: 'slate', class: 'bg-slate-500' },
];

export function RecordInspector() {
  const { inspectedNodeId, inspectedRecordId, inspectorMode, setInspectorMode, inspectorWidth } =
    useUIStore();

  const { data: node } = useNode(inspectedNodeId);
  const { data: record } = useRecord(inspectedRecordId);

  const inspectedItem = node || record;
  const isTask = node?.type === 'task';

  if (!inspectedItem) {
    return (
      <aside
        className="bg-white border-l border-slate-200 flex flex-col shrink-0"
        style={{ width: inspectorWidth }}
      >
        <div className="h-14 border-b border-slate-100 flex items-center justify-center px-5 bg-slate-50/50">
          <span className="text-xs text-slate-400">Select an item to inspect</span>
        </div>
      </aside>
    );
  }

  // Build available tabs based on context
  // Links tab only shown for records (not hierarchy nodes) since links are record-to-record
  const isRecord = !!record;
  const tabs: Tab[] = [
    { id: 'record', label: 'Record', icon: FileText },
    ...(isTask ? [{ id: 'references' as const, label: 'References', icon: Link2 }] : []),
    ...(isRecord ? [{ id: 'links' as const, label: 'Links', icon: ExternalLink }] : []),
    { id: 'schema', label: 'Schema', icon: Wrench },
  ];

  return (
    <aside
      className="bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl z-30"
      style={{ width: inspectorWidth }}
    >
      {/* Tab Selector Header */}
      <div className="h-12 border-b border-slate-100 flex items-center bg-slate-50/50 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = inspectorMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setInspectorMode(tab.id)}
              className={clsx(
                'flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-medium transition-all relative',
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-t" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll p-5">
        {inspectorMode === 'record' ? (
          <RecordView item={inspectedItem} isNode={!!node} />
        ) : inspectorMode === 'references' && isTask ? (
          <ReferencesView taskId={inspectedItem.id} />
        ) : inspectorMode === 'links' && isRecord ? (
          <LinksView itemId={inspectedItem.id} />
        ) : (
          <SchemaView item={inspectedItem} isNode={!!node} />
        )}
      </div>
    </aside>
  );
}

interface FieldInputProps {
  fieldKey: string;
  value: unknown;
  fieldDef?: FieldDef;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  /** Task ID for link fields (required when fieldDef.type === 'link') */
  taskId?: string;
  /** Current record ID for self-reference prevention */
  currentRecordId?: string;
}

function FieldInput({ fieldKey, value, fieldDef, onChange, readOnly, taskId, currentRecordId }: FieldInputProps) {
  const type = fieldDef?.type || 'text';

  // Handle link field type
  if (type === 'link' && taskId) {
    return (
      <LinkFieldInput
        value={String(value || '')}
        fieldKey={fieldKey}
        taskId={taskId}
        onChange={(val) => onChange(val)}
        readOnly={readOnly}
        targetDefinitionId={(fieldDef as FieldDef & { targetDefinitionId?: string })?.targetDefinitionId}
      />
    );
  }

  if (type === 'textarea') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={true}
        taskId={taskId}
        readOnly={readOnly}
        currentRecordId={currentRecordId}
      />
    );
  }

  if (type === 'select' && fieldDef?.options) {
    return (
      <div className="relative">
        <select
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={clsx(
            'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors appearance-none bg-white',
            readOnly
              ? 'border-slate-300 cursor-default'
              : 'border-slate-300 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
          )}
        >
          <option value="">Select...</option>
          {fieldDef.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
           <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
        </div>
      </div>
    );
  }

  if (type === 'checkbox') {
    const isChecked = String(value) === 'true';
    return (
      <div className="flex items-center h-9">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onChange(String(e.target.checked))}
            disabled={readOnly}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors"
          />
          <span className="ml-2 text-sm text-slate-600 select-none">{isChecked ? 'Yes' : 'No'}</span>
        </label>
      </div>
    );
  }

  if (type === 'date') {
      return (
         <input
            type="date"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            className={clsx(
              'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
              readOnly
                ? 'border-slate-300 bg-white cursor-default'
                : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
            )}
          />
      );
  }

  // For text fields, use RichTextInput
  if (type === 'text') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={false}
        taskId={taskId}
        readOnly={readOnly}
        currentRecordId={currentRecordId}
      />
    );
  }

  // Standard input for number, email, url types
  return (
    <input
      type={type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
      value={String(value || '')}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className={clsx(
        'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
        readOnly
          ? 'border-slate-300 bg-white cursor-default'
          : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
      )}
    />
  );
}

interface ViewProps {
  item: ReturnType<typeof useNode>['data'] | ReturnType<typeof useRecord>['data'];
  isNode: boolean;
}

function RecordView({ item, isNode }: ViewProps) {
  const { inspectRecord, openDrawer } = useUIStore();
  const updateNode = useUpdateNode();
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();
  const { data: definitions } = useRecordDefinitions();
  
  const descriptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({});

  if (!item) return null;

  const nodeType = isNode ? (item as { type: NodeType }).type : 'record';
  const title = isNode ? (item as { title: string }).title : (item as { unique_name: string }).unique_name;
  // Ensure metadata and data are always objects to prevent Object.entries crash
  const rawMetadata = isNode ? ((item as { metadata?: Record<string, unknown> | string }).metadata || {}) : {};
  const metadata: Record<string, unknown> = (typeof rawMetadata === 'string' 
    ? JSON.parse(rawMetadata) 
    : rawMetadata) as Record<string, unknown>;

  const data = !isNode ? ((item as { data?: Record<string, unknown> }).data || {}) : {};
  const description = isNode ? (item as { description?: unknown }).description : null;
  const definitionId = !isNode ? (item as { definition_id: string }).definition_id : null;

  // Find definition
  // For records: match by ID
  // For nodes: match by capitalized type name (e.g. "Process", "Task")
  const definition = definitions?.find((d) => {
    if (!isNode && definitionId) return d.id === definitionId;
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

  // Determine fields to show
  let fields: { key: string; value: unknown; def?: FieldDef }[] = [];

  if (definition && definition.schema_config?.fields) {
    // Show all defined fields - with null safety
    fields = definition.schema_config.fields.map(fieldDef => ({
      key: fieldDef.key,
      value: data[fieldDef.key],
      def: fieldDef
    }));

    // Add extra fields not in definition
    Object.entries(data).forEach(([key, value]) => {
      if (!fields.find(f => f.key === key)) {
        fields.push({ key, value, def: undefined });
      }
    });
  } else {
    // Fallback for nodes or records without definition
    fields = Object.entries(isNode ? metadata : data).map(([key, value]) => ({
      key,
      value,
      def: undefined
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

    // Clear existing timer for this field
    if (fieldTimerRef.current[key]) {
      clearTimeout(fieldTimerRef.current[key]);
    }

    // Debounce the save
    fieldTimerRef.current[key] = setTimeout(() => {
      // Direct assignment as value can now be object (TipTap JSON)
      const parsedValue = value; 

      if (isNode) {
        // Update node metadata
        updateNode.mutate({
          id: item.id,
          metadata: { ...metadata, [key]: parsedValue },
        });
      } else {
        // Update record data
        const recordItem = item as { data?: Record<string, unknown> };
        if (recordItem.data) {
          updateRecord.mutate({
            id: item.id,
            data: { ...recordItem.data, [key]: parsedValue },
          });
        }
      }
    }, 1000);
  };

  const confirmDeleteRecord = () => {
    openDrawer('confirm-delete', {
      title: 'Delete Record',
      message: 'Are you sure you want to delete this record? This action cannot be undone and will also remove all links to this record.',
      itemName: title,
      onConfirm: async () => {
        await deleteRecord.mutateAsync(item.id);
        inspectRecord(null);
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
              key={item.id} // Force remount on node change
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
              <FieldInput
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

function SchemaView({ item, isNode }: ViewProps) {
  const { openDrawer, setInspectorMode } = useUIStore();
  const [isCreatingDefinition, setIsCreatingDefinition] = useState(false);

  // Get all definitions for lookup
  const { data: definitions, refetch: refetchDefinitions } = useRecordDefinitions();
  const updateDefinition = useUpdateDefinition();
  const createDefinition = useCreateDefinition();
  const deleteDefinition = useDeleteDefinition();

  if (!item) return null;

  const nodeType = isNode ? (item as { type: NodeType }).type : 'record';
  const definitionId = !isNode ? (item as { definition_id: string }).definition_id : null;

  // Find definition for this item
  let definition: RecordDefinition | undefined;
  const typeName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);

  if (definitionId && definitions) {
    definition = definitions.find((d) => d.id === definitionId);
  } else if (isNode && definitions) {
    // For nodes, find definition by matching name to type (capitalized)
    definition = definitions.find((d) => d.name === typeName);
  }

  const fields = definition?.schema_config?.fields || [];
  const currentColor = definition?.styling?.color || 'orange';

  // Auto-create definition for node types if it doesn't exist
  const handleCreateDefinition = async () => {
    if (definition || !isNode) return;

    setIsCreatingDefinition(true);
    try {
      await createDefinition.mutateAsync({
        name: typeName,
        schemaConfig: { fields: [] },
        styling: { color: 'slate' },
      });
      await refetchDefinitions();
    } catch (err) {
      console.error('Failed to create definition:', err);
    } finally {
      setIsCreatingDefinition(false);
    }
  };

  const confirmDeleteDefinition = () => {
    if (!definition) return;
    openDrawer('confirm-delete', {
      title: 'Delete Definition',
      message: `Are you sure you want to delete the "${definition.name}" definition? This action cannot be undone.`,
      itemName: definition.name,
      onConfirm: async () => {
        await deleteDefinition.mutateAsync(definition.id);
        setInspectorMode('record');
      },
    });
  };

  const handleAddField = async (field: FieldDef) => {
    if (!definition) return;

    const updatedFields = [...fields, field];
    await updateDefinition.mutateAsync({
      id: definition.id,
      schemaConfig: { fields: updatedFields },
    });
  };

  const handleRemoveField = async (fieldKey: string) => {
    if (!definition) return;

    const updatedFields = fields.filter((f) => f.key !== fieldKey);
    await updateDefinition.mutateAsync({
      id: definition.id,
      schemaConfig: { fields: updatedFields },
    });
  };

  const confirmRemoveField = (fieldKey: string) => {
    openDrawer('confirm-delete', {
      title: 'Delete Field',
      message: `Are you sure you want to delete the "${fieldKey}" field? This will remove it from all records of this type.`,
      onConfirm: async () => handleRemoveField(fieldKey),
    });
  };

  const handleColorChange = async (color: string) => {
    if (!definition) return;

    await updateDefinition.mutateAsync({
      id: definition.id,
      styling: { ...definition.styling, color },
    });
  };

  const handleEmojiChange = async (emoji: string) => {
    if (!definition) return;

    await updateDefinition.mutateAsync({
      id: definition.id,
      styling: { ...definition.styling, icon: emoji },
    });
  };

  const openCloneDrawer = () => {
    if (!definition) return;
    openDrawer('clone-definition', {
      definitionName: definition.name,
      onClone: async (name: string) => {
        await createDefinition.mutateAsync({
          name: name,
          schemaConfig: definition.schema_config,
          styling: definition.styling,
        });
      },
    });
  };

  const openAddFieldDrawer = () => {
    openDrawer('add-field', {
      onSubmit: handleAddField,
      isPending: updateDefinition.isPending,
    });
  };

  // System fields that can't be deleted
  const systemFields = ['title', 'name'];

  return (
    <div className="fade-in space-y-6">
      <div className="bg-slate-800 text-slate-100 rounded-lg p-4 shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
              Editing Class Definition
            </div>
            <div className="text-lg font-bold capitalize">
              {definition?.name || nodeType} Record
            </div>
          </div>
          <div className="flex gap-2">
            {definition && (
              <CloneExcludedToggle definition={definition} theme="dark" />
            )}
            <button
              onClick={openCloneDrawer}
              disabled={!definition}
              className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-2 py-1 rounded flex items-center gap-1"
            >
              <Copy size={12} />
              Clone
            </button>
            <button
              onClick={confirmDeleteDefinition}
              disabled={!definition}
              className="text-xs bg-slate-700 hover:bg-red-600 disabled:opacity-50 px-2 py-1 rounded flex items-center gap-1"
              title="Delete Type"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Changes here affect all "{definition?.name || nodeType}" records in this Project unless you fork this type.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">
          Defined Fields
        </h4>

        {!definition ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded">
              <AlertCircle size={16} />
              <span>No schema definition found for "{typeName}" type.</span>
            </div>
            {isNode && (
              <button
                onClick={handleCreateDefinition}
                disabled={isCreatingDefinition}
                className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isCreatingDefinition ? 'Creating...' : `Create "${typeName}" Definition`}
              </button>
            )}
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No fields defined yet.</p>
        ) : (
          fields.map((field) => {
            const isSystem = systemFields.includes(field.key);
            return (
              <div
                key={field.key}
                className={`flex items-center justify-between p-2 ${
                  isSystem ? 'bg-slate-50' : 'bg-white'
                } border border-slate-200 rounded hover:shadow-sm transition-all group`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono ${
                      field.type === 'link' ? 'text-blue-500' : 'text-slate-400'
                    }`}
                  >
                    {field.type}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                  {field.required && (
                    <span className="text-[10px] text-red-500">*</span>
                  )}
                </div>
                {isSystem ? (
                  <span className="text-[10px] text-slate-400">System Required</span>
                ) : (
                  <button
                    onClick={() => confirmRemoveField(field.key)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })
        )}

        {/* Add Field Button */}
        <button
          onClick={openAddFieldDrawer}
          disabled={!definition}
          className="w-full py-2 border border-dashed border-blue-300 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Add New Field Definition
        </button>
      </div>

      {/* Styling Override */}
      {definition && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase">Class Styling</h4>
          <div className="flex items-center gap-4">
            {/* Emoji Picker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-medium">Icon</span>
              <EmojiPicker
                value={definition.styling?.icon}
                onChange={handleEmojiChange}
                size="md"
              />
            </div>

            {/* Color Picker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-medium">Color</span>
              <div className="flex items-center gap-1.5">
                {STYLE_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => handleColorChange(color.name)}
                    className={`w-6 h-6 rounded ${color.class} cursor-pointer transition-all ${
                      currentColor === color.name
                        ? 'ring-2 ring-offset-1 ring-current opacity-100'
                        : 'opacity-30 hover:opacity-100'
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== REFERENCES VIEW ====================

interface ReferencesViewProps {
  taskId: string;
}

function ReferencesView({ taskId }: ReferencesViewProps) {
  const { data: references, isLoading } = useTaskReferences(taskId);

  if (isLoading) {
    return (
      <div className="fade-in flex items-center justify-center py-8">
        <div className="text-sm text-slate-400">Loading references...</div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={16} className="text-blue-600" />
          <span className="text-sm font-bold text-blue-900">Task References</span>
        </div>
        <p className="text-xs text-blue-700 leading-relaxed">
          References link this task to record fields. Dynamic references update automatically;
          static references preserve a snapshot.
        </p>
      </div>

      {/* References List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">
          Linked References ({references?.length || 0})
        </h4>

        {!references || references.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-slate-300 mb-2">
              <Link2 size={32} className="mx-auto" />
            </div>
            <p className="text-sm text-slate-400">No references yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Use <code className="bg-slate-100 px-1 rounded">#recordname:field</code> in the description to create references
            </p>
          </div>
        ) : (
          references.map((ref) => (
            <ReferenceCard key={ref.id} reference={ref} />
          ))
        )}
      </div>
    </div>
  );
}

interface ReferenceCardProps {
  reference: TaskReference;
}

function ReferenceCard({ reference }: ReferenceCardProps) {
  const { data: resolved, refetch, isFetching } = useResolveReference(reference.id);
  const updateMode = useUpdateReferenceMode();
  const updateSnapshot = useUpdateReferenceSnapshot();
  const deleteReference = useDeleteReference();
  const { openDrawer } = useUIStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const currentMode = resolved?.mode ?? reference.mode ?? 'dynamic';
  const hasDrift = resolved?.drift ?? false;
  const displayValue = resolved?.value;
  // Guard against null source_record_id or target_field_key
  const fallbackLabel = reference.source_record_id && reference.target_field_key
    ? `#${reference.source_record_id}:${reference.target_field_key}`
    : '#unknown:unknown';
  const label = resolved?.label ?? fallbackLabel;

  const handleToggleMode = async () => {
    const newMode = currentMode === 'static' ? 'dynamic' : 'static';
    try {
      await updateMode.mutateAsync({ id: reference.id, mode: newMode });
      refetch();
    } catch (err) {
      console.error('Failed to update reference mode:', err);
    }
  };

  const handleSyncToLive = async () => {
    if (!hasDrift) return;
    try {
      await updateMode.mutateAsync({ id: reference.id, mode: 'dynamic' });
      refetch();
    } catch (err) {
      console.error('Failed to sync reference:', err);
    }
  };

  const handleVerify = () => {
      refetch();
  };

  const handleDelete = () => {
    openDrawer('confirm-delete', {
      title: 'Delete Reference',
      message: 'Are you sure you want to delete this reference? The link between this task and the source record will be removed.',
      itemName: label,
      onConfirm: async () => {
        await deleteReference.mutateAsync(reference.id);
      },
    });
  };

  const handleEditStart = () => {
    const val = displayValue !== undefined && displayValue !== null 
       ? typeof displayValue === 'object' ? JSON.stringify(displayValue) : String(displayValue)
       : '';
    setEditValue(val);
    setIsEditing(true);
  };
  
  const handleSaveSnapshot = async () => {
     let val: unknown = editValue;
     try {
        if (editValue === 'true') val = true;
        else if (editValue === 'false') val = false;
        else if (!isNaN(Number(editValue)) && editValue.trim() !== '') val = Number(editValue);
        else val = JSON.parse(editValue);
     } catch {
        val = editValue;
     }
     
     await updateSnapshot.mutateAsync({ id: reference.id, value: val });
     setIsEditing(false);
  };

  return (
    <>
      <div
        className={clsx(
          'border rounded-lg p-3 transition-all group',
          hasDrift ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
        )}
      >
        {/* Reference Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {currentMode === 'static' ? (
              <Unlink size={14} className="text-orange-500 shrink-0" />
            ) : (
              <Link2 size={14} className="text-blue-500 shrink-0" />
            )}
            <code className="text-xs font-mono text-slate-700 truncate">{label}</code>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={clsx(
                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0',
                currentMode === 'static'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              )}
            >
              {currentMode}
            </span>
            <button
              onClick={handleDelete}
              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-red-50"
              title="Delete reference"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Current Value */}
        <div className="bg-slate-50 rounded p-2 mb-2">
          <div className="flex justify-between items-center mb-1">
             <div className="text-[10px] text-slate-400 uppercase">Current Value</div>
             {currentMode === 'static' && !isEditing && (
                 <button onClick={handleEditStart} className="text-[10px] text-blue-500 hover:underline">Edit</button>
             )}
          </div>
          
          {isEditing ? (
              <div className="flex gap-2">
                  <input 
                      type="text" 
                      value={editValue} 
                      onChange={e => setEditValue(e.target.value)}
                      className="flex-1 text-sm border rounded px-1 py-0.5"
                      autoFocus
                  />
                  <button onClick={handleSaveSnapshot} className="text-xs bg-blue-500 text-white px-2 rounded">Save</button>
                  <button onClick={() => setIsEditing(false)} className="text-xs bg-slate-200 text-slate-700 px-2 rounded">Cancel</button>
              </div>
          ) : (
              <div className="text-sm text-slate-700 font-medium truncate">
                {displayValue !== undefined && displayValue !== null
                  ? typeof displayValue === 'object'
                    ? JSON.stringify(displayValue)
                    : String(displayValue)
                  : <span className="text-slate-400 italic">null</span>}
              </div>
          )}
        </div>

        {/* Drift Warning */}
        {hasDrift && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-100 rounded p-2 mb-2">
            <AlertTriangle size={14} />
            <span className="text-xs">Value has drifted from live source</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleToggleMode}
            disabled={updateMode.isPending}
            className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {currentMode === 'static' ? (
              <>
                <Link2 size={12} />
                Make Dynamic
              </>
            ) : (
              <>
                <Unlink size={12} />
                Make Static
              </>
            )}
          </button>

          {currentMode === 'static' && !hasDrift && (
             <button
                onClick={handleVerify}
                disabled={isFetching}
                className="text-xs px-2 py-1.5 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
                title="Check for drift"
             >
                <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
             </button>
          )}

          {hasDrift && (
            <button
              onClick={handleSyncToLive}
              disabled={updateMode.isPending}
              className="text-xs px-2 py-1.5 border border-amber-200 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Sync
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ==================== LINKS VIEW ====================

interface LinksViewProps {
  itemId: string;
}

interface RecordLink {
  id: string;
  source_record_id: string;
  target_record_id: string;
  link_type: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  source_record?: {
    id: string;
    unique_name: string;
    definition_name: string;
  };
  target_record?: {
    id: string;
    unique_name: string;
    definition_name: string;
  };
}

function LinksView({ itemId }: LinksViewProps) {
  const { data: linksData, isLoading } = useRecordLinks(itemId);
  const { data: linkTypes } = useLinkTypes();
  const deleteLink = useDeleteLink();
  const { openDrawer } = useUIStore();

  if (isLoading) {
    return (
      <div className="fade-in flex items-center justify-center py-8">
        <div className="text-sm text-slate-400">Loading links...</div>
      </div>
    );
  }

  const outgoing = linksData?.outgoing || [];
  const incoming = linksData?.incoming || [];
  const totalLinks = outgoing.length + incoming.length;

  const handleDeleteLink = (link: RecordLink) => {
    openDrawer('confirm-delete', {
      title: 'Delete Link',
      message: 'Are you sure you want to delete this link? The relationship between these records will be removed.',
      itemName: `${link.link_type} link`,
      onConfirm: async () => {
        await deleteLink.mutateAsync(link.id);
      },
    });
  };

  return (
    <div className="fade-in space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink size={16} className="text-purple-600" />
          <span className="text-sm font-bold text-purple-900">Record Links</span>
        </div>
        <p className="text-xs text-purple-700 leading-relaxed mb-3">
          Links connect this record to other records in the system.
          Use <code className="bg-purple-100 px-1 rounded">@recordname</code> in fields to create links.
        </p>
        
        <button
          onClick={() => openDrawer('create-link', { sourceRecordId: itemId })}
          className="w-full py-2 bg-white border border-purple-200 text-purple-700 rounded text-xs font-bold hover:bg-purple-50 hover:border-purple-300 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <ExternalLink size={12} />
          Link Another Record
        </button>
      </div>

      {/* Link Types Summary */}
      {linkTypes && linkTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {linkTypes.map((type) => (
            <span
              key={type}
              className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
            >
              {type}
            </span>
          ))}
        </div>
      )}

      {/* Outgoing Links */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
          <span className="text-blue-500">→</span> Outgoing Links ({outgoing.length})
        </h4>

        {outgoing.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">No outgoing links</p>
        ) : (
          outgoing.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              direction="outgoing"
              onDelete={() => handleDeleteLink(link)}
            />
          ))
        )}
      </div>

      {/* Incoming Links */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
          <span className="text-green-500">←</span> Incoming Links ({incoming.length})
        </h4>

        {incoming.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">No incoming links</p>
        ) : (
          incoming.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              direction="incoming"
              onDelete={() => handleDeleteLink(link)}
            />
          ))
        )}
      </div>

      {/* Empty State */}
      {totalLinks === 0 && (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
          <div className="text-slate-300 mb-2">
            <ExternalLink size={32} className="mx-auto" />
          </div>
          <p className="text-sm text-slate-400">No links yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Links are created when you reference other records
          </p>
        </div>
      )}
    </div>
  );
}

interface LinkCardProps {
  link: RecordLink;
  direction: 'outgoing' | 'incoming';
  onDelete: () => void;
}

function LinkCard({ link, direction, onDelete }: LinkCardProps) {
  const { inspectRecord } = useUIStore();

  const targetInfo = direction === 'outgoing' ? link.target_record : link.source_record;
  const recordName = targetInfo?.unique_name || 'Unknown Record';
  const definitionName = targetInfo?.definition_name || 'Unknown Type';
  const recordId = direction === 'outgoing' ? link.target_record_id : link.source_record_id;

  const handleNavigate = () => {
    inspectRecord(recordId);
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Link Type Badge */}
          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
            {link.link_type}
          </span>

          {/* Record Info */}
          <button
            onClick={handleNavigate}
            className="mt-2 block text-left w-full hover:bg-slate-50 rounded p-1 -m-1 transition-colors"
          >
            <div className="text-sm font-medium text-slate-900 truncate">
              {recordName}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {definitionName}
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleNavigate}
            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
            title="View record"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Delete link"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Metadata preview if any */}
      {Object.keys(link.metadata).length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 uppercase mb-1">Metadata</div>
          <div className="text-xs text-slate-600 font-mono bg-slate-50 rounded p-1 truncate">
            {JSON.stringify(link.metadata)}
          </div>
        </div>
      )}

      {/* Created timestamp */}
      <div className="mt-2 text-[10px] text-slate-400">
        Created {new Date(link.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}