/**
 * AddFieldView
 *
 * Overlay view for adding new fields to a definition.
 * Shows all field types with visual previews using bespoke components.
 */

import {
  Type, AlignLeft, Hash, Mail, Link2, Calendar, List, CheckCircle,
  ToggleLeft, Percent, Tags, User, FileText
} from 'lucide-react';
import { useState } from 'react';

import { useUIStore } from '@/stores';
import type { FieldDef } from '@/types';

import type { OverlayProps, AddFieldContext } from '../../../overlay/types';
import { Badge } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Checkbox } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { ProgressBar } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { TextInput } from '@autoart/ui';

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
        <Inline gap="xs">
          <Badge variant="default">Not Started</Badge>
          <Badge variant="project">In Progress</Badge>
          <Badge variant="task">Complete</Badge>
        </Inline>
      );
    case 'percent':
      return (
        <Inline gap="xs" className="w-32">
          <ProgressBar
            segments={[{ key: 'progress', percentage: 65, color: '#3b82f6', label: 'Progress', count: 65 }]}
            height={8}
            showTooltip={false}
            className="flex-1"
          />
          <Text size="xs" color="muted">65%</Text>
        </Inline>
      );
    case 'tags':
      return (
        <Inline gap="xs">
          <Badge variant="light">Tag 1</Badge>
          <Badge variant="light">Tag 2</Badge>
        </Inline>
      );
    case 'user':
      return (
        <Inline gap="xs">
          <div className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-medium">J</div>
          <Text size="xs">John Doe</Text>
        </Inline>
      );
    case 'date':
      return <Text size="xs" color="muted">Jan 15, 2025</Text>;
    case 'checkbox':
      return <Checkbox checked readOnly label="Yes" />;
    case 'textarea':
      return <Text size="xs" color="muted" truncate>Rich text with formatting...</Text>;
    default:
      return <Text size="xs" color="muted">Sample value</Text>;
  }
}

// ============================================================================
// PROPS
// ============================================================================

// Legacy props interface (deprecated - use OverlayProps)
interface LegacyAddFieldViewProps {
  onSubmit: (field: FieldDef) => void;
  isPending?: boolean;
}

// New contract props
type AddFieldViewProps = OverlayProps<AddFieldContext & { onFieldSubmit?: (field: FieldDef) => void; isPending?: boolean }, { field: FieldDef }>;

// Type guard to detect legacy vs new props
function isOverlayProps(props: unknown): props is AddFieldViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props && 'onClose' in props;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddFieldView(props: AddFieldViewProps | LegacyAddFieldViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isOverlayProps(props);
  const legacyOnSubmit = !isNewContract ? props.onSubmit : undefined;
  const isPending = isNewContract ? props.context.isPending : props.isPending;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const { closeOverlay } = useUIStore();
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
      closeOverlay();
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
      closeOverlay();
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
      <Text size="sm" color="muted" className="mb-6">
        Define a new field for this record type. Choose a field type to see how it will be displayed.
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Field Type Selection */}
          <div>
            <Text size="sm" weight="medium" className="mb-2">Field Type</Text>
            <div className="grid grid-cols-3 gap-2">
              {FIELD_TYPES.map((ft) => (
                <div
                  key={ft.value}
                  className={`cursor-pointer transition-all bg-white border rounded-lg p-3 ${
                    type === ft.value
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() => setType(ft.value)}
                >
                  <Inline gap="xs" className="mb-1">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      type === ft.value ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ft.icon}
                    </div>
                    <Text size="sm" weight="medium">{ft.label}</Text>
                  </Inline>
                  <Text size="xs" color="muted">{ft.description}</Text>
                </div>
              ))}
            </div>
          </div>

          {/* Field Preview */}
          {selectedType && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <Text size="xs" weight="medium" color="muted" className="mb-2">Preview</Text>
              <FieldTypePreview type={type} />
            </div>
          )}

          {/* Field Details */}
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Label"
              placeholder="e.g., Email Address"
              value={label}
              onChange={(e) => handleLabelChange(e.currentTarget.value)}
              required
              autoFocus
            />

            <div className="flex flex-col gap-1">
              <TextInput
                label="Field Key"
                placeholder="e.g., email_address"
                value={key}
                onChange={(e) => setKey(e.currentTarget.value)}
                required
                className="font-mono"
              />
              <Text size="xs" color="muted">
                Reference: <code className="bg-slate-100 px-1 rounded text-xs">#record:{key || 'field_key'}</code>
              </Text>
            </div>
          </div>

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
            onChange={(checked) => setRequired(checked)}
          />

          {/* Actions */}
          <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!key.trim() || !label.trim() || isPending}
            >
              {isPending ? 'Adding...' : 'Add Field'}
            </Button>
          </Inline>
        </Stack>
      </form>
    </div>
  );
}
