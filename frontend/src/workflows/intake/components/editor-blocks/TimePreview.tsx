import { Clock } from 'lucide-react';
import { TimeInput } from '@autoart/ui';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function TimePreview({ block: _block, isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="flex items-center gap-2 text-ws-muted">
                <Clock className="w-4 h-4 opacity-40" />
                <span className="text-sm">Time</span>
            </div>
        );
    }

    return (
        <div className="w-1/3">
            <TimeInput disabled />
        </div>
    );
}
