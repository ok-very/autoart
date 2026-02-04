/**
 * Description - Static text block for instructions or info
 */

import type { ModuleBlock } from '@autoart/shared';

interface DescriptionProps {
  block: ModuleBlock;
}

export function Description({ block }: DescriptionProps) {
  return (
    <div className="py-pub-2">
      {block.label && (
        <p className="pub-label mb-pub-1">{block.label}</p>
      )}
      {block.description && (
        <p className="pub-description whitespace-pre-wrap">{block.description}</p>
      )}
    </div>
  );
}
