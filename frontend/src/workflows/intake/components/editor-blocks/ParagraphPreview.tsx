import type { EditorBlockProps } from './EditorBlockRenderer';

export function ParagraphPreview({ isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="space-y-2">
                <div className="w-full border-b border-ws-panel-border py-1" />
                <div className="w-3/4 border-b border-ws-panel-border py-1" />
                <span className="text-xs text-ws-muted">Long answer text</span>
            </div>
        );
    }

    return (
        <textarea
            disabled
            placeholder="Long answer text"
            rows={3}
            className="w-full bg-transparent text-sm text-ws-muted border border-ws-panel-border rounded px-3 py-2 resize-none focus:outline-none"
            style={{
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, var(--ws-panel-border, #e2e0dc) 27px, var(--ws-panel-border, #e2e0dc) 28px)',
            }}
        />
    );
}
