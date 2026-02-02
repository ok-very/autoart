import type { ModuleBlock } from '@autoart/shared';

interface SectionHeaderProps {
  block: ModuleBlock;
}

export function SectionHeader({ block }: SectionHeaderProps) {
  return (
    <div className="pt-6 pb-2">
      <h3 className="text-ws-h2 font-semibold text-ws-fg">{block.label}</h3>
      {block.description && (
        <p className="mt-1 text-sm text-ws-text-secondary">{block.description}</p>
      )}
      <div className="mt-3 border-b border-ws-panel-border" />
    </div>
  );
}
