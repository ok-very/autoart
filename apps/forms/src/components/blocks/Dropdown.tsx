import type { ModuleBlock } from '@autoart/shared';

interface DropdownProps {
  block: ModuleBlock;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function Dropdown({ block, value, onChange, error }: DropdownProps) {
  const options = block.options || [];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {block.label}
        {block.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {block.description && (
        <p className="text-sm text-slate-500">{block.description}</p>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={block.required}
        className={`w-full px-3 py-2 border rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      >
        <option value="">Select an option...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
