import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button, Select, Toggle, Text, Stack, Spinner, Card } from '@autoart/ui';
import { useRecordDefinitions } from '../../../api/hooks';
import type {
  RecordMapping,
  FormBlock,
  ModuleBlock,
  FieldDef,
  RecordDefinition,
  FieldMapping,
} from '@autoart/shared';

// ==================== TYPES ====================

interface RecordMappingPanelProps {
  /** Form blocks available for mapping */
  blocks: FormBlock[];
  /** Current record mappings */
  recordMappings: RecordMapping[];
  /** Callback when mappings change */
  onChange: (mappings: RecordMapping[]) => void;
}

// ==================== TYPE COMPATIBILITY ====================

/**
 * Determines which ModuleBlock types are compatible with a FieldDef.
 * Used to filter block dropdown options based on the target field type.
 */
function getCompatibleBlockTypes(fieldDef: FieldDef): string[] {
  const { type, renderHint } = fieldDef;

  // Email field → email blocks
  if (renderHint === 'email' || type === 'text' && renderHint === 'email') {
    return ['email', 'short_answer'];
  }

  // Phone field → phone blocks
  if (renderHint === 'phone') {
    return ['phone', 'short_answer'];
  }

  // Date fields → date blocks
  if (type === 'date' || renderHint === 'date') {
    return ['date', 'short_answer'];
  }

  // Number/currency fields → number blocks
  if (type === 'number' || type === 'currency') {
    return ['number', 'short_answer'];
  }

  // Select/status fields → dropdown, multiple_choice
  if (type === 'select' || type === 'status') {
    return ['dropdown', 'multiple_choice', 'short_answer'];
  }

  // Checkbox/tags → checkbox blocks
  if (type === 'checkbox' || type === 'tags') {
    return ['checkbox', 'dropdown', 'short_answer'];
  }

  // Textarea → paragraph blocks
  if (type === 'textarea') {
    return ['paragraph', 'short_answer'];
  }

  // Default text → most input types
  return ['short_answer', 'paragraph', 'email', 'phone', 'number', 'dropdown', 'multiple_choice'];
}

function isBlockCompatible(block: ModuleBlock, fieldDef: FieldDef): boolean {
  const compatibleTypes = getCompatibleBlockTypes(fieldDef);
  return compatibleTypes.includes(block.type);
}

// ==================== HELPERS ====================

function getModuleBlocks(blocks: FormBlock[]): ModuleBlock[] {
  return blocks.filter((b): b is ModuleBlock => b.kind === 'module');
}

function createEmptyMapping(): RecordMapping {
  return {
    id: crypto.randomUUID(),
    definitionId: '',
    createInstance: true,
    fieldMappings: [],
  };
}

// ==================== MAIN COMPONENT ====================

