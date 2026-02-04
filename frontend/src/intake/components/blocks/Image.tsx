/**
 * ImageBlock - Static image display
 */

import type { ModuleBlock } from '@autoart/shared';

interface ImageBlockProps {
  block: ModuleBlock;
}

export function ImageBlock({ block }: ImageBlockProps) {
  // The image URL would be stored in a field - for now use placeholder or description
  const imageUrl = block.placeholder || block.description;

  if (!imageUrl) {
    return (
      <div className="py-pub-4">
        <div className="h-48 bg-pub-section-bg rounded-lg flex items-center justify-center border border-pub-panel-border">
          <span className="text-pub-muted">Image placeholder</span>
        </div>
        {block.label && (
          <p className="mt-pub-2 text-pub-meta text-center text-pub-text-secondary">{block.label}</p>
        )}
      </div>
    );
  }

  return (
    <div className="py-pub-4">
      <img
        src={imageUrl}
        alt={block.label || 'Form image'}
        className="max-w-full h-auto rounded-lg"
      />
      {block.label && (
        <p className="mt-pub-2 text-pub-meta text-center text-pub-text-secondary">{block.label}</p>
      )}
    </div>
  );
}
