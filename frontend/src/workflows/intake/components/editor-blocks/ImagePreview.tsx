import { Image } from 'lucide-react';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function ImagePreview({ block, isActive, onUpdate }: EditorBlockProps) {
    const description = block.kind === 'module' ? (block.description ?? '') : '';

    if (!isActive) {
        return (
            <div className="w-full h-32 bg-ws-bg border border-ws-panel-border rounded-lg flex items-center justify-center">
                <Image className="w-8 h-8 text-ws-muted opacity-40" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="w-full h-32 bg-ws-bg border border-ws-panel-border rounded-lg flex items-center justify-center">
                <Image className="w-8 h-8 text-ws-muted opacity-40" />
            </div>
            <input
                type="url"
                value={description}
                onChange={(e) => onUpdate?.(block.id, { description: e.target.value })}
                placeholder="Image URL"
                className="w-full text-sm border border-ws-panel-border rounded-md px-3 py-2 bg-transparent text-ws-text-secondary focus:outline-none focus:border-[var(--ws-accent)]"
            />
        </div>
    );
}
