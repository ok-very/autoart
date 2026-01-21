import type { ModuleBlock } from '@autoart/shared';

interface ParagraphProps {
  block: ModuleBlock;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function Paragraph({ block, value, onChange, error }: ParagraphProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {block.label}
        {block.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {block.description && (
        <p className="text-sm text-slate-500">{block.description}</p>
      )}
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={block.placeholder}
        required={block.required}
        rows={4}
        className={`w-full px-3 py-2 border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
