import { Calendar } from 'lucide-react';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function DatePreview({ block: _block, isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="flex items-center gap-2 text-ws-muted">
                <Calendar className="w-4 h-4 opacity-40" />
                <span className="text-sm">Date</span>
            </div>
        );
    }

    return (
        <div className="w-1/3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-ws-muted opacity-40 shrink-0" />
            <input
                type="text"
                disabled
                placeholder="MM / DD / YYYY"
                className="flex-1 min-w-0 text-sm border border-ws-panel-border rounded-md px-3 py-2 bg-transparent text-ws-muted focus:outline-none"
            />
        </div>
    );
}
