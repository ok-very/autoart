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
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ws-text-secondary">
              {block.label}
              {block.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {block.description && (
              <p className="text-sm text-ws-text-secondary">{block.description}</p>
            )}
            <div className="space-y-2">
              {options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-ws-bg"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={(e) => handleChange(option, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-ws-text-secondary">{option}</span>
                </label>
              ))}
            </div>
            {fieldState.error && (
              <p className="text-sm text-red-500">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
