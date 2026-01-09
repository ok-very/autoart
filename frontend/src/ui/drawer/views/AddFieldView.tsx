/**
 * AddFieldView
 *
 * Drawer view for adding new fields to a definition.
 * Shows all field types with visual previews using Mantine components.
 */

import { useState } from 'react';
import {
  TextInput, Button, Group, Stack, Text, Checkbox, Paper,
  SimpleGrid, Badge, Progress, ThemeIcon, Code
} from '@mantine/core';
import {
  Type, AlignLeft, Hash, Mail, Link2, Calendar, List, CheckCircle,
  ToggleLeft, Percent, Tags, User, FileText
} from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import type { FieldDef } from '../../../types';
import type { DrawerProps, AddFieldContext } from '../../../drawer/types';

// ============================================================================
// FIELD TYPE DEFINITIONS
// ============================================================================

interface FieldTypeConfig {
  value: FieldDef['type'];
  label: string;
  description: string;
  icon: React.ReactNode;
  /** Maps to DataFieldKind for rendering */
  renderHint: string;
  /** Whether this type needs options */
  hasOptions?: boolean;
  /** Placeholder for options input */
  optionsPlaceholder?: string;
}

const FIELD_TYPES: FieldTypeConfig[] = [
  {
    value: 'text',
    label: 'Text',
    description: 'Single line of text',
    icon: <Type size={16} />,
    renderHint: 'text',
  },
  {
    value: 'textarea',
    label: 'Rich Text',
    description: 'Formatted multi-line text',
    icon: <AlignLeft size={16} />,
    renderHint: 'description',
  },
  {
    value: 'number',
    label: 'Number',
    description: 'Numeric value',
    icon: <Hash size={16} />,
    renderHint: 'text',
  },
  {
    value: 'email',
    label: 'Email',
    description: 'Email address',
    icon: <Mail size={16} />,
    renderHint: 'text',
  },
  {
    value: 'url',
    label: 'URL',
    description: 'Web link',
    icon: <Link2 size={16} />,
    renderHint: 'text',
  },
  {
    value: 'date',
    label: 'Date',
    description: 'Calendar date',
    icon: <Calendar size={16} />,
    renderHint: 'date',
  },
  {
    value: 'select',
    label: 'Select',
    description: 'Dropdown with options',
    icon: <List size={16} />,
    renderHint: 'text',
    hasOptions: true,
    optionsPlaceholder: 'Option 1, Option 2, Option 3',
  },
  {
    value: 'status',
    label: 'Status',
    description: 'Colored status indicator',
    icon: <CheckCircle size={16} />,
    renderHint: 'status',
    hasOptions: true,
    optionsPlaceholder: 'not_started, in_progress, complete',
  },
  {
    value: 'checkbox',
    label: 'Checkbox',
    description: 'True/false toggle',
    icon: <ToggleLeft size={16} />,
    renderHint: 'text',
  },
  {
    value: 'percent',
    label: 'Percent',
    description: 'Progress percentage (0-100)',
    icon: <Percent size={16} />,
    renderHint: 'percent',
  },
  {
    value: 'tags',
    label: 'Tags',
    description: 'Multiple text tags',
    icon: <Tags size={16} />,
    renderHint: 'tags',
  },
  {
    value: 'link',
    label: 'Record Link',
    description: 'Reference to another record',
    icon: <FileText size={16} />,
    renderHint: 'text',
  },
  {
    value: 'user',
    label: 'User',
    description: 'User assignment',
    icon: <User size={16} />,
    renderHint: 'user',
  },
];

// ============================================================================
// FIELD TYPE PREVIEW
// ============================================================================

function FieldTypePreview({ type }: { type: FieldDef['type'] }) {
  switch (type) {
    case 'status':
      return (
        <Group gap={4}>
          <Badge size="sm" color="gray">Not Started</Badge>
          <Badge size="sm" color="blue">In Progress</Badge>
          <Badge size="sm" color="green">Complete</Badge>
        </Group>
      );
    case 'percent':
      return (
        <Group gap="xs" className="w-32">
          <Progress value={65} size="sm" className="flex-1" />
          <Text size="xs" c="dimmed">65%</Text>
        </Group>
      );
    case 'tags':
      return (
        <Group gap={4}>
          <Badge size="xs" variant="light" color="gray">Tag 1</Badge>
          <Badge size="xs" variant="light" color="gray">Tag 2</Badge>
        </Group>
      );
    case 'user':
      return (
        <Group gap={4}>
          <ThemeIcon size="xs" radius="xl" color="blue">J</ThemeIcon>
          <Text size="xs">John Doe</Text>
        </Group>
      );
    case 'date':
      return <Text size="xs" c="dimmed">Jan 15, 2025</Text>;
    case 'checkbox':
      return <Checkbox size="xs" checked readOnly label="Yes" />;
    case 'textarea':
      return <Text size="xs" c="dimmed" lineClamp={1}>Rich text with formatting...</Text>;
    default:
      return <Text size="xs" c="dimmed">Sample value</Text>;
  }
}

