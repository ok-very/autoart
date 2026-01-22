/**
 * MultipleChoice - Radio button group using React Hook Form
 */

import { useFormContext, Controller } from 'react-hook-form';
import type { ModuleBlock } from '@autoart/shared';

interface MultipleChoiceProps {
  block: ModuleBlock;
}

export function MultipleChoice({ block }: MultipleChoiceProps) {
  const { control } = useFormContext();
  const options = block.options ?? [];

  return (
    <Controller
      name={block.id}
      control={control}
      defaultValue=""
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            {block.label}
            {block.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {block.description && (
            <p className="text-sm text-slate-500">{block.description}</p>
          )}
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50"
              >
                <input
                  type="radio"
                  {...field}
                  value={option}
                  checked={field.value === option}
                  className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="text-slate-700">{option}</span>
              </label>
            ))}
          </div>
          {fieldState.error && (
            <p className="text-sm text-red-500">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
