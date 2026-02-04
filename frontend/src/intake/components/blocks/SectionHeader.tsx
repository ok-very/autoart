/**
 * SectionHeader - Static section divider with title
 */

import type { ModuleBlock } from '@autoart/shared';

interface SectionHeaderProps {
  block: ModuleBlock;
}

export function SectionHeader({ block }: SectionHeaderProps) {
  return (
    <div className="pt-pub-6 pb-pub-2">
      <h3 className="pub-section-header" style={{ marginBottom: 0 }}>{block.label}</h3>
      {block.description && (
        <p className="pub-description mt-pub-1">{block.description}</p>
      )}
      <div className="mt-pub-3 border-b border-pub-panel-border" />
    </div>
  );
}
