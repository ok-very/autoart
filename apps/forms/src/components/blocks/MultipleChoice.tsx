import type { ModuleBlock } from '@autoart/shared';

interface MultipleChoiceProps {
  block: ModuleBlock;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function MultipleChoice({ block, value, onChange, error }: MultipleChoiceProps) {
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
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option}
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              value === option
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={block.id}
              value={option}
              checked={value === option}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-900">{option}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
