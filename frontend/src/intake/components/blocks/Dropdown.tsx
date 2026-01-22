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
        <div className="space-y-2">
          <label htmlFor={block.id} className="block text-sm font-medium text-slate-700">
            {block.label}
            {block.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {block.description && (
            <p className="text-sm text-slate-500">{block.description}</p>
          )}
          <select
            {...field}
            id={block.id}
            className={`w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldState.error ? 'border-red-500' : 'border-slate-300'
              }`}
          >
            <option value="">Select an option...</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldState.error && (
            <p className="text-sm text-red-500">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
