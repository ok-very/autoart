/**
 * RecordBlock - Renders fields from a RecordDefinition
 *
 * Fetches the definition from the backend and renders each field
 * using the appropriate block component. Field values are registered
 * with react-hook-form using IDs formatted as {blockId}:{fieldKey}
 * for implicit mapping on submission.
 */

import { useQuery } from '@tanstack/react-query';
import { useFormContext, Controller } from 'react-hook-form';
import type { RecordBlock as RecordBlockType } from '@autoart/shared';
import { fetchRecordDefinition, type RecordDefinitionField } from '../../api';
import { useIntakeFormContext } from '../../context/IntakeFormContext';

interface RecordBlockProps {
  block: RecordBlockType;
}

/**
 * Maps FieldDef.type to the appropriate input component/type
 */
function mapFieldType(field: RecordDefinitionField): {
  inputType: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  options?: string[];
} {
  // Check renderHint first for semantic types
  if (field.renderHint === 'email' || field.type === 'email') {
    return { inputType: 'email' };
  }
  if (field.renderHint === 'phone') {
    return { inputType: 'text' };
  }

  switch (field.type) {
    case 'text':
      return { inputType: 'text' };
    case 'textarea':
      return { inputType: 'textarea' };
    case 'number':
    case 'currency':
    case 'percent':
      return { inputType: 'number' };
    case 'date':
      return { inputType: 'date' };
    case 'select':
    case 'status':
      return { inputType: 'select', options: field.options };
    case 'checkbox':
      return { inputType: 'checkbox' };
    default:
      return { inputType: 'text' };
  }
}

/**
 * Renders a single field from the definition
 */
function DefinitionField({
  field,
  blockId,
}: {
  field: RecordDefinitionField;
  blockId: string;
}) {
  const { control } = useFormContext();
  const fieldId = `${blockId}:${field.key}`;
  const { inputType, options } = mapFieldType(field);

  return (
    <Controller
      name={fieldId}
      control={control}
      defaultValue=""
      render={({ field: rhfField, fieldState }) => (
        <div className="pub-field">
          <label htmlFor={fieldId} className="pub-label">
            {field.label}
            {field.required && <span className="pub-label-required">*</span>}
          </label>

          {inputType === 'textarea' ? (
            <textarea
              {...rhfField}
              id={fieldId}
              rows={3}
              className={`pub-input pub-textarea ${fieldState.error ? 'pub-input--error' : ''}`}
            />
          ) : inputType === 'select' && options ? (
            <select
              {...rhfField}
              id={fieldId}
              className={`pub-input pub-select ${fieldState.error ? 'pub-input--error' : ''}`}
            >
              <option value="">Select...</option>
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : inputType === 'checkbox' ? (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id={fieldId}
                checked={!!rhfField.value}
                onChange={(e) => rhfField.onChange(e.target.checked)}
                onBlur={rhfField.onBlur}
                className="pub-checkbox"
              />
            </div>
          ) : (
            <input
              {...rhfField}
              id={fieldId}
              type={inputType}
              className={`pub-input ${fieldState.error ? 'pub-input--error' : ''}`}
            />
          )}

          {fieldState.error && (
            <p className="pub-error">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}

export function RecordBlock({ block }: RecordBlockProps) {
  const { formUniqueId } = useIntakeFormContext();

  const {
    data: definition,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['recordDefinition', formUniqueId, block.definitionId],
    queryFn: () => fetchRecordDefinition(formUniqueId, block.definitionId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="pub-section">
        <div className="flex items-center gap-3">
          <div className="pub-spinner" style={{ width: 20, height: 20 }} />
          <span className="text-pub-text-secondary">Loading fields...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !definition) {
    return (
      <div className="pub-section">
        <div className="text-pub-error">
          <p className="font-medium">Unable to load record fields</p>
          <p className="text-pub-meta mt-pub-1">
            {error instanceof Error ? error.message : 'Definition not found'}
          </p>
        </div>
      </div>
    );
  }

  // No fields
  if (!definition.fields || definition.fields.length === 0) {
    return (
      <div className="pub-section">
        <h4 className="pub-section-header">{block.label || definition.name}</h4>
        <p className="pub-description">No fields defined.</p>
      </div>
    );
  }

  return (
    <div className="pub-section">
      <h4 className="pub-section-header">{block.label || definition.name}</h4>

      <div className="flex flex-col gap-pub-4">
        {definition.fields.map((field) => (
          <DefinitionField
            key={field.key}
            field={field}
            blockId={block.id}
          />
        ))}
      </div>

      {block.createInstance && (
        <p className="text-pub-micro text-pub-muted mt-pub-4">
          A new {definition.name} record will be created on submission.
        </p>
      )}
    </div>
  );
}
