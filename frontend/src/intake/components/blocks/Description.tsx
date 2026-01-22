import type { ModuleBlock } from '@autoart/shared';

interface DescriptionProps {
  block: ModuleBlock;
}

export function Description({ block }: DescriptionProps) {
  return (
    <div className="py-2">
      {block.label && (
        <p className="text-sm font-medium text-slate-700 mb-1">{block.label}</p>
      )}
      {block.description && (
        <p className="text-sm text-slate-600 whitespace-pre-wrap">{block.description}</p>
      )}
    </div>
  );
}
