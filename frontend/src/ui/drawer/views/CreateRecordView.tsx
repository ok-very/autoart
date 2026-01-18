/**
 * CreateRecordView
 *
 * Drawer view for creating new records. Uses bespoke components.
 */

import { Plus, FolderTree, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  useRecordDefinition,
  useCreateRecord,
  useProjectTree,
} from '@/api/hooks';
import { useUIStore } from '@/stores';
import type { FieldDef, HierarchyNode } from '@/types';

import type { DrawerProps, CreateRecordContext } from '../../../drawer/types';
import { Button } from '@autoart/ui';
import { Checkbox } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Select } from '@autoart/ui';
import { Spinner } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { TextInput } from '@autoart/ui';
import { RichTextInput } from '../../editor/RichTextInput';

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
  const [nodeDropdownOpen, setNodeDropdownOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (!definition) {
    return (
      <Text color="dimmed" className="text-center py-8">
        Definition not found
      </Text>
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

  const classifiableNodes = projectNodes?.filter((n) =>
    ['project', 'subprocess', 'task'].includes(n.type)
  ) || [];

  const icon = definition.styling?.icon;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <Inline gap="md" className="mb-6">
        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
          <Text size="xl">{icon || definition.name.charAt(0).toUpperCase()}</Text>
        </div>
        <div>
          <Text size="xs" weight="bold" color="dimmed" className="uppercase">
            Create New
          </Text>
          <Text size="xl" weight="bold">{definition.name}</Text>
        </div>
      </Inline>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Unique Name */}
          <TextInput
            label="Name"
            placeholder={`Enter ${definition.name.toLowerCase()} name...`}
            value={uniqueName}
            onChange={(e) => setUniqueName(e.currentTarget.value)}
            required
            autoFocus
          />

          {/* Classification Node Selector */}
          <div>
            <Inline gap="xs" className="mb-1">
              <FolderTree size={12} className="text-slate-500" />
              <Text size="xs" weight="medium" color="dimmed">
                Classify Under
              </Text>
            </Inline>

            {selectedNode ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <Inline justify="between">
                  <div className="min-w-0 flex-1">
                    <Text size="sm" weight="medium" truncate>
                      {getNodeLabel(selectedNode)}
                    </Text>
                    <Text size="xs" color="dimmed" truncate>
                      {getNodePath(selectedNode.id)}
                    </Text>
                  </div>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    onClick={() => setSelectedNodeId(null)}
                    className="p-1"
                  >
                    <X size={14} />
                  </Button>
                </Inline>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNodeDropdownOpen(!nodeDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                >
                  <Text size="sm" color="dimmed">
                    Select a project/task to classify under (optional)
                  </Text>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>

                {nodeDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-auto">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        setSelectedNodeId(null);
                        setNodeDropdownOpen(false);
                      }}
                    >
                      <Text size="sm" color="dimmed">No classification</Text>
                    </button>
                    {classifiableNodes.map((node) => (
                      <button
                        type="button"
                        key={node.id}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setNodeDropdownOpen(false);
                        }}
                      >
                        <Text size="sm" weight="medium">{getNodeLabel(node)}</Text>
                        <Text size="xs" color="dimmed" as="div">
                          {node.type} - {getNodePath(node.id)}
                        </Text>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Text size="xs" color="dimmed" className="mt-1">
              Optionally tag this record to a project, subprocess, or task.
            </Text>
          </div>

          {/* Fields */}
          {fields
            .filter((f: FieldDef) => f.key !== 'name' && f.key !== 'title')
            .map((fieldDef: FieldDef) => (
              <FieldInput
                key={fieldDef.key}
                fieldDef={fieldDef}
                value={fieldValues[fieldDef.key]}
                onChange={(newValue) => handleFieldChange(fieldDef.key, newValue)}
              />
            ))}

          {/* Actions */}
          <Inline justify="end" gap="sm" className="pt-4 mt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!uniqueName.trim() || createRecord.isPending}
              leftSection={createRecord.isPending ? <Spinner size="sm" /> : <Plus size={16} />}
            >
              Create {definition.name}
            </Button>
          </Inline>

          {createRecord.isError && (
            <Text size="sm" color="error">
              Failed to create record. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </div>
  );
}

// Field input component using bespoke components
interface FieldInputProps {
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldInput({ fieldDef, value, onChange }: FieldInputProps) {
  const type = fieldDef.type || 'text';

  if (type === 'textarea') {
    return (
      <div>
        <Text size="xs" weight="medium" color="dimmed" className="mb-1">
          {fieldDef.label}
          {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
        </Text>
        <RichTextInput
          value={value}
          onChange={onChange}
          multiline={true}
        />
      </div>
    );
  }

  if (type === 'select' && fieldDef.options) {
    const selectData = fieldDef.options.map((opt: string | { value: string; label: string }) => 
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
    return (
      <Select
        label={fieldDef.label}
        placeholder="Select..."
        value={String(value || '')}
        onChange={(val) => onChange(val)}
        data={selectData}
      />
    );
  }

  if (type === 'checkbox') {
    const isChecked = String(value) === 'true';
    return (
      <Checkbox
        label={fieldDef.label}
        checked={isChecked}
        onChange={(checked) => onChange(String(checked))}
      />
    );
  }

  if (type === 'date') {
    return (
      <TextInput
        type="date"
        label={fieldDef.label}
        value={String(value || '')}
        onChange={(e) => onChange(e.currentTarget.value)}
        required={fieldDef.required}
      />
    );
  }

  if (type === 'text') {
    return (
      <div>
        <Text size="xs" weight="medium" color="dimmed" className="mb-1">
          {fieldDef.label}
          {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
        </Text>
        <RichTextInput
          value={value}
          onChange={onChange}
          multiline={false}
        />
      </div>
    );
  }

  // Standard input for number, email, url types
  return (
    <TextInput
      type={type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
      label={fieldDef.label}
      value={String(value || '')}
      onChange={(e) => onChange(e.currentTarget.value)}
      required={fieldDef.required}
    />
  );
}