// ============================================================================
// PROPS
// ============================================================================

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyAddFieldViewProps {
  onSubmit: (field: FieldDef) => void;
  isPending?: boolean;
}

// New contract props
type AddFieldViewProps = DrawerProps<AddFieldContext & { onFieldSubmit?: (field: FieldDef) => void; isPending?: boolean }, { field: FieldDef }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is AddFieldViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props && 'onClose' in props;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddFieldView(props: AddFieldViewProps | LegacyAddFieldViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const legacyOnSubmit = !isNewContract ? props.onSubmit : undefined;
  const isPending = isNewContract ? props.context.isPending : props.isPending;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const { closeDrawer } = useUIStore();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldDef['type']>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !label.trim()) return;

    const selectedType = FIELD_TYPES.find(ft => ft.value === type);

    const field: FieldDef = {
      key: key.trim().toLowerCase().replace(/\s+/g, '_'),
      label: label.trim(),
      type,
      required,
      // Include renderHint for semantic display
      renderHint: selectedType?.renderHint,
    };

    if (selectedType?.hasOptions && options.trim()) {
      field.options = options.split(',').map((o) => o.trim()).filter(Boolean);
    }

    if (onSubmit) {
      // New contract: emit typed result
      onSubmit({
        success: true,
        data: { field },
        sideEffects: [{ type: 'update', entityType: 'definition' }],
      });
    } else if (legacyOnSubmit) {
      // Legacy: call callback and close
      legacyOnSubmit(field);
      closeDrawer();
    }
  };

  // Auto-generate key from label
  const handleLabelChange = (value: string) => {
    setLabel(value);
    if (!key || key === label.toLowerCase().replace(/\s+/g, '_')) {
      setKey(value.toLowerCase().replace(/\s+/g, '_'));
    }
  };

  const selectedType = FIELD_TYPES.find(ft => ft.value === type);

  return (
    <div className="max-w-3xl mx-auto">
      <Text size="sm" c="dimmed" mb="lg">
        Define a new field for this record type. Choose a field type to see how it will be displayed.
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Field Type Selection */}
          <div>
            <Text size="sm" fw={500} mb="xs">Field Type</Text>
            <SimpleGrid cols={3} spacing="xs">
              {FIELD_TYPES.map((ft) => (
                <Paper
                  key={ft.value}
                  withBorder
                  p="sm"
                  radius="sm"
                  className={`cursor-pointer transition-all ${
                    type === ft.value
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() => setType(ft.value)}
                >
                  <Group gap="xs" mb={4}>
                    <ThemeIcon
                      size="sm"
                      variant={type === ft.value ? 'filled' : 'light'}
                      color={type === ft.value ? 'blue' : 'gray'}
                    >
                      {ft.icon}
                    </ThemeIcon>
                    <Text size="sm" fw={500}>{ft.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">{ft.description}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </div>

          {/* Field Preview */}
          {selectedType && (
            <Paper withBorder p="sm" radius="sm" className="bg-slate-50">
              <Text size="xs" fw={500} c="dimmed" mb="xs">Preview</Text>
              <FieldTypePreview type={type} />
            </Paper>
          )}

          {/* Field Details */}
          <SimpleGrid cols={2} spacing="md">
            <TextInput
              label="Label"
              placeholder="e.g., Email Address"
              value={label}
              onChange={(e) => handleLabelChange(e.currentTarget.value)}
              required
              autoFocus
            />

            <TextInput
              label="Field Key"
              placeholder="e.g., email_address"
              value={key}
              onChange={(e) => setKey(e.currentTarget.value)}
              required
              description={
                <Text size="xs" c="dimmed">
                  Reference: <Code>#record:{key || 'field_key'}</Code>
                </Text>
              }
              styles={{ input: { fontFamily: 'monospace' } }}
            />
          </SimpleGrid>

          {/* Options for select/status types */}
          {selectedType?.hasOptions && (
            <TextInput
              label={type === 'status' ? 'Status Options' : 'Options'}
              placeholder={selectedType.optionsPlaceholder}
              value={options}
              onChange={(e) => setOptions(e.currentTarget.value)}
              description={
                type === 'status'
                  ? 'Comma-separated. Colors are auto-assigned based on names (e.g., complete = green)'
                  : 'Comma-separated list of options'
              }
            />
          )}

          {/* Required checkbox */}
          <Checkbox
            label="Required field"
            checked={required}
            onChange={(e) => setRequired(e.currentTarget.checked)}
          />

          {/* Actions */}
          <Group justify="flex-end" gap="sm" pt="md" className="border-t border-slate-100">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!key.trim() || !label.trim()}
              loading={isPending}
            >
              Add Field
            </Button>
          </Group>
        </Stack>
      </form>
    </div>
  );
}