export function RecordMappingPanel({
  blocks,
  recordMappings,
  onChange,
}: RecordMappingPanelProps) {
  const { data: definitions, isLoading } = useRecordDefinitions();

  const moduleBlocks = useMemo(() => getModuleBlocks(blocks), [blocks]);

  // Filter to only record definitions (not action_arrangements or containers)
  const recordDefinitions = useMemo(
    () => definitions?.filter((d) => d.kind === 'record') || [],
    [definitions]
  );

  const handleAddMapping = () => {
    onChange([...recordMappings, createEmptyMapping()]);
  };

  const handleRemoveMapping = (mappingId: string) => {
    onChange(recordMappings.filter((m) => m.id !== mappingId));
  };

  const handleUpdateMapping = (mappingId: string, updates: Partial<RecordMapping>) => {
    onChange(
      recordMappings.map((m) =>
        m.id === mappingId ? { ...m, ...updates } : m
      )
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <Stack gap="md">
      <div className="flex items-center justify-between">
        <Text size="sm" className="text-ws-text-secondary">
          Map form blocks to record fields. Each mapping creates a record when the form is submitted.
        </Text>
        <Button size="sm" variant="secondary" onClick={handleAddMapping}>
          <Plus className="w-4 h-4 mr-1" />
          Add Mapping
        </Button>
      </div>

      {recordMappings.length === 0 ? (
        <div className="text-center py-8 text-ws-text-secondary border border-dashed border-ws-panel-border rounded-lg">
          No record mappings configured. Click "Add Mapping" to create records from form submissions.
        </div>
      ) : (
        <Stack gap="md">
          {recordMappings.map((mapping) => (
            <MappingCard
              key={mapping.id}
              mapping={mapping}
              definitions={recordDefinitions}
              moduleBlocks={moduleBlocks}
              onUpdate={(updates) => handleUpdateMapping(mapping.id, updates)}
              onRemove={() => handleRemoveMapping(mapping.id)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ==================== MAPPING CARD ====================

interface MappingCardProps {
  mapping: RecordMapping;
  definitions: RecordDefinition[];
  moduleBlocks: ModuleBlock[];
  onUpdate: (updates: Partial<RecordMapping>) => void;
  onRemove: () => void;
}

function MappingCard({
  mapping,
  definitions,
  moduleBlocks,
  onUpdate,
  onRemove,
}: MappingCardProps) {
  const selectedDefinition = definitions.find((d) => d.id === mapping.definitionId);
  const fields = selectedDefinition?.schema_config.fields || [];

  const definitionOptions = definitions.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const fieldOptions = fields.map((f) => ({
    value: f.key,
    label: f.label,
  }));

  const handleDefinitionChange = (definitionId: string | null) => {
    // Clear field mappings when definition changes
    onUpdate({
      definitionId: definitionId || '',
      fieldMappings: [],
      nameFieldKey: undefined,
    });
  };

  const handleFieldMappingChange = (fieldKey: string, blockId: string | null) => {
    const existing = mapping.fieldMappings.filter(
      (fm: FieldMapping) => fm.fieldKey !== fieldKey
    );
    if (blockId) {
      onUpdate({
        fieldMappings: [...existing, { fieldKey, blockId }],
      });
    } else {
      onUpdate({ fieldMappings: existing });
    }
  };

  const getBlockOptionsForField = (fieldDef: FieldDef) => {
    const compatible = moduleBlocks.filter((b) => isBlockCompatible(b, fieldDef));
    return compatible.map((b) => ({
      value: b.id,
      label: b.label,
    }));
  };

  const getMappedBlockId = (fieldKey: string): string | null => {
    return (
      mapping.fieldMappings.find((fm: FieldMapping) => fm.fieldKey === fieldKey)
        ?.blockId || null
    );
  };

  return (
    <Card className="p-4 space-y-4">
      {/* Header with remove button */}
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          {/* Definition selector */}
          <Select
            label="Record Definition"
            placeholder="Select a record type..."
            value={mapping.definitionId || null}
            onChange={handleDefinitionChange}
            data={definitionOptions}
          />

          {/* Create instance toggle */}
          <div className="flex items-center gap-3">
            <Toggle
              checked={mapping.createInstance}
              onChange={(checked) => onUpdate({ createInstance: checked })}
              size="sm"
            />
            <Text size="sm">Create record on submission</Text>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="text-ws-color-error hover:bg-ws-color-error/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Field mappings */}
      {selectedDefinition && fields.length > 0 && (
        <div className="border-t border-ws-panel-border pt-4 space-y-3">
          <Text size="sm" weight="medium">Field Mappings</Text>

          {/* Name field selector */}
          <Select
            label="Record Name Field"
            description="Which field value becomes the record's unique name"
            placeholder="Select field..."
            value={mapping.nameFieldKey || null}
            onChange={(value) => onUpdate({ nameFieldKey: value || undefined })}
            data={fieldOptions}
            size="sm"
          />

          {/* Individual field → block mappings */}
          <div className="space-y-2">
            {fields.map((field) => {
              const blockOptions = getBlockOptionsForField(field);
              const hasCompatibleBlocks = blockOptions.length > 0;

              return (
                <div key={field.key} className="grid grid-cols-2 gap-2 items-center">
                  <Text size="sm" className="text-ws-fg">
                    {field.label}
                    {field.required && <span className="text-ws-color-error ml-1">*</span>}
                  </Text>
                  {hasCompatibleBlocks ? (
                    <Select
                      placeholder="Select block..."
                      value={getMappedBlockId(field.key)}
                      onChange={(blockId) => handleFieldMappingChange(field.key, blockId)}
                      data={blockOptions}
                      size="sm"
                    />
                  ) : (
                    <Text size="sm" className="text-ws-text-disabled italic">
                      No compatible blocks
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state when no definition selected */}
      {!selectedDefinition && (
        <Text size="sm" className="text-ws-text-secondary italic">
          Select a record definition to configure field mappings.
        </Text>
      )}
    </Card>
  );
}
