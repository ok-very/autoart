/**
 * Dropdown - Select dropdown using React Hook Form
 */

import { useFormContext, Controller } from 'react-hook-form';
import type { ModuleBlock } from '@autoart/shared';

interface DropdownProps {
  block: ModuleBlock;
}

export function Dropdown({ block }: DropdownProps) {
  const { control } = useFormContext();
  const options = block.options ?? [];

  return (
    <Controller
      name={block.id}
      control={control}
      defaultValue=""
      render={({ field, fieldState }) => (
        <div className="pub-field">
          <label htmlFor={block.id} className="pub-label">
            {block.label}
            {block.required && <span className="pub-label-required">*</span>}
          </label>
          {block.description && (
            <p className="pub-description">{block.description}</p>
          )}
          <select
            {...field}
            id={block.id}
            className={`pub-input pub-select ${fieldState.error ? 'pub-input--error' : ''}`}
          >
            <option value="">Select an option...</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldState.error && (
            <p className="pub-error">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
