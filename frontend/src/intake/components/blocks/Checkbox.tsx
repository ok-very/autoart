/**
 * Checkbox - Checkbox group using React Hook Form
 */

import { useFormContext, Controller } from 'react-hook-form';
import type { ModuleBlock } from '@autoart/shared';

interface CheckboxProps {
  block: ModuleBlock;
}

export function Checkbox({ block }: CheckboxProps) {
  const { control } = useFormContext();
  const options = block.options ?? [];

  return (
    <Controller
      name={block.id}
      control={control}
      defaultValue={[]}
      render={({ field, fieldState }) => {
        const selectedValues = (field.value as string[]) || [];

        const handleChange = (option: string, checked: boolean) => {
          if (checked) {
            field.onChange([...selectedValues, option]);
          } else {
            field.onChange(selectedValues.filter((v) => v !== option));
          }
        };

        return (
          <div className="pub-field">
            <p className="pub-label">
              {block.label}
              {block.required && <span className="pub-label-required">*</span>}
            </p>
            {block.description && (
              <p className="pub-description">{block.description}</p>
            )}
            <div className="flex flex-col gap-2">
              {options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={(e) => handleChange(option, e.target.checked)}
                    className="pub-checkbox"
                  />
                  <span className="text-pub-fg">{option}</span>
                </label>
              ))}
            </div>
            {fieldState.error && (
              <p className="pub-error">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
