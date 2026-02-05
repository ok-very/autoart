import { Hash } from 'lucide-react';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function NumberPreview({ isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="flex items-center gap-2 text-ws-muted">
                <Hash className="w-4 h-4 opacity-40" />
                <span className="text-sm">Number</span>
            </div>
        );
    }

    return (
        <div className="w-1/3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-ws-muted opacity-40 shrink-0" />
            <input
                type="number"
                disabled
                placeholder="0"
                className="flex-1 min-w-0 text-sm border border-ws-panel-border rounded-md px-3 py-2 bg-transparent text-ws-muted focus:outline-none"
            />
        </div>
    );
}
