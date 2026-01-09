/**
 * CreateRecordView
 *
 * Drawer view for creating new records. Uses Mantine form components.
 */

import { useState } from 'react';
import {
  TextInput, Select, Button, Group, Stack, Text, Paper, Loader,
  Checkbox, ThemeIcon, Combobox, InputBase, useCombobox, ScrollArea
} from '@mantine/core';
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

  // Combobox for node selection
  const nodeCombobox = useCombobox({
    onDropdownClose: () => nodeCombobox.resetSelectedOption(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="md" />
      </div>
    );
  }

  if (!definition) {
    return (
      <Text c="dimmed" ta="center" py="xl">
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
      <Group gap="md" mb="lg">
        <ThemeIcon size="xl" radius="md" variant="light" color="blue">
          <Text size="xl">{icon || definition.name.charAt(0).toUpperCase()}</Text>
        </ThemeIcon>
        <div>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Create New
          </Text>
          <Text size="xl" fw={700}>{definition.name}</Text>
        </div>
      </Group>

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
            <Text size="xs" fw={500} c="dimmed" mb={4}>
              <Group gap={4}>
                <FolderTree size={12} />
                Classify Under
              </Group>
            </Text>

            {selectedNode ? (
              <Paper withBorder p="sm" radius="sm" className="bg-slate-50">
                <Group justify="space-between">
                  <div className="min-w-0 flex-1">
                    <Text size="sm" fw={500} truncate>
                      {getNodeLabel(selectedNode)}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {getNodePath(selectedNode.id)}
                    </Text>
                  </div>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    onClick={() => setSelectedNodeId(null)}
                    p={4}
                  >
                    <X size={14} />
                  </Button>
                </Group>
              </Paper>
            ) : (
              <Combobox
                store={nodeCombobox}
                onOptionSubmit={(val) => {
                  setSelectedNodeId(val === '__none__' ? null : val);
                  nodeCombobox.closeDropdown();
                }}
              >
                <Combobox.Target>
                  <InputBase
                    component="button"
                    type="button"
                    pointer
                    rightSection={<Combobox.Chevron />}
                    onClick={() => nodeCombobox.toggleDropdown()}
                    className="text-left"
                  >
                    <Text size="sm" c="dimmed">
                      Select a project/task to classify under (optional)
                    </Text>
                  </InputBase>
                </Combobox.Target>

                <Combobox.Dropdown>
                  <ScrollArea.Autosize mah={200}>
                    <Combobox.Options>
                      <Combobox.Option value="__none__">
                        <Text size="sm" c="dimmed">No classification</Text>
                      </Combobox.Option>
                      {classifiableNodes.map((node) => (
                        <Combobox.Option key={node.id} value={node.id}>
                          <Text size="sm" fw={500}>{getNodeLabel(node)}</Text>
                          <Text size="xs" c="dimmed">
                            {node.type} - {getNodePath(node.id)}
                          </Text>
                        </Combobox.Option>
                      ))}
                    </Combobox.Options>
                  </ScrollArea.Autosize>
                </Combobox.Dropdown>
              </Combobox>
            )}

            <Text size="xs" c="dimmed" mt={4}>
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
          <Group justify="flex-end" gap="sm" pt="md" mt="sm" className="border-t border-slate-100">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!uniqueName.trim()}
              loading={createRecord.isPending}
              leftSection={!createRecord.isPending && <Plus size={16} />}
            >
              Create {definition.name}
            </Button>
          </Group>

          {createRecord.isError && (
            <Text size="sm" c="red">
              Failed to create record. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </div>
  );
}

// Field input component using Mantine
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
        <Text size="xs" fw={500} c="dimmed" mb={4}>
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
    return (
      <Select
        label={fieldDef.label}
        placeholder="Select..."
        value={String(value || '')}
        onChange={(val) => onChange(val)}
        data={fieldDef.options}
        required={fieldDef.required}
        clearable
      />
    );
  }

  if (type === 'checkbox') {
    const isChecked = String(value) === 'true';
    return (
      <Checkbox
        label={fieldDef.label}
        checked={isChecked}
        onChange={(e) => onChange(String(e.currentTarget.checked))}
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
        <Text size="xs" fw={500} c="dimmed" mb={4}>
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
