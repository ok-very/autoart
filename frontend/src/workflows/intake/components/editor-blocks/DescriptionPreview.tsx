import type { EditorBlockProps } from './EditorBlockRenderer';

export function DescriptionPreview({ block, isActive, onUpdate }: EditorBlockProps) {
    const description = block.kind === 'module' ? (block.description ?? '') : '';

    if (!isActive) {
        return (
            <p className="text-sm text-ws-text-secondary leading-relaxed">
                {description || 'Description text'}
            </p>
        );
    }

    return (
        <textarea
            value={description}
            onChange={(e) => onUpdate?.(block.id, { description: e.target.value })}
            placeholder="Add a description or instructions..."
            rows={3}
            className="w-full bg-transparent text-sm text-ws-text-secondary border border-ws-panel-border rounded px-3 py-2 resize-none focus:outline-none focus:border-[var(--ws-accent)]"
        />
    );
}
