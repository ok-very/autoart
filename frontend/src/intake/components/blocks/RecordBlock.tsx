/**
 * RecordBlock - Renders fields from a RecordDefinition
 *
 * Fetches the definition from the backend and renders each field
 * using the appropriate block component. Field values are registered
 * with react-hook-form using IDs formatted as {blockId}:{fieldKey}
 * for implicit mapping on submission.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFormContext, Controller } from 'react-hook-form';
import type { RecordBlock as RecordBlockType } from '@autoart/shared';
import { fetchRecordDefinition, type RecordDefinitionField } from '../../api';
import { useIntakeFormContext } from '../../context/IntakeFormContext';

interface RecordBlockProps {
  block: RecordBlockType;
}

/**
 * TagsInput - Multi-select tag input for tags field type
 */
function TagsInput({
  value,
  onChange,
  options,
  hasError,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options?: string[];
  hasError?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = inputValue.trim();
      if (tag && !value.includes(tag)) {
        onChange([...value, tag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleOptionClick = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((v) => v !== tag));
  };

  return (
    <div className="flex flex-col gap-pub-2">
      {/* Selected tags */}
      <div className={`pub-input flex flex-wrap gap-2 min-h-[42px] ${hasError ? 'pub-input--error' : ''}`}>
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-pub-accent text-pub-accent-fg text-pub-meta rounded"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:opacity-70"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        {!options && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? 'Type and press Enter...' : ''}
            className="flex-1 min-w-[100px] bg-transparent border-none outline-none"
          />
        )}
      </div>

      {/* Predefined options as clickable chips */}
      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleOptionClick(opt)}
              className={`px-3 py-1 text-pub-meta rounded-full border transition-colors ${
                value.includes(opt)
                  ? 'bg-pub-accent text-pub-accent-fg border-pub-accent'
                  : 'bg-transparent text-pub-fg border-pub-input-border hover:border-pub-accent'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Field types that should be skipped in public intake forms.
 * These are either readonly (computed, rollup) or require internal data (link, user).
 */
const SKIPPED_FIELD_TYPES = ['computed', 'rollup', 'link', 'user'];

/**
 * Maps FieldDef.type to the appropriate input component/type.
 * Returns null for field types that should be skipped.
 */
function mapFieldType(field: RecordDefinitionField): {
  inputType: 'text' | 'email' | 'url' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'tags';
  options?: string[];
} | null {
  // Skip readonly/internal types
  if (SKIPPED_FIELD_TYPES.includes(field.type)) {
    return null;
  }

  // Check renderHint first for semantic types
  if (field.renderHint === 'email' || field.type === 'email') {
    return { inputType: 'email' };
  }
  if (field.renderHint === 'phone') {
    return { inputType: 'text' };
  }
  if (field.renderHint === 'url' || field.type === 'url') {
    return { inputType: 'url' };
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
    case 'tags':
      return { inputType: 'tags', options: field.options };
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
  const mapping = mapFieldType(field);

  // Skip fields that shouldn't be rendered in public forms
  if (!mapping) {
    return null;
  }

  const { inputType, options } = mapping;

  return (
    <Controller
      name={fieldId}
      control={control}
      defaultValue={inputType === 'tags' ? [] : ''}
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
          ) : inputType === 'tags' ? (
            <TagsInput
              value={Array.isArray(rhfField.value) ? rhfField.value : []}
              onChange={rhfField.onChange}
              options={options}
              hasError={!!fieldState.error}
            />
          ) : (
            <input
              {...rhfField}
              id={fieldId}
              type={inputType === 'url' ? 'url' : inputType}
              placeholder={inputType === 'url' ? 'https://' : undefined}
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
