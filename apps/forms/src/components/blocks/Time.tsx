import type { ModuleBlock } from '@autoart/shared';

interface TimeInputProps {
  block: ModuleBlock;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TimeInput({ block, value, onChange, error }: TimeInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {block.label}
        {block.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {block.description && (
        <p className="text-sm text-slate-500">{block.description}</p>
      )}
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={block.required}
        className={`w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
