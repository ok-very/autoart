import type { EditorBlockProps } from './EditorBlockRenderer';

export function SectionHeaderPreview({ block, isActive, onUpdate }: EditorBlockProps) {
    const label = block.kind === 'module' ? block.label : '';

    if (!isActive) {
        return (
            <h2
                className="text-[16px] font-semibold text-ws-fg"
                style={{ fontFamily: '"Source Serif 4", serif' }}
            >
                {label || 'Section Header'}
            </h2>
        );
    }

    return (
        <input
            type="text"
            value={label}
            onChange={(e) => onUpdate?.(block.id, { label: e.target.value })}
            placeholder="Section Header"
            className="w-full bg-transparent text-[16px] font-semibold text-ws-fg border-none p-0 focus:outline-none focus:ring-0"
            style={{ fontFamily: '"Source Serif 4", serif' }}
        />
    );
}
