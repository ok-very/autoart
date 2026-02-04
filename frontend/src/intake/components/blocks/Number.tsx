/**
 * Number - Numeric input block using React Hook Form
 */

import { useFormContext, Controller } from 'react-hook-form';
import type { ModuleBlock } from '@autoart/shared';

interface NumberProps {
  block: ModuleBlock;
}

export function NumberInput({ block }: NumberProps) {
  const { control } = useFormContext();

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
          <input
            {...field}
            id={block.id}
            type="number"
            placeholder={block.placeholder}
            className={`pub-input ${fieldState.error ? 'pub-input--error' : ''}`}
          />
          {fieldState.error && (
            <p className="pub-error">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
