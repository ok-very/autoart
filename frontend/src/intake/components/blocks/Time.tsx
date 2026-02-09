/**
 * Time - Time input block using React Hook Form
 */

import { useFormContext, Controller } from 'react-hook-form';
import type { ModuleBlock } from '@autoart/shared';

interface TimeProps {
  block: ModuleBlock;
}

export function TimeInput({ block }: TimeProps) {
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
            type="time"
            className={`pub-input ${fieldState.error ? 'pub-input--error' : ''}`}
            aria-required={block.required || undefined}
            aria-invalid={fieldState.error ? true : undefined}
            aria-describedby={fieldState.error ? `${block.id}-error` : undefined}
          />
          {fieldState.error && (
            <p id={`${block.id}-error`} className="pub-error">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
