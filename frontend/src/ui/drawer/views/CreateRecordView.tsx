import { useState } from 'react';
import { Plus, FolderTree, X } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import {
  useRecordDefinition,
  useCreateRecord,
  useProjectTree,
} from '../../../api/hooks';
import { RichTextInput } from '../../editor/RichTextInput';
import type { FieldDef, HierarchyNode } from '../../../types';
import type { DrawerProps, CreateRecordContext } from '../../../drawer/types';

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCreateRecordViewProps {
  definitionId: string;
  classificationNodeId?: string;
}

// New contract props
type CreateRecordViewProps = DrawerProps<CreateRecordContext, { recordId: string }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is CreateRecordViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function CreateRecordView(props: CreateRecordViewProps | LegacyCreateRecordViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const definitionId = isNewContract ? props.context.definitionId : props.definitionId;
  const initialNodeId = isNewContract ? props.context.classificationNodeId : props.classificationNodeId;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const { closeDrawer, activeProjectId, setSelection } = useUIStore();
  const { data: definition, isLoading } = useRecordDefinition(definitionId);
  const { data: projectNodes } = useProjectTree(activeProjectId);
  const createRecord = useCreateRecord();

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  const [uniqueName, setUniqueName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId || null);
  const [showNodePicker, setShowNodePicker] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="p-4 text-center text-slate-400">
        Definition not found
      </div>
    );
  }

  const fields = definition.schema_config?.fields || [];

  const handleFieldChange = (key: string, newValue: unknown) => {
    setFieldValues((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniqueName.trim()) return;

    try {
      const result = await createRecord.mutateAsync({
        definitionId: definitionId,
        uniqueName: uniqueName.trim(),
        data: fieldValues,
        classificationNodeId: selectedNodeId,
      });

      // Handle result based on contract type
      if (result.record) {
        if (onSubmit) {
          // New contract: emit typed result
          onSubmit({
            success: true,
            data: { recordId: result.record.id },
            sideEffects: [{ type: 'create', entityType: 'record' }],
          });
        } else {
          // Legacy: close and select
          closeDrawer();
          setSelection({ type: 'record', id: result.record.id });
        }
      }
    } catch (err) {
      console.error('Failed to create record:', err);
      if (onSubmit) {
        onSubmit({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create record',
        });
      }
    }
  };

  // Build node options for the picker
  const getNodeLabel = (node: HierarchyNode): string => {
    return node.title || node.type;
  };

  const getNodePath = (nodeId: string): string => {
    if (!projectNodes) return '';
    const node = projectNodes.find((n) => n.id === nodeId);
    if (!node) return '';

    const path: string[] = [node.title];
    let current = node;
    while (current.parent_id) {
      const parent = projectNodes.find((n) => n.id === current.parent_id);
      if (parent) {
        path.unshift(parent.title);
        current = parent;
      } else {
        break;
      }
    }
    return path.join(' > ');
  };

  const selectedNode = selectedNodeId && projectNodes
    ? projectNodes.find((n) => n.id === selectedNodeId)
    : null;

  const icon = definition.styling?.icon;
  const color = definition.styling?.color || 'slate';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-12 h-12 rounded-lg bg-${color}-100 flex items-center justify-center text-2xl`}
        >
          {icon || definition.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            Create New
          </div>
          <h2 className="text-xl font-bold text-slate-800">{definition.name}</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Unique Name */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={uniqueName}
            onChange={(e) => setUniqueName(e.target.value)}
            placeholder={`Enter ${definition.name.toLowerCase()} name...`}
            className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* Classification Node Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            <div className="flex items-center gap-1">
              <FolderTree size={12} />
              Classify Under
            </div>
          </label>

          {selectedNode ? (
            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">
                  {getNodeLabel(selectedNode)}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {getNodePath(selectedNode.id)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNodePicker(!showNodePicker)}
              className="w-full text-left px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              Select a project/task to classify under (optional)
            </button>
          )}

          {/* Node Picker Dropdown */}
          {showNodePicker && projectNodes && (
            <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-md bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeId(null);
                  setShowNodePicker(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100"
              >
                No classification
              </button>
              {projectNodes
                .filter((n) => ['project', 'subprocess', 'task'].includes(n.type))
                .map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      setShowNodePicker(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-700">
                      {getNodeLabel(node)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {node.type} - {getNodePath(node.id)}
                    </div>
                  </button>
                ))}
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-1">
            Optionally tag this record to a project, subprocess, or task.
          </p>
        </div>

        {/* Fields */}
        {fields
          .filter((f: FieldDef) => f.key !== 'name' && f.key !== 'title')
          .map((fieldDef: FieldDef) => (
            <div key={fieldDef.key}>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {fieldDef.label}
                {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput
                fieldDef={fieldDef}
                value={fieldValues[fieldDef.key]}
                onChange={(newValue) => handleFieldChange(fieldDef.key, newValue)}
              />
            </div>
          ))}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!uniqueName.trim() || createRecord.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {createRecord.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create {definition.name}
              </>
            )}
          </button>
        </div>

        {createRecord.isError && (
          <p className="text-sm text-red-600">
            Failed to create record. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}

// Simple field input for creation
interface FieldInputProps {
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldInput({ fieldDef, value, onChange }: FieldInputProps) {
  const type = fieldDef.type || 'text';

  if (type === 'textarea') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={true}
      />
    );
  }

  if (type === 'select' && fieldDef.options) {
    return (
      <select
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        <option value="">Select...</option>
        {fieldDef.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'checkbox') {
    const isChecked = String(value) === 'true';
    return (
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(String(e.target.checked))}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <span className="ml-2 text-sm text-slate-600">{isChecked ? 'Yes' : 'No'}</span>
      </label>
    );
  }

  if (type === 'date') {
    return (
      <input
        type="date"
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
      />
    );
  }

  // Standard input for number, email, url types
  return (
    <input
      type={type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
      value={String(value || '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}
