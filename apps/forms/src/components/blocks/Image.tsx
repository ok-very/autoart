import type { ModuleBlock } from '@autoart/shared';

interface ImageBlockProps {
  block: ModuleBlock;
}

export function ImageBlock({ block }: ImageBlockProps) {
  // The image URL would be stored in a field - for now use placeholder or description
  const imageUrl = block.placeholder || block.description;

  if (!imageUrl) {
    return (
      <div className="py-4">
        <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center">
          <span className="text-slate-400">Image placeholder</span>
        </div>
        {block.label && (
          <p className="mt-2 text-sm text-center text-slate-500">{block.label}</p>
        )}
      </div>
    );
  }

  return (
    <div className="py-4">
      <img
        src={imageUrl}
        alt={block.label || 'Form image'}
        className="max-w-full h-auto rounded-lg"
      />
      {block.label && (
        <p className="mt-2 text-sm text-center text-slate-500">{block.label}</p>
      )}
    </div>
  );
}
