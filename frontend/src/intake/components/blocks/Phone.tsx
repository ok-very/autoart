/**
 * Phone - Phone input block using React Hook Form
 */

import { useFormContext, Controller } from 'react-hook-form';
import type { ModuleBlock } from '@autoart/shared';

interface PhoneProps {
  block: ModuleBlock;
}

export function Phone({ block }: PhoneProps) {
  const { control } = useFormContext();

  return (
    <Controller
      name={block.id}
      control={control}
      defaultValue=""
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ws-text-secondary">
            {block.label}
            {block.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {block.description && (
            <p className="text-sm text-ws-text-secondary">{block.description}</p>
          )}
          <input
            {...field}
            type="tel"
            placeholder={block.placeholder ?? '+1 (555) 000-0000'}
            className={`w-full px-3 py-2 border rounded-lg text-ws-fg placeholder:text-ws-muted focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldState.error ? 'border-red-500' : 'border-slate-300'
              }`}
          />
          {fieldState.error && (
            <p className="text-sm text-red-500">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
