import type { EditorBlockProps } from './EditorBlockRenderer';

export function ShortAnswerPreview({ isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="w-1/2 border-b border-ws-panel-border py-2 text-sm text-ws-muted">
                Short answer text
            </div>
        );
    }

    return (
        <div className="w-1/2 border-b border-ws-panel-border py-2">
            <input
                type="text"
                disabled
                placeholder="Short answer text"
                className="w-full bg-transparent text-sm text-ws-muted border-none p-0 focus:outline-none"
            />
        </div>
    );
}
